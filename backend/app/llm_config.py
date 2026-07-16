"""Bring-your-own-key LLM configuration, split by modality.

Two independent slots — ``text`` (text-only models: persona enrichment,
steering auto-fill, graph Q&A, the open engine's DOM mode) and ``vision``
(multimodal models: screenshot analysis, the open engine's vision mode) —
each with its own provider, model, and token, because the best/cheapest
choice per modality is rarely the same provider.

Resolution order per request and modality:
1. Request headers (nothing stored):
     text:   X-LLM-Provider / X-LLM-Model / X-LLM-Key / X-LLM-Base-Url
     vision: X-LLM-Vision-Provider / -Model / -Key / -Base-Url
2. The caller's saved config (POST /api/account/llm-config) — **session-only
   and logged-in only**: configs live in an in-process store with a TTL,
   keyed to the authenticated HF identity. Keys never touch disk, vanish on
   Space restart or TTL expiry, and are always masked on read. Anonymous
   callers cannot store keys (401) — they use per-request headers instead.
3. No server-side fallback: BYOK is mandatory for LLM features.
"""

from __future__ import annotations

import threading
import time
from typing import Literal

from fastapi import Request
from pydantic import BaseModel, Field


Modality = Literal["text", "vision"]

# Provider catalog: base URLs, API style, and per-modality default models.
# `vision_default: None` marks providers without multimodal support.
PROVIDERS: dict[str, dict] = {
    "huggingface": {
        "label": "Hugging Face Inference Providers",
        "api_style": "openai",
        "base_url": "https://router.huggingface.co/v1",
        "token_hint": "hf_...",
        "text_default": "meta-llama/Llama-3.3-70B-Instruct",
        "vision_default": "Qwen/Qwen2.5-VL-72B-Instruct",
    },
    "openai": {
        "label": "OpenAI",
        "api_style": "openai",
        "base_url": "https://api.openai.com/v1",
        "token_hint": "sk-...",
        "text_default": "gpt-4.1-mini",
        "vision_default": "gpt-4.1",
    },
    "anthropic": {
        "label": "Anthropic",
        "api_style": "anthropic",
        "base_url": "https://api.anthropic.com/v1",
        "token_hint": "sk-ant-...",
        "text_default": "claude-haiku-4-5-20251001",
        "vision_default": "claude-sonnet-5",
    },
    "gemini": {
        "label": "Google Gemini",
        "api_style": "gemini",
        "base_url": "https://generativelanguage.googleapis.com",
        "token_hint": "AIza...",
        "text_default": "gemini-2.0-flash",
        "vision_default": "gemini-2.0-flash",
    },
    "custom": {
        "label": "Custom (OpenAI-compatible)",
        "api_style": "openai",
        "base_url": "",  # user-supplied
        "token_hint": "...",
        "text_default": "",
        "vision_default": "",
    },
}


class LlmSlot(BaseModel):
    provider: str = Field(pattern="^(" + "|".join(PROVIDERS) + ")$")
    model: str = ""
    api_key: str = ""
    base_url: str = ""  # required only for provider=custom

    def resolved_model(self, modality: Modality) -> str:
        if self.model:
            return self.model
        default = PROVIDERS[self.provider][f"{modality}_default"]
        return default or ""

    def resolved_base_url(self) -> str:
        return self.base_url or PROVIDERS[self.provider]["base_url"]

    def masked(self) -> dict:
        data = self.model_dump()
        if data["api_key"]:
            key = data["api_key"]
            data["api_key"] = f"{key[:5]}…{key[-4:]}" if len(key) > 12 else "…"
            data["api_key_set"] = True
        else:
            data["api_key_set"] = False
        return data


class LlmConfig(BaseModel):
    """The saved BYOK config: one slot per modality, independently optional."""

    text: LlmSlot | None = None
    vision: LlmSlot | None = None


class ResolvedLlm(BaseModel):
    provider: str
    api_style: str
    model: str
    api_key: str
    base_url: str
    modality: Modality
    source: str  # "headers" | "saved"


# Session-only credential store: in-process, TTL-bound, never written to disk.
SESSION_TTL_S = 12 * 3600.0
_session_lock = threading.Lock()
_session_store: dict[str, tuple[float, LlmConfig]] = {}  # user_id -> (expires_at, config)


def save_llm_config(user_id: str, config: LlmConfig) -> None:
    with _session_lock:
        _session_store[user_id] = (time.time() + SESSION_TTL_S, config)


def load_llm_config(user_id: str) -> LlmConfig | None:
    with _session_lock:
        entry = _session_store.get(user_id)
        if entry is None:
            return None
        expires_at, config = entry
        if expires_at < time.time():
            del _session_store[user_id]
            return None
        return config


def _slot_from_headers(request: Request, modality: Modality) -> LlmSlot | None:
    prefix = "x-llm-" if modality == "text" else "x-llm-vision-"
    provider = request.headers.get(prefix + "provider")
    if not provider or provider not in PROVIDERS:
        return None
    return LlmSlot(
        provider=provider,
        model=request.headers.get(prefix + "model", ""),
        api_key=request.headers.get(prefix + "key", ""),
        base_url=request.headers.get(prefix + "base-url", ""),
    )


def resolve_llm(request: Request, user_id: str, modality: Modality) -> ResolvedLlm | None:
    """Resolve the LLM to use for a modality; None when nothing is configured
    (callers degrade to simulated/deterministic output as everywhere else)."""
    slot, source = _slot_from_headers(request, modality), "headers"
    if slot is None:
        config = load_llm_config(user_id)
        stored = getattr(config, modality, None) if config else None
        slot, source = stored, "saved"
    if slot is None:
        return None

    model = slot.resolved_model(modality)
    if not model:  # provider has no model for this modality (e.g. blablador vision)
        return None
    return ResolvedLlm(
        provider=slot.provider,
        api_style=PROVIDERS[slot.provider]["api_style"],
        model=model,
        api_key=slot.api_key,
        base_url=slot.resolved_base_url(),
        modality=modality,
        source=source,
    )
