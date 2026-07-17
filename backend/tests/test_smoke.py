"""Smoke tests: every pack answers, artifacts flow between packs, credits meter."""

import os
import tempfile

os.environ["USERSYNC_DATA_DIR"] = tempfile.mkdtemp(prefix="usersync-test-")

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.main import create_app  # noqa: E402

client = TestClient(create_app())


def test_healthz_lists_all_packs():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert "personas" in response.json()["packs"]


def test_persona_generation_and_steering_flow():
    response = client.post(
        "/api/personas/generate",
        json={"company_name": "Acme", "product_name": "Storefront", "count": 8, "seed": 7},
    )
    assert response.status_code == 200
    body = response.json()
    hub_id = body["artifact_id"]
    assert body["data"]["count"] == 8
    assert body["quota"]["credits_remaining"] < 1000

    steering = client.get(f"/api/personas/{hub_id}/steering/0", params={"goal": "buy a tent"})
    assert steering.status_code == 200
    config = steering.json()["data"]["steering"]
    assert {"observing", "thinking", "acting"} <= set(config.keys())
    assert "buy a tent" in steering.json()["data"]["act_prompt"]


def test_unify_company_mode_shapes_generation():
    unify = client.post(
        "/api/datahub/unify",
        json={
            "mode": "company_social",
            "crm_records": [
                {"age": 61, "gender": "female", "country": "Germany", "support_tickets": 4, "nps": -20},
                {"age": 66, "gender": "male", "country": "Germany", "support_tickets": 2, "nps": 10},
            ],
            "research_drop": {"sentiment": -0.5, "top_topics": ["checkout", "pricing"]},
        },
    )
    assert unify.status_code == 200
    traits_id = unify.json()["artifact_id"]
    traits = unify.json()["data"]
    assert traits["age_range"] == [61, 66]
    assert traits["patience_mean"] < 3.5  # support tickets lowered patience
    assert max(traits["brand_affinity"], key=traits["brand_affinity"].get) == "-1"

    generated = client.post(
        "/api/personas/generate",
        json={"company_name": "Acme", "count": 5, "seed": 1, "unified_traits_id": traits_id},
    )
    assert generated.status_code == 200
    ages = [n["profile"]["age"] for n in generated.json()["data"]["graph"]["nodes"]]
    assert all(61 <= age <= 66 for age in ages)  # pool mimics the customer base


def test_action_trace_analysis_and_decisions():
    runs = {
        "runs": [
            {"run_id": "r1", "persona_id": "p1", "steps": [
                {"action": "agentClick", "x": 0.5, "y": 0.2, "think": "easy to find the button"},
                {"action": "agentScroll", "x": 0.5, "y": 0.6, "think": "scrolling for details"},
            ]},
            {"run_id": "r2", "persona_id": "p2", "steps": [
                {"action": "agentClick", "x": 0.5, "y": 0.2, "think": "text too small cannot read"},
                {"action": "agentScroll", "x": 0.5, "y": 0.6, "think": "lost where is checkout"},
            ]},
        ]
    }
    response = client.post("/api/analysis/action-trace", json=runs)
    assert response.status_code == 200
    graph_id = response.json()["artifact_id"]
    sims = response.json()["data"]["similarities"]
    assert sims[0]["heatmap_similarity"] == 1.0  # identical paths

    decisions = client.post("/api/analysis/decisions", json={"action_trace_graph_id": graph_id})
    assert decisions.status_code == 200
    findings = decisions.json()["data"]["findings"]
    assert findings and findings[0]["kind"] == "same_path_different_experience"

    qa = client.post("/api/graph-research/qa", json={"graph_id": graph_id})
    assert qa.status_code == 200
    assert qa.json()["data"]["qa"][0]["grounded_node_ids"]


def test_ux_chain_simulated_pieces():
    response = client.post("/api/ux-chain/runs", json={"mode": "ux_analysis", "target_url": "https://example.com"})
    assert response.status_code == 200
    pieces = response.json()["data"]["pieces"]
    assert [p["kind"] for p in pieces] == ["screenshot_heatmap", "problem", "solution"]
    assert pieces[2]["code"] and pieces[2]["rendered"]  # both card representations
    assert response.json()["warnings"]  # simulated flagged

    modes = client.get("/api/ux-chain/modes")
    assert [m["id"] for m in modes.json()["data"]] == ["ux_analysis", "user_journey", "design_iteration"]


def test_mcp_manifest_and_account():
    manifest = client.get("/mcp")
    names = [t["name"] for t in manifest.json()["tools"]]
    assert "usersync.personas.personas_generate" in names
    assert "usersync.analysis.analysis_decisions" in names

    usage = client.get("/api/account/usage")
    assert usage.status_code == 200
    assert usage.json()["data"]["usage"]  # metering recorded the calls above


def test_standalone_pack_selection():
    os.environ["USERSYNC_PACKS"] = "personas,account"
    from backend.app.config import get_settings

    get_settings.cache_clear()
    standalone = TestClient(create_app())
    assert standalone.get("/healthz").json()["packs"] == ["personas", "account"]
    # Disabled pack routes don't exist: 404, or 405 when the frontend static
    # mount catches the path with a method it doesn't serve.
    assert standalone.post("/api/ux-chain/runs", json={"mode": "ux_analysis"}).status_code in (404, 405)
    os.environ["USERSYNC_PACKS"] = "all"
    get_settings.cache_clear()
