"""Adapter for a deployed screenshot-to-code instance (JsonLord/screenshot-to-code).

Speaks the repo's actual protocol (verified against the vendored fork):

- WebSocket ``/generate-code``: the client sends ONE JSON params object —
  ``generatedCodeConfig`` (stack: html_css | html_tailwind | react_tailwind |
  bootstrap | ionic_tailwind | vue_tailwind), ``inputMode`` (image | video |
  text), ``prompt`` ({text, images: [data URLs], videos: []}),
  ``generationType`` (create | update), ``history``, and optional per-request
  API keys. The server streams ``{"type": chunk|status|setCode|
  variantComplete|error, "value": ..., "variantIndex": n}`` and delivers the
  full code of each variant via ``setCode`` followed by ``variantComplete``.

- REST ``POST /api/screenshot`` ``{url, apiKey}`` -> ``{url}``: captures a
  live-URL screenshot (screenshotone.com key) usable as chain piece 1.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

STACKS = ["html_css", "html_tailwind", "react_tailwind", "bootstrap", "ionic_tailwind", "vue_tailwind"]


def _ws_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.startswith("https://"):
        return "wss://" + base[len("https://"):] + "/generate-code"
    if base.startswith("http://"):
        return "ws://" + base[len("http://"):] + "/generate-code"
    return base + "/generate-code"


async def generate_code(
    base_url: str,
    instructions: str,
    image_data_url: str = "",
    stack: str = "html_tailwind",
    generation_type: str = "create",
    existing_code: str | None = None,
    timeout_s: float = 300.0,
) -> str | None:
    """Run one generation and return the first completed variant's code.

    ``existing_code`` switches to an update turn (optimize-this-code), which
    is exactly the chain's piece-3 second pass: generate from screenshot,
    then update against the identified UX problem.
    """
    try:
        import websockets
    except ImportError:
        return None

    params: dict[str, Any] = {
        "generatedCodeConfig": stack if stack in STACKS else "html_tailwind",
        "inputMode": "image" if image_data_url else "text",
        "generationType": generation_type,
        "isImageGenerationEnabled": False,
        "prompt": {
            "text": instructions,
            "images": [image_data_url] if image_data_url else [],
            "videos": [],
        },
        "history": (
            [{"role": "assistant", "content": {"text": existing_code, "images": [], "videos": []}}]
            if existing_code
            else []
        ),
    }
    codes: dict[int, str] = {}
    try:
        async with websockets.connect(_ws_url(base_url), open_timeout=30) as socket:
            await socket.send(json.dumps(params))
            while True:
                try:
                    raw = await __import__("asyncio").wait_for(socket.recv(), timeout=timeout_s)
                except TimeoutError:
                    break
                message = json.loads(raw)
                kind = message.get("type")
                index = int(message.get("variantIndex") or 0)
                if kind == "setCode":
                    codes[index] = message.get("value", "")
                elif kind == "variantComplete" and index in codes:
                    return codes[index]
                elif kind == "error":
                    break
    except Exception:
        return codes.get(0) or None
    return codes.get(0) or None


async def capture_screenshot(base_url: str, target_url: str, screenshot_api_key: str) -> str | None:
    """POST /api/screenshot: capture a live URL; returns an image URL/data URL."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{base_url.rstrip('/')}/api/screenshot",
                json={"url": target_url, "apiKey": screenshot_api_key},
            )
            response.raise_for_status()
            return response.json().get("url")
    except httpx.HTTPError:
        return None
