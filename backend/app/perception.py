"""The steerable observation pipeline (spec.md §4.4).

A hosted vision/text model's perception is uncontrollable — it sees
everything, instantly, in full color. This filter makes *observing* as
steerable as thinking and acting by degrading the OBSERVATION DATA before
any model sees it. It is engine-agnostic: it consumes element lists from
the DOM serializer (open engine) and from OmniParser (canvas/visual
surfaces) identically.

Steered effects:
- **Vision latency**: a per-look fixation budget — only the top-weighted
  elements are perceived per observation; re-looking at the same page
  (look_index) widens the window, so slow perception costs steps.
- **Scan patterns**: F / T / Z reading-pattern weights over element
  positions; on-path elements get "better recognition points" (full labels,
  first in serialization order — primacy for the LLM mirrors primacy for
  humans); off-path elements degrade to generic labels or vanish.
- **Colorless vision**: color-dependent elements (signal carried mostly by
  color) are dropped or de-labeled for CVD personas; optical preprocessing
  (CVD matrices / grayscale / acuity blur) additionally degrades the
  screenshot itself for vision-model paths.
- **Recognition points**: unlabeled icons are recognized only above a
  digital-literacy threshold; small elements become unreadable below an
  acuity threshold.

Every filtered observation reports the delta — `perceived` vs `missed` —
which is itself usability evidence ("the CTA existed but sat outside the
persona's scan path").
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

DEFAULT_BUDGET = 999  # permissive default: no persona -> no degradation


@dataclass
class PerceptionProfile:
    scan_pattern: str = "full"  # F | T | Z | full
    fixation_budget: int = DEFAULT_BUDGET
    vision_acuity: int = 5  # 1..5
    color_vision: str = "normal"
    digital_literacy: int = 5  # 1..5
    contrast_sensitivity: int = 5


@dataclass
class PerceptionResult:
    perceived: list[dict[str, Any]] = field(default_factory=list)
    missed: list[dict[str, Any]] = field(default_factory=list)
    attention_map: list[dict[str, float]] = field(default_factory=list)
    look_index: int = 0


def profile_from_steering(steering: dict | None) -> PerceptionProfile:
    """Build the profile from a derive_steering() payload; permissive when
    steering carries no perception fields (un-steered runs see everything)."""

    def value(*path: str, default: Any) -> Any:
        node: Any = steering or {}
        for key in path:
            if not isinstance(node, dict) or key not in node:
                return default
            node = node[key]
        return node.get("value", node) if isinstance(node, dict) else node

    return PerceptionProfile(
        scan_pattern=str(value("observing", "scan_pattern", default="full")),
        fixation_budget=int(value("observing", "fixation_budget", default=DEFAULT_BUDGET)),
        vision_acuity=int(value("observing", "vision_acuity", default=5)),
        color_vision=str(value("observing", "color_vision_deficiency", default="normal")),
        digital_literacy=int(value("observing", "digital_literacy", default=5)),
    )


def scan_weight(x: float, y: float, pattern: str) -> float:
    """Attention weight (0..1) of a normalized position under a scan pattern.

    F: full top band, strong left column, weaker second band (Nielsen).
    T: full top band + center column.
    Z: top band, descending diagonal, bottom band.
    full: uniform.
    """
    if pattern == "F":
        top = max(0.0, 1.0 - y * 4) if y <= 0.25 else 0.0
        left = max(0.0, 1.0 - x * 3) * max(0.0, 1.0 - y)
        second_band = 0.6 if 0.35 <= y <= 0.5 else 0.0
        return min(1.0, max(top, left, second_band))
    if pattern == "T":
        top = max(0.0, 1.0 - y * 4) if y <= 0.25 else 0.0
        center = max(0.0, 1.0 - abs(x - 0.5) * 3) * max(0.0, 1.0 - y * 0.7)
        return min(1.0, max(top, center))
    if pattern == "Z":
        top = 1.0 if y <= 0.2 else 0.0
        diagonal = 1.0 - min(1.0, abs(y - x) * 2.5)
        bottom = 0.8 if y >= 0.8 else 0.0
        return min(1.0, max(top, max(0.0, diagonal) * 0.8, bottom))
    return 1.0


def saliency(element: dict[str, Any]) -> float:
    """Visual prominence: size plus center proximity (0..1)."""
    area = float(element.get("w", 0.02)) * float(element.get("h", 0.02))
    size_score = min(1.0, area / 0.02)  # ~2% of viewport counts as prominent
    center = 1.0 - min(
        1.0,
        (abs(float(element.get("x", 0.5)) - 0.5) + abs(float(element.get("y", 0.5)) - 0.5)),
    )
    return 0.6 * size_score + 0.4 * center


def element_weight(element: dict[str, Any], profile: PerceptionProfile) -> float:
    return 0.6 * scan_weight(
        float(element.get("x", 0.5)), float(element.get("y", 0.5)), profile.scan_pattern
    ) + 0.4 * saliency(element)


def apply_perception(
    elements: list[dict[str, Any]],
    profile: PerceptionProfile,
    look_index: int = 0,
) -> PerceptionResult:
    """Filter an element list through the persona's perception.

    ``look_index`` widens the fixation window on repeat observations of the
    same screen — the vision-latency mechanism: perceiving more costs steps.
    """
    result = PerceptionResult(look_index=look_index)
    scored: list[tuple[float, dict[str, Any]]] = []

    for element in elements:
        weight = element_weight(element, profile)
        result.attention_map.append(
            {"x": float(element.get("x", 0.5)), "y": float(element.get("y", 0.5)), "weight": round(weight, 3)}
        )

        # Colorless vision: elements whose signal is carried by color are
        # invisible-as-distinct to CVD personas.
        if profile.color_vision != "normal" and element.get("color_dependent"):
            result.missed.append({**element, "missed_because": f"color-only signal ({profile.color_vision})"})
            continue
        scored.append((weight, element))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    budget = profile.fixation_budget * (1 + look_index)

    for rank, (weight, element) in enumerate(scored):
        if rank >= budget:
            result.missed.append({**element, "missed_because": "outside fixation budget (not yet looked at)"})
            continue

        perceived = dict(element)
        text = str(perceived.get("text", ""))
        small = float(perceived.get("w", 0.05)) * float(perceived.get("h", 0.05)) < 0.0004

        # Acuity: small labels become unreadable for low-acuity personas.
        if small and profile.vision_acuity <= 2 and text:
            perceived["text"] = "(too small to read)"
            perceived["degraded"] = "acuity"
        # Recognition points: unlabeled icons need literacy; off-path
        # elements lose label fidelity for low-literacy personas.
        elif not text and profile.digital_literacy <= 3:
            perceived["text"] = "(unidentified control)"
            perceived["degraded"] = "literacy"
        elif weight < 0.35 and profile.digital_literacy <= 2 and text:
            perceived["text"] = "(some control)"
            perceived["degraded"] = "off-scan-path"

        perceived["attention_weight"] = round(weight, 3)
        result.perceived.append(perceived)

    return result


def omniparser_to_elements(parsed_content_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map OmniParser's parsed_content_list (ratio bboxes) onto the shared
    element shape, so the same perceptual filter applies to visual surfaces
    (canvas, Figma prototypes) as to DOM pages."""
    elements = []
    for item in parsed_content_list:
        box = item.get("bbox") or [0, 0, 0, 0]
        x1, y1, x2, y2 = (float(v) for v in box)
        elements.append(
            {
                "index": len(elements),
                "tag": str(item.get("type", "icon")),
                "text": str(item.get("content", "")).strip(),
                "x": round((x1 + x2) / 2, 4),
                "y": round((y1 + y2) / 2, 4),
                "w": round(abs(x2 - x1), 4),
                "h": round(abs(y2 - y1), 4),
                "interactive": bool(item.get("interactivity", True)),
                "source": "omniparser",
            }
        )
    return elements


# --- Optical preprocessing (vision-model paths) ------------------------------
# Applied to the screenshot BEFORE any model or parser sees it — works even
# for plain BYOK VLM calls, independent of OmniParser.

_CVD_MATRICES = {
    # Linear RGB simulation matrices (Machado et al. approximations).
    "protanopia": ((0.567, 0.433, 0.0), (0.558, 0.442, 0.0), (0.0, 0.242, 0.758)),
    "deuteranopia": ((0.625, 0.375, 0.0), (0.7, 0.3, 0.0), (0.0, 0.3, 0.7)),
    "tritanopia": ((0.95, 0.05, 0.0), (0.0, 0.433, 0.567), (0.0, 0.475, 0.525)),
}


def preprocess_screenshot(png_bytes: bytes, profile: PerceptionProfile) -> bytes:
    """Degrade the screenshot optically per the persona: CVD simulation or
    grayscale, plus acuity blur. No-op (and dependency-free) for the default
    profile; requires Pillow when a degradation applies."""
    needs_color = profile.color_vision != "normal"
    needs_blur = profile.vision_acuity <= 3
    if not needs_color and not needs_blur:
        return png_bytes
    try:
        import io

        from PIL import Image, ImageFilter
    except ImportError:
        return png_bytes  # degrade gracefully; structural filter still applies

    image = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    if profile.color_vision == "achromatopsia":
        image = image.convert("L").convert("RGB")
    elif profile.color_vision in _CVD_MATRICES:
        m = _CVD_MATRICES[profile.color_vision]
        image = image.convert(
            "RGB",
            (m[0][0], m[0][1], m[0][2], 0, m[1][0], m[1][1], m[1][2], 0, m[2][0], m[2][1], m[2][2], 0),
        )
    if needs_blur:
        image = image.filter(ImageFilter.GaussianBlur(radius=4 - profile.vision_acuity))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()
