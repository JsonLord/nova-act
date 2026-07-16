"""Vision-mode engine path (item 4): set-of-marks annotation + VLM decisions."""

import json
import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest

from backend.app.engines.open_engine import find_chromium, run_journey
from backend.app.perception import annotate_set_of_marks

PAGE = (
    "data:text/html,"
    "<h1>Shop</h1><button id='t'>Tent</button>"
    "<script>document.getElementById('t').onclick=()=>{"
    "document.body.innerHTML+='<div>added</div>'}</script>"
)


def _png(width=40, height=30):
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (width, height), (255, 255, 255)).save(buf, format="PNG")
    return buf.getvalue()


def test_annotate_set_of_marks_returns_png():
    elements = [{"index": 0, "x": 0.5, "y": 0.5, "w": 0.2, "h": 0.1, "text": "Buy"}]
    out = annotate_set_of_marks(_png(), elements)
    assert out[:4] == b"\x89PNG"
    assert out != _png()  # boxes were drawn


@pytest.mark.skipif(find_chromium() is None, reason="no chromium available")
def test_journey_uses_vision_call_when_provided(tmp_path, monkeypatch):
    monkeypatch.setenv("USERSYNC_DATA_DIR", str(tmp_path))
    from backend.app.config import get_settings

    get_settings.cache_clear()

    got_images = []
    script = iter([
        json.dumps({"think": "I see the tent button in the screenshot", "action": "agentClick", "args": {"index": 0}}),
        json.dumps({"think": "done", "action": "return", "args": {"value": "ok"}}),
    ])

    def vision_call(system, user, image_b64):
        got_images.append(image_b64)
        return next(script)

    def text_call(system, user):
        raise AssertionError("text llm must not be used in vision mode")

    run = {"target_url": PAGE, "goal": "add tent", "act_prompt": "", "steering": {}, "steps": []}
    run_journey("u", "run-vision", run, text_call, provenance={"engine": "open"}, vision_call=vision_call)

    assert run["status"] == "completed"
    assert got_images and got_images[0]  # the annotated screenshot was sent
    # It was valid base64 of a PNG.
    import base64

    assert base64.b64decode(got_images[0])[:4] == b"\x89PNG"
    get_settings.cache_clear()
