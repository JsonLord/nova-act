"""NovaEngine adapter (item 3): keyless nova-compat runs without the API key."""

import json
import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest

from backend.app.engines import resolve_engine
from backend.app.engines.nova_engine import nova_sdk_available, run_journey_nova
from backend.app.engines.open_engine import find_chromium

PAGE = (
    "data:text/html,"
    "<h1>Shop</h1><button id='t'>Tent</button>"
    "<script>document.getElementById('t').onclick=()=>{"
    "document.body.innerHTML+='<div>added</div>'}</script>"
)


def test_resolution_nova_is_executable_without_key(monkeypatch):
    """USERSYNC_ENGINE=nova runs keyless (nova-compat) when no key is set."""
    monkeypatch.setenv("USERSYNC_ENGINE", "nova")
    monkeypatch.delenv("NOVA_ACT_API_KEY", raising=False)
    from backend.app.config import get_settings

    get_settings.cache_clear()
    choice = resolve_engine()
    assert choice.name == "nova"
    assert nova_sdk_available() is False  # no key -> no Amazon
    if find_chromium() is not None:
        assert choice.executable is True  # keyless BYOK loop can still run
        assert "keyless nova-compat" in choice.reason
    get_settings.cache_clear()


def test_auto_stays_keyless_without_key(monkeypatch):
    monkeypatch.setenv("USERSYNC_ENGINE", "auto")
    monkeypatch.delenv("NOVA_ACT_API_KEY", raising=False)
    from backend.app.config import get_settings

    get_settings.cache_clear()
    choice = resolve_engine()
    # auto without a key resolves to the open (keyless) engine, never nova.
    assert choice.name == "open"
    get_settings.cache_clear()


@pytest.mark.skipif(find_chromium() is None, reason="no chromium available")
def test_keyless_nova_runs_the_byok_loop(tmp_path, monkeypatch):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("NOVA_ACT_API_KEY", raising=False)
    from backend.app.config import get_settings

    get_settings.cache_clear()
    script = iter([
        json.dumps({"think": "click the tent", "action": "agentClick", "args": {"index": 0}}),
        json.dumps({"think": "done", "action": "return", "args": {"value": "ok"}}),
    ])
    run = {"target_url": PAGE, "goal": "add tent", "act_prompt": "", "steering": {}, "steps": []}
    provenance = {"engine": "nova"}
    run_journey_nova("u", "run-novacompat", run, lambda s, u: next(script), provenance)

    assert run["status"] == "completed" and run["result"] == "ok"
    # Provenance records the keyless path — no Amazon key was involved.
    assert provenance["engine"] == "nova-compat (keyless BYOK)"
    get_settings.cache_clear()
