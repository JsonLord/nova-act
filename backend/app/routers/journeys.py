"""Journey & Nova Act Runtime API: persona-steered journey runs.

Runs execute through the nova_act SDK when it is installed and configured
(NOVA_ACT_API_KEY); otherwise runs are stored as `queued` with the fully
composed act() prompt and steering config, so the contract is exercisable
on any deployment.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import load_artifact, save_artifact

router = APIRouter(prefix="/api/journeys", tags=["journeys"])


class JourneyRequest(BaseModel):
    target_url: str
    goal: str
    persona_hub_id: str = ""
    persona_index: int = 0


@router.post("", operation_id="journeys_create")
def create_journey(
    body: JourneyRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("journey_runs", cost=10)),
):
    steering: dict | None = None
    act_prompt = body.goal
    if body.persona_hub_id:
        hub = load_artifact(user_id, "personas", body.persona_hub_id)
        if hub is None:
            raise HTTPException(status_code=404, detail="persona hub not found")
        from backend.app.routers.personas import _rebuild_persona
        from oasis.generator.steering import build_act_prompt, derive_steering

        personas = hub["data"]["personas"]
        if not 0 <= body.persona_index < len(personas):
            raise HTTPException(status_code=404, detail="persona index out of range")
        persona = _rebuild_persona(personas[body.persona_index])
        steering = derive_steering(persona, goal=body.goal).to_dict()
        act_prompt = build_act_prompt(persona, body.goal)

    from backend.app.engines import resolve_engine
    from backend.app.llm_config import resolve_llm

    engine = resolve_engine()
    text_llm = resolve_llm(request, user_id, "text")
    can_run = engine.executable and engine.name == "open" and text_llm is not None
    warnings = []
    if not engine.executable:
        warnings.append(f"engine '{engine.name}' not executable: {engine.reason}")
    elif engine.name == "open" and text_llm is None:
        warnings.append("no BYOK text model configured (headers or /api/account/llm-config); run queued")
    elif engine.name == "nova":
        warnings.append("nova engine execution adapter pending (spec §17.3 phase 5); run queued")

    run = {
        "status": "starting" if can_run else "queued",
        "target_url": body.target_url,
        "goal": body.goal,
        "act_prompt": act_prompt,
        "steering": steering,
        "executable": can_run,
        "steps": [],
    }
    provenance = {
        "persona_hub_id": body.persona_hub_id,
        "persona_index": body.persona_index,
        "engine": engine.name,
        "engine_status": engine.reason,
        "llm": f"{text_llm.provider}/{text_llm.model}" if text_llm else None,
    }
    record = save_artifact(user_id, "journeys", "journey_run", run, provenance=provenance)

    if can_run:
        import threading

        from backend.app.engines.open_engine import run_journey
        from backend.app.llm import chat_sync

        def llm_call(system: str, user: str) -> str:
            return chat_sync(text_llm, user, system=system, temperature=0.2)

        def worker() -> None:
            run_journey(user_id, record["artifact_id"], run, llm_call, provenance)
            # Auto-close the loop (spec §16.1): when this run completes and ≥2
            # completed runs share the goal, build the analysis + decisions.
            if run.get("status") == "completed":
                orchestrate_analysis(user_id, body.goal)

        threading.Thread(target=worker, daemon=True).start()

    return envelope(
        data=run,
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        warnings=warnings,
        next_actions=[
            {"action": "analyze", "endpoint": "/api/analysis/action-trace"},
            {"action": "ux_chain", "endpoint": "/api/ux-chain/runs"},
        ],
    )


def _step_traces(run_data: dict) -> list[dict]:
    """Reduce a run's engine steps to the analysis trace shape."""
    return [
        {"action": s.get("action", "wait"), "x": s.get("x") or 0.0,
         "y": s.get("y") or 0.0, "think": s.get("think", "")}
        for s in run_data.get("steps", [])
    ]


def orchestrate_analysis(user_id: str, goal: str) -> dict | None:
    """When ≥2 completed journey runs share a goal, build the Action Trace
    Graph and decision set automatically (spec §16.1). Returns the graph +
    decision artifact ids, or None when there is nothing to compare yet."""
    from backend.app.routers.analysis import build_action_trace, build_decisions
    from backend.app.storage import list_artifacts

    completed = []
    for entry in list_artifacts(user_id, "journeys"):
        record = load_artifact(user_id, "journeys", entry["artifact_id"])
        data = record["data"] if record else {}
        if data.get("status") == "completed" and data.get("goal") == goal and data.get("steps"):
            completed.append(
                {
                    "run_id": entry["artifact_id"],
                    "persona_id": record["provenance"].get("persona_hub_id", ""),
                    "steps": _step_traces(data),
                }
            )
    if len(completed) < 2:
        return None
    graph = build_action_trace(user_id, completed)
    decisions = build_decisions(user_id, graph["artifact_id"])
    return {
        "action_trace_graph_id": graph["artifact_id"],
        "decision_set_id": decisions["artifact_id"] if decisions else None,
        "runs_compared": len(completed),
    }


@router.post("/analyze", operation_id="journeys_analyze")
def analyze_goal(goal: str, user_id: str = Depends(get_user_id)):
    """Manually trigger the same orchestration for a goal's completed runs."""
    result = orchestrate_analysis(user_id, goal)
    if result is None:
        return envelope(data={"runs_compared": 0}, warnings=["fewer than 2 completed runs for this goal"])
    return envelope(
        data=result,
        next_actions=[{"action": "graph_qa", "endpoint": "/api/graph-research/qa"}],
    )


@router.get("", operation_id="journeys_list")
def list_journeys(user_id: str = Depends(get_user_id)):
    from backend.app.storage import list_artifacts

    return envelope(data=list_artifacts(user_id, "journeys"))


@router.get("/{run_id}", operation_id="journeys_get")
def get_journey(run_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "journeys", run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="journey run not found")
    return envelope(data=record["data"], artifact_id=run_id, provenance=record["provenance"])


@router.get("/{run_id}/screenshot/{step}", operation_id="journeys_screenshot")
def get_screenshot(run_id: str, step: int, user_id: str = Depends(get_user_id)):
    """Serve a per-step screenshot (the optically-degraded image the persona
    saw). Paths are confined to the caller's own journey folder."""
    from pathlib import Path

    from fastapi.responses import FileResponse

    from backend.app.config import get_settings

    record = load_artifact(user_id, "journeys", run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="journey run not found")
    shots = record["data"].get("screenshots", [])
    if not 0 <= step < len(shots):
        raise HTTPException(status_code=404, detail="screenshot not found")
    path = (get_settings().data_dir / shots[step]).resolve()
    # Path-traversal guard: must stay under this user's journey folder.
    root = (get_settings().data_dir / "users" / user_id / "journeys").resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="screenshot not found")
    return FileResponse(path, media_type="image/png")
