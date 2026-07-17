"""Persona Hub API: generation, enrichment, graphs, steering (wraps oasis/generator)."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import load_artifact, save_artifact
from oasis.generator.generation import Distribution, GenerationSpec, generate_personas
from oasis.generator.schema import CompanyContext
from oasis.generator.steering import build_act_prompt, derive_steering

router = APIRouter(prefix="/api/personas", tags=["personas"])


class GenerateRequest(BaseModel):
    company_name: str = ""
    product_name: str = ""
    product_description: str = ""
    business_case: Literal["usability_test", "u_test", "content_test", "branding_test"] = (
        "usability_test"
    )
    count: int = Field(default=12, ge=1, le=10000)
    seed: int = 42
    ties_per_persona: int = Field(default=2, ge=0, le=10)
    # Data unification (spec.md §16): distributions derived by /api/datahub/unify
    unified_traits_id: str | None = None
    datahub_snapshot_ids: list[str] = Field(default_factory=list)
    research_drop_ids: list[str] = Field(default_factory=list)
    # Phase 3: stream the reveal — generate in a background job that appends
    # personas to the hub graph one by one (frontend polls the graph).
    stream: bool = False


def _spec_from_request(body: GenerateRequest, user_id: str) -> GenerationSpec:
    spec = GenerationSpec(
        company=CompanyContext(
            company_name=body.company_name,
            product_name=body.product_name,
            product_description=body.product_description,
            business_case=body.business_case,
            datahub_snapshot_ids=body.datahub_snapshot_ids,
            research_drop_ids=body.research_drop_ids,
        ),
        count=body.count,
        seed=body.seed,
        ties_per_persona=body.ties_per_persona,
    )
    if body.unified_traits_id:
        unified = load_artifact(user_id, "connectors", body.unified_traits_id)
        if unified is None:
            raise HTTPException(status_code=404, detail="unified_traits_id not found")
        traits = unified["data"]
        if traits.get("age_range"):
            spec.age_range = tuple(traits["age_range"])  # type: ignore[assignment]
        for key, attr in (("genders", "genders"), ("countries", "countries")):
            if traits.get(key):
                setattr(
                    spec, attr,
                    Distribution(list(traits[key].keys()), list(traits[key].values())),
                )
        if traits.get("digital_literacy_mean"):
            spec.digital_literacy_mean = traits["digital_literacy_mean"]
        if traits.get("patience_mean"):
            spec.patience_mean = traits["patience_mean"]
        if traits.get("brand_affinity"):
            spec.brand_affinity = Distribution(
                [int(k) for k in traits["brand_affinity"].keys()],
                list(traits["brand_affinity"].values()),
            )
    return spec


@router.post("/generate", operation_id="personas_generate")
def generate(
    body: GenerateRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("persona_generation", cost=1)),
):
    spec = _spec_from_request(body, user_id)
    provenance = {
        "generator": "oasis.generator",
        "seed": body.seed,
        "unified_traits_id": body.unified_traits_id,
        "datahub_snapshot_ids": body.datahub_snapshot_ids,
        "research_drop_ids": body.research_drop_ids,
    }

    if body.stream:
        # Reserve the hub with an empty graph + running status; the job appends
        # personas one by one (Phase 3 honest reveal).
        record = save_artifact(
            user_id, "personas", "persona_hub",
            {"graph": {"nodes": [], "edges": [], "spec": {}}, "personas": [], "oasis_reddit": [],
             "generation_status": "running", "generated_count": 0, "target_count": body.count},
            provenance=provenance,
        )
        from backend.app.jobs import submit

        job_id = submit(
            user_id, "persona_generation",
            lambda: _generate_streamed(user_id, record["artifact_id"], spec, provenance),
            target_artifact_id=record["artifact_id"],
        )
        return envelope(
            data={"streaming": True, "target_count": body.count, "job_id": job_id},
            artifact_id=record["artifact_id"], provenance=provenance, quota=meter,
            next_actions=[{"action": "poll_graph", "endpoint": f"/api/personas/{record['artifact_id']}/graph"}],
        )

    hub = generate_personas(spec)
    graph = _graph_with_provenance(hub, provenance)
    record = save_artifact(
        user_id, "personas", "persona_hub",
        {"graph": graph, "oasis_reddit": [p.to_oasis_reddit_profile() for p in hub.personas],
         "personas": [p.to_dict() for p in hub.personas],
         "generation_status": "completed", "generated_count": len(hub.personas)},
        provenance=provenance,
    )
    return envelope(
        data={"count": len(hub.personas), "edges": len(hub.edges), "graph": graph},
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        next_actions=[
            {"action": "derive_steering", "endpoint": f"/api/personas/{record['artifact_id']}/steering/0"},
            {"action": "simulate", "endpoint": "/api/social-mirror/simulations"},
        ],
    )


def _graph_with_provenance(hub, provenance: dict) -> dict:
    """Attach pipeline-run provenance to each node (Phase 3 addition #3) so
    the UI caption/card can show which data shaped each persona."""
    graph = hub.to_graph_payload()
    for node in graph["nodes"]:
        node["provenance"] = {
            "unified_traits_id": provenance.get("unified_traits_id"),
            "datahub_snapshot_ids": provenance.get("datahub_snapshot_ids", []),
            "research_drop_ids": provenance.get("research_drop_ids", []),
        }
    return graph


def _generate_streamed(user_id: str, hub_id: str, spec, provenance: dict) -> None:
    """Generate personas and append them to the hub graph one by one, deriving
    each persona's discovered steering summary as it lands (real per-persona
    work), re-persisting so the frontend poll sees the graph grow."""
    from oasis.generator.steering import derive_steering

    hub = generate_personas(spec)
    full_graph = _graph_with_provenance(hub, provenance)
    node_by_index = {n["index"]: n for n in full_graph["nodes"]}
    data = {
        "graph": {"nodes": [], "edges": [], "spec": full_graph.get("spec", {})},
        "personas": [], "oasis_reddit": [],
        "generation_status": "running", "generated_count": 0, "target_count": len(hub.personas),
    }
    for i, persona in enumerate(hub.personas):
        node = node_by_index[i]
        # Attach the read-only discovered-steering summary to the node.
        config = derive_steering(persona).to_dict()
        node["discovered_steering"] = {
            "observing": {k: v.get("value") for k, v in config["observing"].items()},
            "acting_allowed": config["acting"]["allowed_actions"]["value"],
            "frustration_abort": config["acting"]["frustration_abort_after_failed_steps"]["value"],
        }
        data["graph"]["nodes"].append(node)
        data["personas"].append(persona.to_dict())
        data["oasis_reddit"].append(persona.to_oasis_reddit_profile())
        # Reveal edges whose endpoints have both landed.
        landed = {n["index"] for n in data["graph"]["nodes"]}
        data["graph"]["edges"] = [
            e for e in full_graph["edges"] if e["source"] in landed and e["target"] in landed
        ]
        data["generated_count"] = i + 1
        save_artifact(user_id, "personas", "persona_hub", data, provenance=provenance, artifact_id=hub_id)
    data["generation_status"] = "completed"
    save_artifact(user_id, "personas", "persona_hub", data, provenance=provenance, artifact_id=hub_id)


class EnrichRequest(BaseModel):
    batch_size: int = Field(default=10, ge=1, le=50)
    concurrency: int = Field(default=8, ge=1, le=32)


@router.post("/{hub_id}/enrich", operation_id="personas_enrich")
def enrich_hub(
    hub_id: str,
    body: EnrichRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("persona_enrichment", cost=5)),
):
    """LLM-enrich persona text and opinion statements via the caller's BYOK
    text slot (batched, parallel — 2,000 personas ≈ 200 calls, spec §5.1)."""
    from backend.app.llm import chat_sync
    from backend.app.llm_config import resolve_llm
    from oasis.generator.enrichment import enrich_personas

    record = load_artifact(user_id, "personas", hub_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Persona hub not found")
    text_llm = resolve_llm(request, user_id, "text")
    if text_llm is None:
        raise HTTPException(
            status_code=422,
            detail="No BYOK text model configured (X-LLM-* headers or /api/account/llm-config)",
        )

    personas = [_rebuild_persona(raw) for raw in record["data"]["personas"]]
    report = enrich_personas(
        personas,
        llm=lambda prompt: chat_sync(text_llm, prompt, temperature=0.8),
        batch_size=body.batch_size,
        concurrency=body.concurrency,
    )
    # Persist enriched text back into the hub artifact (graph nodes included).
    record["data"]["personas"] = [p.to_dict() for p in personas]
    record["data"]["oasis_reddit"] = [p.to_oasis_reddit_profile() for p in personas]
    for node, persona in zip(record["data"]["graph"]["nodes"], personas):
        node["profile"] = persona.to_dict()
    save_artifact(
        user_id, "personas", "persona_hub", record["data"],
        provenance={**record["provenance"], "enriched_by": f"{text_llm.provider}/{text_llm.model}"},
        artifact_id=hub_id,
    )
    return envelope(
        data={
            "llm_calls": report.llm_calls,
            "enriched": report.enriched,
            "failed_batches": report.failed_batches,
            "llm": f"{text_llm.provider}/{text_llm.model}",
        },
        artifact_id=hub_id,
        quota=meter,
    )


@router.get("/{hub_id}/graph", operation_id="personas_graph")
def get_graph(hub_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "personas", hub_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Persona hub not found")
    return envelope(data=record["data"]["graph"], artifact_id=hub_id, provenance=record["provenance"])


@router.get("/{hub_id}/steering/{index}", operation_id="personas_steering")
def get_steering(
    hub_id: str,
    index: int,
    goal: str = "",
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("steering_derivation", cost=1)),
):
    record = load_artifact(user_id, "personas", hub_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Persona hub not found")
    personas = record["data"]["personas"]
    if not 0 <= index < len(personas):
        raise HTTPException(status_code=404, detail="Persona index out of range")
    persona = _rebuild_persona(personas[index])
    config = derive_steering(persona, goal=goal)
    return envelope(
        data={
            "steering": config.to_dict(),
            "act_prompt": build_act_prompt(persona, goal or "Explore the product."),
        },
        artifact_id=f"{hub_id}:steering:{index}",
        provenance=config.provenance,
        quota=meter,
    )


def _rebuild_persona(raw: dict[str, Any]):
    from oasis.generator.schema import (
        EmotionalProfile,
        MentalProfile,
        Opinion,
        PhysicalProfile,
        UserSyncPersona,
    )

    return UserSyncPersona(
        **{
            **{k: raw[k] for k in (
                "realname", "username", "bio", "persona", "age", "gender", "mbti",
                "country", "profession", "interested_topics", "persona_id", "provenance",
            )},
            "physical": PhysicalProfile(**raw["physical"]),
            "mental": MentalProfile(**raw["mental"]),
            "emotional": EmotionalProfile(**raw["emotional"]),
            "opinions": [Opinion(**o) for o in raw["opinions"]],
            "company_context": CompanyContext(**raw["company_context"]),
        }
    )
