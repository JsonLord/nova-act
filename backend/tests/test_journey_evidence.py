"""Per-step screenshots/heatmap capture and analysis auto-trigger (items 5+6)."""

import json
import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest

from backend.app.engines.open_engine import find_chromium, run_journey

PAGE = (
    "data:text/html,"
    "<h1>Shop</h1><button id='t'>Tent</button>"
    "<script>document.getElementById('t').onclick=()=>{"
    "document.body.innerHTML+='<div>added</div>'}</script>"
)


@pytest.mark.skipif(find_chromium() is None, reason="no chromium available")
def test_journey_captures_screenshots_and_heatmap(tmp_path, monkeypatch):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()
    script = iter([
        json.dumps({"think": "click the tent", "action": "agentClick", "args": {"index": 0}}),
        json.dumps({"think": "done", "action": "return", "args": {"value": "ok"}}),
    ])
    run = {"target_url": PAGE, "goal": "add tent", "act_prompt": "", "steering": {}, "steps": []}
    run_journey("u", "run-shot", run, lambda s, u: next(script), provenance={"engine": "open"})

    assert run["status"] == "completed"
    assert len(run["screenshots"]) >= 1
    # Screenshot files exist on disk and are PNGs.
    shot_path = tmp_path / run["screenshots"][0]
    assert shot_path.is_file() and shot_path.read_bytes()[:4] == b"\x89PNG"
    # Heatmap accumulated the click location.
    assert run["heatmap"] and sum(sum(row) for row in run["heatmap"]) >= 1
    # The click step references its screenshot.
    click_step = run["steps"][0]
    assert click_step["screenshot"] is not None
    get_settings.cache_clear()


def test_orchestrate_analysis_triggers_on_two_completed_runs(tmp_path, monkeypatch):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings
    from backend.app.routers.journeys import orchestrate_analysis
    from backend.app.storage import load_artifact, save_artifact

    get_settings.cache_clear()

    def make_run(rid, path_x):
        save_artifact(
            "u", "journeys", "journey_run",
            {"status": "completed", "goal": "buy tent", "steps": [
                {"action": "agentClick", "x": path_x, "y": 0.2, "think": "found it easily"},
                {"action": "return", "x": 0, "y": 0, "think": "done"},
            ]},
            provenance={"persona_hub_id": "hub1"}, artifact_id=rid,
        )

    # One completed run -> nothing to compare.
    make_run("r1", 0.5)
    assert orchestrate_analysis("u", "buy tent") is None

    # Two completed runs on the same goal -> graph + decisions built.
    make_run("r2", 0.9)
    result = orchestrate_analysis("u", "buy tent")
    assert result and result["runs_compared"] == 2
    graph = load_artifact("u", "analyses", result["action_trace_graph_id"])
    assert graph["data"]["variant"] == "action-trace"
    assert graph["data"]["similarities"]  # pairwise similarity computed
    assert result["decision_set_id"]  # decision set produced
    get_settings.cache_clear()
