"""Provider-agnostic chat call over a ResolvedLlm (BYOK, spec.md Tab 7/§17).

One function, three API styles:
- openai:    POST {base_url}/chat/completions  (OpenAI, HF Inference Providers
             router, Blablador, custom OpenAI-compatible)
- anthropic: POST {base_url}/messages
- gemini:    POST {base_url}/v1beta/models/{model}:generateContent

Text-only calls pass no images; multimodal calls attach data-URL/base64
images in the provider's shape. Returns the assistant text or raises
LlmCallError with the provider detail.
"""

from __future__ import annotations

import httpx

from backend.app.llm_config import ResolvedLlm


class LlmCallError(RuntimeError):
    pass


async def chat(
    llm: ResolvedLlm,
    prompt: str,
    system: str = "",
    images_b64: list[str] | None = None,
    temperature: float = 0.7,
    timeout_s: float = 120.0,
) -> str:
    images = images_b64 or []
    if images and llm.modality != "vision":
        raise LlmCallError("images passed to a text-only slot; configure a vision model")

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        if llm.api_style == "openai":
            content: list[dict] | str
            if images:
                content = [{"type": "text", "text": prompt}] + [
                    {"type": "image_url", "image_url": {"url": _as_data_url(image)}}
                    for image in images
                ]
            else:
                content = prompt
            messages = ([{"role": "system", "content": system}] if system else []) + [
                {"role": "user", "content": content}
            ]
            response = await client.post(
                f"{llm.base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {llm.api_key}"},
                json={"model": llm.model, "messages": messages, "temperature": temperature},
            )
            _raise_for_status(response, llm)
            return response.json()["choices"][0]["message"]["content"]

        if llm.api_style == "anthropic":
            blocks: list[dict] = [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": "image/png", "data": _strip_data_url(image)},
                }
                for image in images
            ] + [{"type": "text", "text": prompt}]
            response = await client.post(
                f"{llm.base_url.rstrip('/')}/messages",
                headers={"x-api-key": llm.api_key, "anthropic-version": "2023-06-01"},
                json={
                    "model": llm.model,
                    "max_tokens": 4096,
                    **({"system": system} if system else {}),
                    "messages": [{"role": "user", "content": blocks}],
                },
            )
            _raise_for_status(response, llm)
            return "".join(b.get("text", "") for b in response.json()["content"])

        if llm.api_style == "gemini":
            parts: list[dict] = [{"text": (f"{system}\n\n" if system else "") + prompt}] + [
                {"inline_data": {"mime_type": "image/png", "data": _strip_data_url(image)}}
                for image in images
            ]
            response = await client.post(
                f"{llm.base_url.rstrip('/')}/v1beta/models/{llm.model}:generateContent",
                params={"key": llm.api_key},
                json={"contents": [{"role": "user", "parts": parts}]},
            )
            _raise_for_status(response, llm)
            candidates = response.json().get("candidates", [])
            if not candidates:
                raise LlmCallError("gemini returned no candidates")
            return "".join(p.get("text", "") for p in candidates[0]["content"]["parts"])

    raise LlmCallError(f"Unknown api_style: {llm.api_style}")


def _as_data_url(image: str) -> str:
    return image if image.startswith("data:") else f"data:image/png;base64,{image}"


def _strip_data_url(image: str) -> str:
    return image.partition(",")[2] if image.startswith("data:") else image


def _raise_for_status(response: httpx.Response, llm: ResolvedLlm) -> None:
    if response.status_code >= 400:
        raise LlmCallError(
            f"{llm.provider}/{llm.model} returned {response.status_code}: {response.text[:300]}"
        )
