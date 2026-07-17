"""Provider-agnostic chat over a ResolvedLlm (BYOK, spec.md Tab 7/§17).

One request builder, three API styles (openai-compatible incl. HF Inference
Providers router and custom endpoints; anthropic; gemini), exposed as both
``chat`` (async, request handlers) and ``chat_sync`` (threads: the open
engine loop, batch enrichment workers).
"""

from __future__ import annotations

from typing import Any

import httpx

from backend.app.llm_config import ResolvedLlm


class LlmCallError(RuntimeError):
    pass


def _build_request(
    llm: ResolvedLlm,
    prompt: str,
    system: str,
    images: list[str],
    temperature: float,
) -> dict[str, Any]:
    """Return kwargs for httpx request() covering all three API styles."""
    if images and llm.modality != "vision":
        raise LlmCallError("images passed to a text-only slot; configure a vision model")
    base = llm.base_url.rstrip("/")

    if llm.api_style == "openai":
        content: list[dict] | str
        if images:
            content = [{"type": "text", "text": prompt}] + [
                {"type": "image_url", "image_url": {"url": _as_data_url(image)}} for image in images
            ]
        else:
            content = prompt
        messages = ([{"role": "system", "content": system}] if system else []) + [
            {"role": "user", "content": content}
        ]
        return {
            "method": "POST",
            "url": f"{base}/chat/completions",
            "headers": {"Authorization": f"Bearer {llm.api_key}"},
            "json": {"model": llm.model, "messages": messages, "temperature": temperature},
        }

    if llm.api_style == "anthropic":
        blocks: list[dict] = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": _strip_data_url(image)},
            }
            for image in images
        ] + [{"type": "text", "text": prompt}]
        return {
            "method": "POST",
            "url": f"{base}/messages",
            "headers": {"x-api-key": llm.api_key, "anthropic-version": "2023-06-01"},
            "json": {
                "model": llm.model,
                "max_tokens": 4096,
                **({"system": system} if system else {}),
                "messages": [{"role": "user", "content": blocks}],
            },
        }

    if llm.api_style == "gemini":
        parts: list[dict] = [{"text": (f"{system}\n\n" if system else "") + prompt}] + [
            {"inline_data": {"mime_type": "image/png", "data": _strip_data_url(image)}}
            for image in images
        ]
        return {
            "method": "POST",
            "url": f"{base}/v1beta/models/{llm.model}:generateContent",
            "params": {"key": llm.api_key},
            "json": {"contents": [{"role": "user", "parts": parts}]},
        }

    raise LlmCallError(f"Unknown api_style: {llm.api_style}")


def _parse_response(llm: ResolvedLlm, response: httpx.Response) -> str:
    if response.status_code >= 400:
        raise LlmCallError(
            f"{llm.provider}/{llm.model} returned {response.status_code}: {response.text[:300]}"
        )
    body = response.json()
    if llm.api_style == "openai":
        return body["choices"][0]["message"]["content"]
    if llm.api_style == "anthropic":
        return "".join(block.get("text", "") for block in body["content"])
    candidates = body.get("candidates", [])
    if not candidates:
        raise LlmCallError("gemini returned no candidates")
    return "".join(part.get("text", "") for part in candidates[0]["content"]["parts"])


async def chat(
    llm: ResolvedLlm,
    prompt: str,
    system: str = "",
    images_b64: list[str] | None = None,
    temperature: float = 0.7,
    timeout_s: float = 120.0,
) -> str:
    request = _build_request(llm, prompt, system, images_b64 or [], temperature)
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        return _parse_response(llm, await client.request(**request))


def chat_sync(
    llm: ResolvedLlm,
    prompt: str,
    system: str = "",
    images_b64: list[str] | None = None,
    temperature: float = 0.7,
    timeout_s: float = 120.0,
) -> str:
    request = _build_request(llm, prompt, system, images_b64 or [], temperature)
    with httpx.Client(timeout=timeout_s) as client:
        return _parse_response(llm, client.request(**request))


def _as_data_url(image: str) -> str:
    return image if image.startswith("data:") else f"data:image/png;base64,{image}"


def _strip_data_url(image: str) -> str:
    return image.partition(",")[2] if image.startswith("data:") else image
