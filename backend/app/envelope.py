"""Shared response envelope (spec.md §9): every pack answers the same shape."""

from __future__ import annotations

from typing import Any


def envelope(
    data: Any,
    artifact_id: str | None = None,
    provenance: dict[str, Any] | None = None,
    quota: dict[str, Any] | None = None,
    warnings: list[str] | None = None,
    next_actions: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    return {
        "data": data,
        "artifact_id": artifact_id,
        "provenance": provenance or {},
        "quota": quota or {},
        "warnings": warnings or [],
        "next_actions": next_actions or [],
    }
