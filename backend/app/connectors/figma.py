"""Figma connector (spec §6): fetch a file's frame inventory and render URLs.

Uses the Figma REST API (token via `X-Figma-Token` header — a PAT or OAuth
token supplied per request, never stored server-side beyond the artifact).
Feeds two consumers:
- the ux-chain (`figma_data` / `figma_frame_id`) for design-review runs;
- DataHub as a normalized design snapshot (frames, components, text).

A Figma file is a node tree: DOCUMENT → CANVAS (pages) → FRAME (screens) →
children. We extract the FRAME inventory with bounding boxes and the text
content, which is what the ux-mentor iteration and journey-context flows use.
"""

from __future__ import annotations

from typing import Any

import httpx

FIGMA_API = "https://api.figma.com/v1"


class FigmaError(RuntimeError):
    pass


def _headers(token: str) -> dict[str, str]:
    return {"X-Figma-Token": token}


def fetch_file(file_key: str, token: str, timeout_s: float = 30.0) -> dict[str, Any]:
    """Return the raw Figma file JSON (the node tree)."""
    try:
        response = httpx.get(f"{FIGMA_API}/files/{file_key}", headers=_headers(token), timeout=timeout_s)
    except httpx.HTTPError as error:
        raise FigmaError(f"Figma request failed: {error}")
    if response.status_code == 403:
        raise FigmaError("Figma token rejected (403) — check the PAT/OAuth token and file access")
    if response.status_code != 200:
        raise FigmaError(f"Figma returned {response.status_code}: {response.text[:200]}")
    return response.json()


def extract_frames(file_json: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten the node tree to a FRAME inventory (the 'boards')."""
    frames = []
    document = file_json.get("document", {})
    for canvas in document.get("children", []):
        if canvas.get("type") != "CANVAS":
            continue
        for node in canvas.get("children", []):
            if node.get("type") != "FRAME":
                continue
            box = node.get("absoluteBoundingBox") or {}
            frames.append(
                {
                    "id": node.get("id"),
                    "name": node.get("name", ""),
                    "page": canvas.get("name", ""),
                    "width": box.get("width"),
                    "height": box.get("height"),
                    "text": _collect_text(node),
                }
            )
    return frames


def _collect_text(node: dict[str, Any], acc: list[str] | None = None) -> list[str]:
    acc = acc if acc is not None else []
    if node.get("type") == "TEXT" and node.get("characters"):
        acc.append(node["characters"][:200])
    for child in node.get("children", []):
        _collect_text(child, acc)
    return acc[:50]


def fetch_frame_images(
    file_key: str, node_ids: list[str], token: str, scale: int = 2, timeout_s: float = 30.0
) -> dict[str, str]:
    """Render URLs (PNG) for the given frame node ids — the design baseline
    for the ux-chain's parity comparison."""
    if not node_ids:
        return {}
    try:
        response = httpx.get(
            f"{FIGMA_API}/images/{file_key}",
            headers=_headers(token),
            params={"ids": ",".join(node_ids), "format": "png", "scale": scale},
            timeout=timeout_s,
        )
        response.raise_for_status()
        return response.json().get("images", {}) or {}
    except httpx.HTTPError as error:
        raise FigmaError(f"Figma image request failed: {error}")


def normalize_design_snapshot(file_key: str, file_json: dict[str, Any]) -> dict[str, Any]:
    """DataHub design snapshot: frames + file metadata, provenance-ready."""
    frames = extract_frames(file_json)
    return {
        "file_key": file_key,
        "name": file_json.get("name", ""),
        "last_modified": file_json.get("lastModified"),
        "frame_count": len(frames),
        "frames": frames,
    }
