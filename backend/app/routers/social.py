"""Social Mirror API: OASIS simulations over a generated persona hub.

The full OASIS runtime (camel-oasis + an LLM backend) runs in the social
station's own Space; this router owns the contract — creating simulation
records over a persona hub and serving timeline frames for the network
animation. Without the runtime installed, simulations are stored `queued`.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import load_artifact, save_artifact

router = APIRouter(prefix="/api/social-mirror", tags=["social-mirror"])


class SimulationRequest(BaseModel):
    persona_hub_id: str
    platform: Literal["reddit", "twitter"] = "reddit"
    timesteps: int = Field(default=10, ge=1, le=100)
    activate_fraction: float = Field(default=0.25, gt=0, le=1.0)
    content_under_test: str = ""


@router.post("/simulations", operation_id="social_simulate")
def create_simulation(
    body: SimulationRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("social_simulation", cost=10)),
):
    hub = load_artifact(user_id, "personas", body.persona_hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="persona hub not found")
    graph = hub["data"]["graph"]

    try:
        import oasis as oasis_runtime  # noqa: F401
        runtime = "camel-oasis"
        status = "starting"
    except ImportError:
        runtime = "none"
        status = "queued"

    # Frame 0 of the network animation: the generated ties, before activity.
    simulation = {
        "status": status,
        "platform": body.platform,
        "timesteps": body.timesteps,
        "activate_fraction": body.activate_fraction,
        "content_under_test": body.content_under_test,
        "frames": [{"t": 0, "nodes": len(graph["nodes"]), "edges": graph["edges"]}],
        "estimated_llm_calls": int(len(graph["nodes"]) * body.activate_fraction) * body.timesteps,
    }
    record = save_artifact(
        user_id,
        "social_mirror",
        "simulation",
        simulation,
        provenance={"persona_hub_id": body.persona_hub_id, "runtime": runtime},
    )
    return envelope(
        data=simulation,
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        warnings=[] if runtime != "none" else ["camel-oasis not installed; simulation queued"],
    )


@router.get("/simulations/{sim_id}", operation_id="social_get")
def get_simulation(sim_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "social_mirror", sim_id)
    if record is None:
        raise HTTPException(status_code=404, detail="simulation not found")
    return envelope(data=record["data"], artifact_id=sim_id, provenance=record["provenance"])
