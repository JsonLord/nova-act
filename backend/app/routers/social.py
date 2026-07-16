"""Social Mirror API: run the persona hub as a living social network.

The built-in simulator (`backend/app/social_sim.py`) runs the OASIS social
model over the generated persona graph on CPU — activation schedules,
persona-driven action policy, preferential-attachment recsys — producing
per-timestep frames for the network animation and network metrics for the
real-vs-synthetic comparison (spec Tab 6). An optional BYOK text model
composes post content; without it the run is seeded-deterministic.
"""

from __future__ import annotations

import threading
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
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
    seed: int = 42
    use_llm_content: bool = False  # compose post text via BYOK text model
    content_under_test: str = ""


def _run_simulation(user_id: str, sim_id: str, body: SimulationRequest, graph: dict, llm_call, provenance: dict) -> None:
    from backend.app.social_sim import compare_graphs, network_metrics, simulate

    result = simulate(
        graph,
        timesteps=body.timesteps,
        activate_fraction=body.activate_fraction,
        seed=body.seed,
        platform=body.platform,
        llm=llm_call,
    )
    synthetic = network_metrics(len(graph["nodes"]), result.edges, result.posts)
    # Real-vs-synthetic: compare against a real social graph snapshot if the
    # hub carries one (DataHub monitoring import), else metrics stand alone.
    real = graph.get("real_social_metrics")
    simulation = {
        "status": "completed",
        "platform": body.platform,
        "timesteps": body.timesteps,
        "activate_fraction": body.activate_fraction,
        "content_under_test": body.content_under_test,
        **result.to_dict(),
        "metrics": synthetic,
        "comparison": compare_graphs(synthetic, real) if real else None,
    }
    save_artifact(user_id, "social_mirror", "simulation", simulation, provenance=provenance, artifact_id=sim_id)


@router.post("/simulations", operation_id="social_simulate")
def create_simulation(
    body: SimulationRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("social_simulation", cost=10)),
):
    hub = load_artifact(user_id, "personas", body.persona_hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="persona hub not found")
    graph = hub["data"]["graph"]

    llm_call = None
    warnings: list[str] = []
    if body.use_llm_content:
        from backend.app.llm import chat_sync
        from backend.app.llm_config import resolve_llm

        text_llm = resolve_llm(request, user_id, "text")
        if text_llm is not None:
            llm_call = lambda prompt: chat_sync(text_llm, prompt, temperature=0.9)  # noqa: E731
        else:
            warnings.append("use_llm_content set but no BYOK text model; using templated content")

    seed = {
        "status": "running",
        "platform": body.platform,
        "timesteps": body.timesteps,
        "frames": [{"t": 0, "active": [], "new_posts": [], "new_edges": [], "engagement": {}}],
        "estimated_llm_calls": int(len(graph["nodes"]) * body.activate_fraction) * body.timesteps if llm_call else 0,
    }
    provenance = {"persona_hub_id": body.persona_hub_id, "runtime": "usersync-social-sim", "seed": body.seed}
    record = save_artifact(user_id, "social_mirror", "simulation", seed, provenance=provenance)

    threading.Thread(
        target=_run_simulation,
        args=(user_id, record["artifact_id"], body, graph, llm_call, provenance),
        daemon=True,
    ).start()

    return envelope(
        data=seed,
        artifact_id=record["artifact_id"],
        provenance=provenance,
        quota=meter,
        warnings=warnings,
        next_actions=[{"action": "poll", "endpoint": f"/api/social-mirror/simulations/{record['artifact_id']}"}],
    )


@router.get("/simulations/{sim_id}", operation_id="social_get")
def get_simulation(sim_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "social_mirror", sim_id)
    if record is None:
        raise HTTPException(status_code=404, detail="simulation not found")
    return envelope(data=record["data"], artifact_id=sim_id, provenance=record["provenance"])


class CompareRequest(BaseModel):
    simulation_id: str
    real_metrics: dict  # {density, avg_degree, max_degree, components, mean_sentiment}


@router.post("/compare", operation_id="social_compare")
def compare(body: CompareRequest, user_id: str = Depends(get_user_id)):
    """Compare a completed simulation's synthetic network against a real
    social-analysis graph's metrics (spec Tab 6 real-vs-synthetic)."""
    from backend.app.social_sim import compare_graphs

    record = load_artifact(user_id, "social_mirror", body.simulation_id)
    if record is None or "metrics" not in record["data"]:
        raise HTTPException(status_code=404, detail="completed simulation not found")
    comparison = compare_graphs(record["data"]["metrics"], body.real_metrics)
    return envelope(data=comparison, artifact_id=body.simulation_id)
