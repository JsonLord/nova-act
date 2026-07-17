"""Adapter test against a fake server speaking the fork's real WS protocol
(setCode + variantComplete messages, one params object from the client)."""

import asyncio
import json

import pytest
import websockets

from backend.app.adapters.screenshot_to_code import _ws_url, generate_code


@pytest.mark.asyncio
async def test_generate_code_speaks_fork_protocol():
    received: list[dict] = []

    async def fake_server(socket):
        params = json.loads(await socket.recv())
        received.append(params)
        await socket.send(json.dumps({"type": "status", "value": "Generating code...", "variantIndex": 0}))
        await socket.send(json.dumps({"type": "chunk", "value": "<div>", "variantIndex": 0}))
        code = "<div>optimized</div>" if params["generationType"] == "update" else "<div>initial</div>"
        await socket.send(json.dumps({"type": "setCode", "value": code, "variantIndex": 0}))
        await socket.send(json.dumps({"type": "variantComplete", "value": "", "variantIndex": 0}))

    async with websockets.serve(fake_server, "127.0.0.1", 8977):
        code = await generate_code(
            "http://127.0.0.1:8977",
            instructions="Recreate this screen exactly.",
            image_data_url="data:image/png;base64,AAAA",
            stack="html_tailwind",
        )
        assert code == "<div>initial</div>"

        optimized = await generate_code(
            "http://127.0.0.1:8977",
            instructions="Fix the CTA placement.",
            image_data_url="data:image/png;base64,AAAA",
            generation_type="update",
            existing_code=code,
        )
        assert optimized == "<div>optimized</div>"

    create_params, update_params = received
    assert create_params["generatedCodeConfig"] == "html_tailwind"
    assert create_params["inputMode"] == "image"
    assert create_params["prompt"]["images"] == ["data:image/png;base64,AAAA"]
    assert update_params["generationType"] == "update"
    assert update_params["history"][0]["content"]["text"] == "<div>initial</div>"


@pytest.mark.asyncio
async def test_generate_code_unreachable_returns_none():
    assert await generate_code("http://127.0.0.1:1", instructions="x", timeout_s=2) is None


def test_ws_url_scheme_mapping():
    assert _ws_url("https://my.space") == "wss://my.space/generate-code"
    assert _ws_url("http://localhost:7001/") == "ws://localhost:7001/generate-code"
