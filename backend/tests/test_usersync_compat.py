"""The UserSync Space frontend's same-origin surface, backed by real services."""

from __future__ import annotations

import time

from fastapi.testclient import TestClient

from backend.app.main import create_app


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()
    return TestClient(create_app())


def test_auth_aliases(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    # /api/user without a cookie -> 401 (the frontend treats it as signed-out).
    assert client.get("/api/user").status_code == 401
    client.cookies.set("hf_user", '{"preferred_username": "leon"}')
    assert client.get("/api/user").json()["preferred_username"] == "leon"
    assert client.get("/api/logout").json() == {"ok": True}
    # /login redirects into the OAuth router.
    response = client.get("/login", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/api/auth/login"


def test_generate_then_list_focus_groups(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    response = client.post(
        "/api/v1/personas/generate",
        json={
            "business_description": "An outdoor gear webshop",
            "customer_profile": "Weekend hikers in Europe",
            "num_personas": 5,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["num_personas"] == 5
    assert len(body["personas"]) == 5
    hub_id = body["focus_group_id"]

    groups = client.get("/api/v1/personas").json()["focus_groups"]
    assert any(g["id"] == hub_id for g in groups)
    assert groups[0]["count"] == 5

    # Deterministic: same brief -> same seed -> same personas.
    again = client.post(
        "/api/v1/personas/generate",
        json={
            "business_description": "An outdoor gear webshop",
            "customer_profile": "Weekend hikers in Europe",
            "num_personas": 5,
        },
    ).json()
    assert [p["username"] for p in again["personas"]] == [
        p["username"] for p in body["personas"]
    ]


def test_network_graph(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    hub = client.post(
        "/api/v1/personas/generate",
        json={"business_description": "A news app", "customer_profile": "", "num_personas": 6},
    ).json()
    graph = client.get(f"/api/v1/network/{hub['focus_group_id']}").json()
    assert len(graph["nodes"]) == 6
    assert all("name" in n for n in graph["nodes"])
    # Name-based and fallback resolution both work.
    assert client.get(f"/api/v1/network/{hub['focus_group_name']}").status_code == 200
    assert client.get("/api/v1/network/anything").status_code == 200  # falls back to latest


def test_simulation_lifecycle(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    hub = client.post(
        "/api/v1/personas/generate",
        json={"business_description": "A fintech app", "customer_profile": "", "num_personas": 4},
    ).json()
    started = client.post(
        "/api/v1/simulations",
        json={
            "focus_group_id": hub["focus_group_id"],
            "content_type": "text",
            "content_payload": "We are launching zero-fee transfers!",
            "parameters": {},
        },
    )
    assert started.status_code == 200
    job_id = started.json()["job_id"]
    sim_id = started.json()["simulation_id"]

    # Poll by job id until the bounded pool finishes the run.
    for _ in range(50):
        status = client.get(f"/api/v1/simulations/{job_id}").json()
        if status.get("status") == "completed":
            break
        time.sleep(0.1)
    assert status["status"] == "completed"
    assert len(status["reactions"]) == 4
    assert status["summary"]["personas"] == 4
    assert status["summary"]["voiced_by_llm"] is False  # no BYOK -> deterministic
    assert all(-1 <= r["sentiment"] <= 1 for r in status["reactions"])

    # Also resolvable directly by simulation artifact id.
    assert client.get(f"/api/v1/simulations/{sim_id}").json()["status"] == "completed"
    # Unknown id -> 404 (frontend shows the in-progress hint).
    assert client.get("/api/v1/simulations/nope").status_code == 404


def test_simulation_without_group_404s(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    response = client.post(
        "/api/v1/simulations",
        json={"focus_group_id": "", "content_type": "text", "content_payload": "hi", "parameters": {}},
    )
    assert response.status_code == 404


def test_craft_requires_byok(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    response = client.post("/api/craft", json={"content": "New landing page copy"})
    assert response.status_code == 422  # strictly BYOK — no server-side key
    assert "BYOK" in response.json()["detail"]


def test_save_and_list_data(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    saved = client.post(
        "/api/save-data",
        json={"type": "assemble", "data": {"groupName": "Hikers"}, "user": "leon"},
    )
    assert saved.json()["success"] is True
    records = client.get("/api/list-data", params={"type": "assemble", "user": "leon"}).json()
    assert len(records) == 1
    assert records[0]["data"]["groupName"] == "Hikers"
    # Filters exclude non-matching users.
    assert client.get("/api/list-data", params={"user": "other"}).json() == []


def test_tab_runner(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    tabs = client.get("/api/tabs").json()
    assert [t["id"] for t in tabs][:2] == ["focus-groups", "generate-personas"]

    generated = client.post(
        "/api/tabs/generate-personas/run",
        json={"business_description": "A B2B CRM", "customer_profile": "Sales leads", "num_personas": 3},
    ).json()
    assert generated["result"]["num_personas"] == 3

    matches = client.post(
        "/api/tabs/identify-personas/run", json={"context": "sales manager crm"}
    ).json()
    assert "matches" in matches["result"]

    network = client.post("/api/tabs/social-network/run", json={"name": ""}).json()
    assert len(network["result"]["nodes"]) == 3

    # Chat persistence round-trips.
    client.post(
        "/api/tabs/chat-message/run",
        json={"simulation_id": "sim-1", "sender": "User", "message": "hello group"},
    )
    history = client.post("/api/tabs/chat-history/run", json={"simulation_id": "sim-1"}).json()
    assert history["result"]["history"][0]["message"] == "hello group"

    # Variants: deterministic fallback without BYOK.
    variants = client.post(
        "/api/tabs/variants/run", json={"content_text": "Buy now", "num_variants": 4}
    ).json()
    assert len(variants["result"]["variants"]) == 4
    assert variants["result"]["voiced_by_llm"] is False

    exported = client.post(
        "/api/tabs/export/run", json={"action": "list_personas", "simulation_id": ""}
    ).json()
    assert len(exported["result"]["focus_groups"]) == 1

    assert client.post("/api/tabs/nope/run", json={}).status_code == 404


def test_tab_bus_and_openapi_alias(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    published = client.post(
        "/api/tabs/events",
        json={"source": "frontend", "target": "usersync", "action": "view.changed", "payload": {"view": "simulation"}},
    )
    assert published.json()["ok"] is True
    events = client.get("/api/tabs/events").json()["events"]
    assert events[-1]["action"] == "view.changed"
    assert "/api/v1/personas" in client.get("/api/openapi.json").json()["paths"]
