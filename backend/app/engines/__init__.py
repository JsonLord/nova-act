"""Engine abstraction (spec.md §17): open engine on CPU Spaces, Nova as fallback.

This module is the frozen seam: the closed action vocabulary and the engine
selection logic. OpenEngine/NovaEngine implementations land here in the
§17.3 phases; until then, resolution powers provenance and run status.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend.app.config import get_settings

# The frozen contract (§17.2): both engines emit exactly this vocabulary,
# one think + one action per step. Downstream steering/analysis is keyed to it.
ACTION_VOCABULARY = [
    "agentClick", "agentType", "agentScroll", "agentHover", "goToUrl", "wait", "return", "throw",
]


@dataclass
class EngineChoice:
    name: str  # "open" | "nova" | "none"
    executable: bool
    reason: str


def _nova_available() -> tuple[bool, str]:
    if not get_settings().nova_act_api_key:
        return False, "NOVA_ACT_API_KEY not set"
    try:
        import nova_act  # noqa: F401
    except ImportError:
        return False, "nova_act SDK not installed"
    return True, "nova_act SDK + API key present"


def _open_available() -> tuple[bool, str]:
    try:
        import playwright  # noqa: F401
    except ImportError:
        return False, "playwright not installed"
    from backend.app.engines.open_engine import find_chromium

    if find_chromium() is None:
        return False, "no Chromium binary found (playwright install chromium)"
    return True, "OpenEngine ready (playwright + chromium; needs a BYOK text model per run)"


def resolve_engine() -> EngineChoice:
    """Pick the journey engine per USERSYNC_ENGINE=open|nova|auto (§17.2).

    Keyless is the capable default: `open` and keyless `nova` (nova-compat)
    both run the BYOK observe→think→act loop — no Amazon key required. The
    Amazon key only upgrades `nova` to the premium trained-model path.
    """
    preference = get_settings().usersync_engine.lower()
    nova_key_ok, nova_reason = _nova_available()
    open_ok, open_reason = _open_available()

    if preference == "nova":
        # Executable whenever the BYOK loop can run (keyless nova-compat);
        # the key merely upgrades the tier, it is not required.
        if nova_key_ok:
            return EngineChoice("nova", True, f"premium (Amazon model): {nova_reason}")
        return EngineChoice("nova", open_ok, f"keyless nova-compat (BYOK): {open_reason}")
    if preference == "open":
        return EngineChoice("open", open_ok, open_reason)
    # auto: premium nova only when a key is present; otherwise keyless open.
    if nova_key_ok:
        return EngineChoice("nova", True, f"premium (Amazon model): {nova_reason}")
    if open_ok:
        return EngineChoice("open", True, open_reason)
    return EngineChoice("open", False, f"nova: {nova_reason}; open: {open_reason}")
