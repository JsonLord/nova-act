"""UserSync Space frontend compat pack.

The Leon4gr45/UserSync Hugging Face Space ships a React frontend that talks to
a small same-origin FastAPI surface (`/api/user`, `/api/v1/*`, `/api/tabs/*`,
`/api/save-data`, `/api/craft`, …). In the Space that surface proxied an
upstream demo API and a Blablador key; here every endpoint is implemented
against this backend's real services instead:

- personas/focus groups   -> oasis/generator (deterministic, seeded)
- content simulations     -> the bounded jobs runner + persona opinions,
                             with an optional BYOK LLM voice pass
- craft / variants        -> strictly BYOK (resolve_llm; no server keys,
                             Blablador excluded by policy)
- save-data / chat        -> the artifact store (sqlite/files)
- login/user/logout       -> aliases onto the existing HF OAuth router

No upstream proxy remains: the Space frontend is fully served by this app.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from collections import deque
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from backend.app.llm import chat_sync
from backend.app.llm_config import resolve_llm
from backend.app.quota import charge, get_ledger_key, get_user_id
from backend.app.storage import list_artifacts, load_artifact, save_artifact
from oasis.generator.generation import GenerationSpec, generate_personas
from oasis.generator.schema import CompanyContext

router = APIRouter(tags=["usersync"])


def _safe_segment(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]", "_", str(value))[:80] or "anon"


# --------------------------------------------------------------------------
# Auth aliases — the Space frontend uses /login, /api/user, /api/logout.
# --------------------------------------------------------------------------


@router.get("/login", operation_id="usersync_login", include_in_schema=False)
def login_alias():
    return RedirectResponse("/api/auth/login")


@router.get("/api/user", operation_id="usersync_user")
def user_alias(request: Request):
    hf_user = request.cookies.get("hf_user")
    if not hf_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return json.loads(hf_user)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user cookie")


@router.get("/api/logout", operation_id="usersync_logout")
def logout_alias():
    response = JSONResponse({"ok": True})
    response.delete_cookie("hf_user", path="/")
    return response


@router.get("/api/openapi.json", include_in_schema=False)
def openapi_alias(request: Request):
    # The frontend's tab bus fetches /api/openapi.json; the app serves
    # /openapi.json — alias, don't duplicate.
    return JSONResponse(request.app.openapi())


# --------------------------------------------------------------------------
# Tab bus — cross-tab event queue the frontend publishes view changes to.
# --------------------------------------------------------------------------

_tab_events: deque[dict[str, Any]] = deque(maxlen=200)


class TabEvent(BaseModel):
    source: str
    target: str | None = None
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)


@router.post("/api/tabs/events", operation_id="usersync_tab_event_publish")
def publish_tab_event(event: TabEvent):
    record = {**event.model_dump(), "at": time.time()}
    _tab_events.append(record)
    return {"ok": True, "queued": len(_tab_events)}


@router.get("/api/tabs/events", operation_id="usersync_tab_events")
def tab_events():
    return {"events": list(_tab_events)}


# --------------------------------------------------------------------------
# save-data / list-data — the Space's lightweight per-user persistence.
# --------------------------------------------------------------------------


class SaveDataRequest(BaseModel):
    type: str
    data: Any
    user: str


@router.post("/api/save-data", operation_id="usersync_save_data")
def save_data(body: SaveDataRequest, user_id: str = Depends(get_user_id)):
    record = save_artifact(
        user_id,
        "userdata",
        "userdata",
        {
            "user": _safe_segment(body.user),
            "type": _safe_segment(body.type),
            "timestamp": time.time(),
            "data": body.data,
        },
    )
    return {"success": True, "message": f"Data saved as {record['artifact_id']}"}


@router.get("/api/list-data", operation_id="usersync_list_data")
def list_data(
    type: str | None = None,
    user: str | None = None,
    user_id: str = Depends(get_user_id),
):
    safe_type = _safe_segment(type) if type else None
    safe_user = _safe_segment(user) if user else None
    results = []
    for entry in list_artifacts(user_id, "userdata"):
        record = load_artifact(user_id, "userdata", entry["artifact_id"])
        if not record:
            continue
        data = record["data"]
        if safe_type and data.get("type") != safe_type:
            continue
        if safe_user and data.get("user") != safe_user:
            continue
        results.append(data)
    return results


# --------------------------------------------------------------------------
# Craft — BYOK only. The Space used a server-side Blablador key; excluded.
# --------------------------------------------------------------------------


class CraftRequest(BaseModel):
    content: str
    variation: str | None = None


_CRAFT_SYSTEM = (
    "You are a helpful assistant that helps craft engaging marketing and "
    "social media content."
)


def _require_text_llm(request: Request, user_id: str):
    llm = resolve_llm(request, user_id, "text")
    if llm is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "No text model configured. Add your own key (BYOK) under "
                "Dev → Account → Model Access, or send X-LLM-* headers."
            ),
        )
    return llm


@router.post("/api/craft", operation_id="usersync_craft")
def craft(
    body: CraftRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("content_craft", cost=1)),
):
    llm = _require_text_llm(request, user_id)
    prompt = (
        "You are a professional content creator. Help me craft a "
        f"{body.variation or 'social media post'} based on the following content:\n\n"
        f"{body.content}\n\nProvide 3 distinct and engaging variations."
    )
    try:
        result = chat_sync(llm, prompt, system=_CRAFT_SYSTEM)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {error}")
    return {"result": result}


# --------------------------------------------------------------------------
# /api/v1 — focus groups, persona generation, content simulations.
# --------------------------------------------------------------------------


class GenerateV1Request(BaseModel):
    business_description: str = ""
    customer_profile: str = ""
    num_personas: int = Field(default=3, ge=1, le=2000)


class SimulationV1Request(BaseModel):
    focus_group_id: str = ""
    content_type: str = "text"
    content_payload: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)


def _hub_summary(record: dict[str, Any]) -> dict[str, Any]:
    data = record.get("data", {})
    prov = record.get("provenance", {})
    return {
        "id": record["artifact_id"],
        "name": prov.get("focus_group_name") or record["artifact_id"],
        "count": data.get("generated_count", len(data.get("personas", []))),
        "status": data.get("generation_status", "completed"),
        "created_at": record.get("created_at"),
    }


def _list_hubs(user_id: str) -> list[dict[str, Any]]:
    hubs = []
    for entry in list_artifacts(user_id, "personas"):
        record = load_artifact(user_id, "personas", entry["artifact_id"])
        if record:
            hubs.append(_hub_summary(record))
    return sorted(hubs, key=lambda h: h.get("created_at") or 0, reverse=True)


def _find_hub(user_id: str, ref: str | None) -> dict[str, Any] | None:
    """Resolve a focus-group reference: artifact id, display name, or latest."""
    if ref:
        record = load_artifact(user_id, "personas", ref)
        if record:
            return record
        for entry in list_artifacts(user_id, "personas"):
            record = load_artifact(user_id, "personas", entry["artifact_id"])
            if record and record.get("provenance", {}).get("focus_group_name") == ref:
                return record
    hubs = _list_hubs(user_id)
    if hubs:
        return load_artifact(user_id, "personas", hubs[0]["id"])
    return None


@router.get("/api/v1/personas", operation_id="usersync_v1_personas")
def v1_personas(user_id: str = Depends(get_user_id)):
    return {"focus_groups": _list_hubs(user_id)}


@router.post("/api/v1/personas/generate", operation_id="usersync_v1_personas_generate")
def v1_generate(
    body: GenerateV1Request,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("persona_generation", cost=1)),
):
    # Deterministic per input pair, varied across briefs.
    seed = int(
        hashlib.sha256(
            f"{body.business_description}|{body.customer_profile}".encode()
        ).hexdigest()[:8],
        16,
    ) % 100_000
    spec = GenerationSpec(
        company=CompanyContext(
            product_description=body.business_description,
            business_case="content_test",
        ),
        count=body.num_personas,
        seed=seed,
    )
    hub = generate_personas(spec)
    name = (body.customer_profile or body.business_description or "Focus group").strip()[:60]
    record = save_artifact(
        user_id,
        "personas",
        "persona_hub",
        {
            "graph": hub.to_graph_payload(),
            "oasis_reddit": [p.to_oasis_reddit_profile() for p in hub.personas],
            "personas": [p.to_dict() for p in hub.personas],
            "generation_status": "completed",
            "generated_count": len(hub.personas),
        },
        provenance={
            "generator": "oasis.generator",
            "seed": seed,
            "focus_group_name": name,
            "business_description": body.business_description[:500],
            "customer_profile": body.customer_profile[:500],
        },
    )
    return {
        "focus_group_id": record["artifact_id"],
        "focus_group_name": name,
        "num_personas": len(hub.personas),
        "personas": [
            {
                "name": p.realname,
                "username": p.username,
                "age": p.age,
                "profession": p.profession,
                "country": p.country,
            }
            for p in hub.personas[:25]
        ],
        "quota": meter,
    }


@router.get("/api/v1/network/{focus_group}", operation_id="usersync_v1_network")
def v1_network(focus_group: str, user_id: str = Depends(get_user_id)):
    record = _find_hub(user_id, focus_group)
    if record is None:
        raise HTTPException(status_code=404, detail="No focus group found")
    graph = record["data"].get("graph", {"nodes": [], "edges": []})
    degree: dict[int, int] = {}
    for edge in graph.get("edges", []):
        for endpoint in (edge.get("source"), edge.get("target")):
            if isinstance(endpoint, int):
                degree[endpoint] = degree.get(endpoint, 0) + 1
    nodes = [
        {
            "id": node.get("id"),
            "name": node.get("label")
            or node.get("profile", {}).get("realname", f"Persona {i}"),
            "location": node.get("profile", {}).get("country", ""),
            "role": node.get("profile", {}).get("profession", ""),
            "connections": degree.get(node.get("index", i), 0),
        }
        for i, node in enumerate(graph.get("nodes", []))
    ]
    return {
        "focus_group_id": record["artifact_id"],
        "nodes": nodes,
        "edges": [
            {"source": e.get("source"), "target": e.get("target")}
            for e in graph.get("edges", [])
        ],
    }


_STANCES = ["enthusiastic", "positive", "neutral", "skeptical", "critical"]


def _persona_reaction(persona: dict[str, Any], content: str) -> dict[str, Any]:
    """Deterministic opinionated reaction from a persona's steering traits.

    Sentiment blends brand affinity (emotional layer) with a stable per
    persona-per-content jitter, so the same content re-tested against the
    same group reproduces exactly (the audit property everything else has).
    """
    emotional = persona.get("emotional", {})
    affinity = emotional.get("brand_affinity", 0)  # -2 .. +2
    expressiveness = emotional.get("expressiveness", 3)  # 1 .. 5
    jitter_seed = hashlib.sha256(
        f"{persona.get('username', '')}|{content}".encode()
    ).hexdigest()
    jitter = (int(jitter_seed[:4], 16) / 0xFFFF) * 2 - 1  # -1 .. 1
    sentiment = max(-1.0, min(1.0, affinity * 0.35 + jitter * 0.5))
    stance = _STANCES[min(4, int((1 - sentiment) / 2 * 4.999))]
    opinions = persona.get("opinions", [])
    topic = opinions[0].get("topic") if opinions else persona.get("profession", "")
    return {
        "persona": persona.get("realname", ""),
        "username": persona.get("username", ""),
        "profession": persona.get("profession", ""),
        "sentiment": round(sentiment, 3),
        "stance": stance,
        "engagement": round(min(1.0, max(0.0, 0.3 + 0.14 * expressiveness + jitter * 0.2)), 3),
        "comment": (
            f"As a {persona.get('profession') or 'user'}"
            + (f" who cares about {topic}" if topic else "")
            + f", my take is {stance}."
        ),
    }


def _run_simulation(
    user_id: str, sim_id: str, personas: list[dict[str, Any]], content: str, llm
) -> None:
    reactions = [_persona_reaction(p, content) for p in personas]
    if llm is not None and reactions:
        # One batched voice pass: rewrite the deterministic stances in each
        # persona's own words (opinions stay pinned to the derived sentiment).
        roster = "\n".join(
            f"- {r['persona']} ({r['profession'] or 'user'}, stance: {r['stance']})"
            for r in reactions[:20]
        )
        try:
            raw = chat_sync(
                llm,
                "Content under test:\n"
                f"{content}\n\nPersonas and their fixed stances:\n{roster}\n\n"
                'Return ONLY a JSON array like [{"username": "...", "comment": "..."}] '
                "with one in-character comment per persona matching their stance.",
                system="You voice synthetic focus-group personas for content testing.",
            )
            match = re.search(r"\[.*\]", raw, re.DOTALL)
            voiced = {v["username"]: v["comment"] for v in json.loads(match.group(0))} if match else {}
            for reaction in reactions:
                comment = voiced.get(reaction["username"]) or voiced.get(reaction["persona"])
                if comment:
                    reaction["comment"] = str(comment)[:500]
        except Exception:
            pass  # deterministic comments remain — the honest fallback
    avg = sum(r["sentiment"] for r in reactions) / len(reactions) if reactions else 0.0
    record = load_artifact(user_id, "simulations", sim_id)
    data = record["data"] if record else {}
    data.update(
        status="completed",
        reactions=reactions,
        summary={
            "personas": len(reactions),
            "avg_sentiment": round(avg, 3),
            "positive": sum(1 for r in reactions if r["sentiment"] > 0.15),
            "neutral": sum(1 for r in reactions if -0.15 <= r["sentiment"] <= 0.15),
            "negative": sum(1 for r in reactions if r["sentiment"] < -0.15),
            "voiced_by_llm": llm is not None,
        },
        completed_at=time.time(),
    )
    save_artifact(user_id, "simulations", "simulation", data, artifact_id=sim_id)


@router.post("/api/v1/simulations", operation_id="usersync_v1_simulation_start")
def v1_start_simulation(
    body: SimulationV1Request,
    request: Request,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("content_simulation", cost=1)),
):
    hub = _find_hub(user_id, body.focus_group_id or None)
    if hub is None:
        raise HTTPException(
            status_code=404,
            detail="No focus group found — generate personas first (/api/v1/personas/generate)",
        )
    personas = hub["data"].get("personas", [])[:50]
    record = save_artifact(
        user_id,
        "simulations",
        "simulation",
        {
            "status": "running",
            "focus_group_id": hub["artifact_id"],
            "content_type": body.content_type,
            "content_payload": body.content_payload[:5000],
            "parameters": body.parameters,
            "reactions": [],
        },
        provenance={"focus_group_id": hub["artifact_id"]},
    )
    # Resolve BYOK now (needs the request); the job thread has no request.
    llm = resolve_llm(request, user_id, "text")
    from backend.app.jobs import submit

    job_id = submit(
        user_id,
        "content_simulation",
        lambda: _run_simulation(
            user_id, record["artifact_id"], personas, body.content_payload, llm
        ),
        target_artifact_id=record["artifact_id"],
    )
    return {
        "job_id": job_id,
        "simulation_id": record["artifact_id"],
        "status": "queued",
        "personas": len(personas),
        "quota": meter,
    }


@router.get("/api/v1/simulations/{ref}", operation_id="usersync_v1_simulation_status")
def v1_simulation_status(ref: str, user_id: str = Depends(get_user_id)):
    """Status by job id or simulation artifact id (the frontend passes either)."""
    job = load_artifact(user_id, "jobs", ref)
    sim_id = job["data"].get("target_artifact_id") if job else ref
    simulation = load_artifact(user_id, "simulations", sim_id) if sim_id else None
    if simulation is None and job is None:
        raise HTTPException(status_code=404, detail="Unknown simulation or job id")
    return {
        "job": ({"job_id": ref, **job["data"]} if job else None),
        "simulation_id": sim_id,
        **(simulation["data"] if simulation else {"status": "pending"}),
    }


# --------------------------------------------------------------------------
# API Tabs 1-10 — the Space's tab runner, now against local services.
# --------------------------------------------------------------------------

TAB_DEFINITIONS = [
    {"id": "focus-groups", "title": "1. Focus Groups", "upstream": "GET /api/v1/personas"},
    {"id": "generate-personas", "title": "2. Generate Personas", "upstream": "POST /api/v1/personas/generate"},
    {"id": "identify-personas", "title": "3. Identify Personas", "upstream": "local persona match"},
    {"id": "social-network", "title": "4. Social Network", "upstream": "GET /api/v1/network/{focus_group}"},
    {"id": "start-simulation", "title": "5. Start Simulation", "upstream": "POST /api/v1/simulations"},
    {"id": "simulation-status", "title": "6. Simulation Status", "upstream": "GET /api/v1/simulations/{job_id}"},
    {"id": "chat-message", "title": "7. Chat Message", "upstream": "local persistence"},
    {"id": "chat-history", "title": "8. Chat History", "upstream": "local persistence"},
    {"id": "variants", "title": "9. Generate Variants", "upstream": "BYOK LLM (deterministic fallback)"},
    {"id": "export", "title": "10. Export & Personas", "upstream": "GET /api/v1/simulations/{job_id}"},
]


@router.get("/api/tabs", operation_id="usersync_tabs")
def api_tabs():
    return TAB_DEFINITIONS


def _tab_response(tab_id: str, payload: dict[str, Any], result: Any) -> dict[str, Any]:
    return {"tab_id": tab_id, "payload": payload, "result": result}


def _chat_artifact_id(simulation_id: str) -> str:
    return f"chat-{_safe_segment(simulation_id)}"


def _meter(request: Request, category: str) -> dict:
    """Meter a tab run exactly like the direct endpoint it wraps."""
    return charge(category, cost=1)(request, get_ledger_key(request))


@router.post("/api/tabs/{tab_id}/run", operation_id="usersync_tab_run")
async def run_api_tab(tab_id: str, request: Request, user_id: str = Depends(get_user_id)):
    payload = await request.json()

    if tab_id == "focus-groups":
        return _tab_response(tab_id, payload, {"focus_groups": _list_hubs(user_id)})

    if tab_id == "generate-personas":
        body = GenerateV1Request(
            business_description=payload.get("business_description", ""),
            customer_profile=payload.get("customer_profile", ""),
            num_personas=int(payload.get("num_personas") or 1),
        )
        result = v1_generate(body, user_id=user_id, meter=_meter(request, "persona_generation"))
        return _tab_response(tab_id, body.model_dump(), result)

    if tab_id == "identify-personas":
        context = str(payload.get("context", "")).lower()
        hub = _find_hub(user_id, payload.get("focus_group_name") or None)
        if hub is None:
            return _tab_response(tab_id, payload, {"matches": [], "detail": "No focus group yet"})
        words = set(re.findall(r"[a-z]{3,}", context))
        scored = []
        for persona in hub["data"].get("personas", []):
            haystack = json.dumps(persona).lower()
            score = sum(1 for word in words if word in haystack)
            scored.append((score, persona))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return _tab_response(
            tab_id,
            payload,
            {
                "focus_group_id": hub["artifact_id"],
                "matches": [
                    {
                        "name": p.get("realname"),
                        "username": p.get("username"),
                        "profession": p.get("profession"),
                        "score": score,
                    }
                    for score, p in scored[:5]
                ],
            },
        )

    if tab_id == "social-network":
        ref = payload.get("focus_group_name") or payload.get("name") or ""
        try:
            return _tab_response(tab_id, payload, v1_network(ref, user_id=user_id))
        except HTTPException as error:
            return _tab_response(tab_id, payload, {"detail": error.detail, "nodes": [], "edges": []})

    if tab_id == "start-simulation":
        body = SimulationV1Request(
            focus_group_id=payload.get("simulation_id", ""),
            content_type=payload.get("format") or "text",
            content_payload=payload.get("content_text", ""),
        )
        result = v1_start_simulation(
            body, request, user_id=user_id, meter=_meter(request, "content_simulation")
        )
        return _tab_response(tab_id, body.model_dump(), result)

    if tab_id == "simulation-status":
        return _tab_response(
            tab_id,
            payload,
            v1_simulation_status(payload.get("simulation_id", ""), user_id=user_id),
        )

    if tab_id == "chat-message":
        simulation_id = payload.get("simulation_id", "")
        message = {
            "simulation_id": simulation_id,
            "sender": payload.get("sender") or "User",
            "message": payload.get("message", ""),
            "timestamp": time.time(),
        }
        chat_id = _chat_artifact_id(simulation_id)
        record = load_artifact(user_id, "chats", chat_id)
        history = record["data"].get("history", []) if record else []
        history.append(message)
        save_artifact(user_id, "chats", "chat", {"history": history}, artifact_id=chat_id)
        return _tab_response(tab_id, payload, {"saved": True, "message": message})

    if tab_id == "chat-history":
        chat_id = _chat_artifact_id(payload.get("simulation_id", ""))
        record = load_artifact(user_id, "chats", chat_id)
        return _tab_response(
            tab_id, payload, {"history": record["data"].get("history", []) if record else []}
        )

    if tab_id == "variants":
        content = payload.get("content_text", "")
        count = max(1, min(10, int(payload.get("num_variants") or 5)))
        llm = resolve_llm(request, user_id, "text")
        if llm is not None:
            try:
                raw = chat_sync(
                    llm,
                    f"Write {count} distinct short variants of this content for testing. "
                    f'Return ONLY a JSON array of strings.\n\nContent:\n{content}',
                    system=_CRAFT_SYSTEM,
                )
                match = re.search(r"\[.*\]", raw, re.DOTALL)
                variants = [str(v) for v in json.loads(match.group(0))][:count] if match else []
                if variants:
                    return _tab_response(
                        tab_id,
                        payload,
                        {"variants": [{"variant": i + 1, "content": v} for i, v in enumerate(variants)], "voiced_by_llm": True},
                    )
            except Exception:
                pass
        angles = ["direct", "playful", "urgent", "premium", "community-first",
                  "data-led", "story-led", "minimal", "bold", "reassuring"]
        return _tab_response(
            tab_id,
            payload,
            {
                "variants": [
                    {"variant": i + 1, "content": f"[{angles[i % len(angles)]}] {content}"}
                    for i in range(count)
                ],
                "voiced_by_llm": False,
            },
        )

    if tab_id == "export":
        action = payload.get("action") or "export_simulation"
        simulation_id = payload.get("simulation_id", "")
        if action in {"export_simulation", "get_network_graph"}:
            if action == "get_network_graph":
                simulation = load_artifact(user_id, "simulations", simulation_id)
                ref = simulation["data"].get("focus_group_id", "") if simulation else simulation_id
                try:
                    return _tab_response(tab_id, payload, v1_network(ref, user_id=user_id))
                except HTTPException as error:
                    return _tab_response(tab_id, payload, {"detail": error.detail})
            return _tab_response(
                tab_id, payload, v1_simulation_status(simulation_id, user_id=user_id)
            )
        if action == "list_personas":
            return _tab_response(tab_id, payload, {"focus_groups": _list_hubs(user_id)})
        if action == "get_persona":
            hub = _find_hub(user_id, payload.get("focus_group_name") or None)
            wanted = str(payload.get("persona_name", "")).lower()
            persona = next(
                (
                    p
                    for p in (hub["data"].get("personas", []) if hub else [])
                    if wanted in (p.get("realname", "") + p.get("username", "")).lower()
                ),
                None,
            )
            if persona is None:
                return _tab_response(tab_id, payload, {"detail": "Persona not found"})
            return _tab_response(tab_id, payload, {"persona": persona})
        if action == "delete_simulation":
            return _tab_response(
                tab_id, payload, {"simulation_id": simulation_id, "status": "delete_requested"}
            )
        return _tab_response(tab_id, payload, {"status": "unknown_export_action", "action": action})

    raise HTTPException(status_code=404, detail=f"Unknown tab id: {tab_id}")
