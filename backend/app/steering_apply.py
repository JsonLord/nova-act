"""Second-layer (authored) steering: developer-manipulable overrides.

Layer 1 (discovered) = `derive_steering(persona)` — per-persona, deterministic,
read-only. Layer 2 (authored) = company/test-case overrides a *developer* may
set via API. This module merges authored overrides onto a discovered config,
marking each overridden value so the provenance shows what detached from the
derived value (the frontend "broken-link" affordance).

Overrides are **declarative**, not executable code — a flat map of
dotted paths to values over the observe/think/act blocks. This is the safe
"code runner" surface: developers compute/preview effective steering
programmatically without arbitrary code execution.
"""

from __future__ import annotations

import copy
from typing import Any

# Whitelist of override paths a developer may set on the second layer. Keeps
# authored steering to real, actuatable knobs; anything else is rejected.
OVERRIDABLE_PATHS = {
    "observing.viewport",
    "observing.zoom_factor",
    "observing.color_vision_deficiency",
    "observing.observation_delay_ms",
    "observing.reread_observations",
    "observing.scan_pattern",
    "observing.fixation_budget",
    "observing.vision_acuity",
    "observing.digital_literacy",
    "thinking.max_steps",
    "thinking.options_considered",
    "thinking.scroll_depth_screens",
    "thinking.plan_first",
    "acting.allowed_actions",
    "acting.typing_wpm",
    "acting.pointer_jitter_px",
    "acting.hesitation_wait_s",
    "acting.timeout_s",
    "acting.frustration_abort_after_failed_steps",
    "acting.express_opinions",
}


class OverrideError(ValueError):
    pass


def validate_overrides(overrides: dict[str, Any]) -> None:
    bad = set(overrides) - OVERRIDABLE_PATHS
    if bad:
        raise OverrideError(
            f"unknown/forbidden override paths: {sorted(bad)}. "
            f"Allowed: {sorted(OVERRIDABLE_PATHS)}"
        )


def apply_overrides(config: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    """Return a new config with authored overrides applied. Each overridden
    SteeredValue keeps its discovered value under `overridden_from` and flips
    its source to "authored" so the UI can show the detach + provenance."""
    validate_overrides(overrides)
    merged = copy.deepcopy(config)
    applied = []
    for path, value in overrides.items():
        block, key = path.split(".", 1)
        node = merged.get(block, {})
        current = node.get(key)
        discovered_value = current.get("value") if isinstance(current, dict) else current
        node[key] = {
            "value": value,
            "source_fields": ["authored"],
            "rationale": "second-layer override (company/test-case)",
            "overridden_from": discovered_value,
            "source": "authored",
        }
        merged[block] = node
        applied.append(path)
    merged.setdefault("provenance", {})["authored_overrides"] = applied
    return merged
