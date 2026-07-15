"""Journey & Nova Act Runtime API: persona-steered journey runs.

Runs execute through the nova_act SDK when it is installed and configured
(NOVA_ACT_API_KEY); otherwise runs are stored as `queued` with the fully
composed act() prompt and steering config, so the contract is exercisable
on any deployment.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.app.config import get_settings
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

    executable = bool(get_settings().nova_act_api_key)
    try:
        import nova_act  # noqa: F401
    except ImportError:
        executable = False

    run = {
        "status": "queued" if not executable else "starting",
        "target_url": body.target_url,
        "goal": body.goal,
        "act_prompt": act_prompt,
        "steering": steering,
        "executable": executable,
        "steps": [],
    }
    record = save_artifact(
        user_id,
        "journeys",
        "journey_run",
        run,
        provenance={
            "persona_hub_id": body.persona_hub_id,
            "persona_index": body.persona_index,
            "engine": "nova_act" if executable else "queued (no NOVA_ACT_API_KEY)",
        },
    )
    return envelope(
        data=run,
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        warnings=[] if executable else ["nova_act not configured; run stored as queued"],
        next_actions=[
            {"action": "analyze", "endpoint": "/api/analysis/action-trace"},
            {"action": "ux_chain", "endpoint": "/api/ux-chain/runs"},
        ],
    )


@router.get("/{run_id}", operation_id="journeys_get")
def get_journey(run_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "journeys", run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="journey run not found")
    return envelope(data=record["data"], artifact_id=run_id, provenance=record["provenance"])
