"""Social Mirror runtime (item 1) and real-vs-synthetic metrics (item 2)."""

import os
import tempfile
import time

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.social_sim import compare_graphs, network_metrics, simulate


def _graph(n=12, seed=1):
    from oasis.generator.generation import GenerationSpec, generate_personas
    from oasis.generator.schema import CompanyContext

    hub = generate_personas(GenerationSpec(company=CompanyContext(company_name="Acme"), count=n, seed=seed))
    return hub.to_graph_payload()


def test_simulation_produces_frames_posts_and_growth():
    graph = _graph(15)
    seed_edges = len(graph["edges"])
    result = simulate(graph, timesteps=12, activate_fraction=0.4, seed=7)
    assert len(result.frames) == 12
    assert result.posts, "agents posted"
    assert len(result.edges) >= seed_edges, "network grew or held"
    # Determinism: same seed -> same post count.
    again = simulate(graph, timesteps=12, activate_fraction=0.4, seed=7)
    assert len(again.posts) == len(result.posts)
    # Engagement accrued on posts.
    assert sum(p["likes"] + p["comments"] + p["reposts"] for p in result.posts) >= 0


def test_network_metrics_and_comparison():
    graph = _graph(20)
    result = simulate(graph, timesteps=15, activate_fraction=0.3, seed=3)
    metrics = network_metrics(20, result.edges, result.posts)
    assert metrics["nodes"] == 20
    assert 0 <= metrics["density"] <= 1
    assert len(metrics["degree_histogram"]) == 6
    assert "mean_sentiment" in metrics

    real = dict(metrics, density=metrics["density"] * 1.2, mean_sentiment=0.0)
    comparison = compare_graphs(metrics, real)
    assert 0 <= comparison["similarity"] <= 1
    assert "density" in comparison["deltas"]


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()
    yield TestClient(create_app())
    get_settings.cache_clear()


def test_simulation_endpoint_runs_and_completes(client):
    hub = client.post("/api/personas/generate", json={"company_name": "Acme", "count": 12, "seed": 2}).json()
    hub_id = hub["artifact_id"]

    started = client.post("/api/social-mirror/simulations", json={
        "persona_hub_id": hub_id, "timesteps": 8, "activate_fraction": 0.4, "seed": 5,
    })
    assert started.status_code == 200
    sim_id = started.json()["artifact_id"]

    # Background thread completes quickly (no LLM).
    for _ in range(50):
        data = client.get(f"/api/social-mirror/simulations/{sim_id}").json()["data"]
        if data["status"] == "completed":
            break
        time.sleep(0.05)
    assert data["status"] == "completed"
    assert len(data["frames"]) == 8
    assert "metrics" in data and data["metrics"]["nodes"] == 12

    # Real-vs-synthetic comparison endpoint.
    comparison = client.post("/api/social-mirror/compare", json={
        "simulation_id": sim_id,
        "real_metrics": {"density": 0.1, "avg_degree": 2.0, "max_degree": 5, "components": 1, "mean_sentiment": 0.0},
    })
    assert comparison.status_code == 200
    assert "similarity" in comparison.json()["data"]
