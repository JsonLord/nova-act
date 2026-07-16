"""Configuration via pydantic-settings; every value has an env override."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Which packs this deployment exposes: "all" or csv, e.g. "personas,steering"
    usersync_packs: str = "all"
    # Public URL of this deployment (the HF Space URL, set once known) —
    # reflected in openapi servers and the /mcp manifest so generated clients
    # and MCP tools point at the right host. Empty = relative paths only.
    usersync_public_base_url: str = ""
    # Artifact root: HF Spaces persistent storage when present, ./data otherwise
    usersync_data_dir: str = ""

    # HF OAuth (same variables the Express server used)
    oauth_client_id: str = ""
    oauth_client_secret: str = ""
    oauth_scopes: str = "openid profile"
    openid_provider_url: str = "https://huggingface.co"
    space_host: str = ""

    # External engines (all optional; endpoints degrade to simulated output)
    ux_mentor_base_url: str = ""  # e.g. https://leon4gr45-ux-mentor.hf.space
    screenshot_to_code_base_url: str = ""  # deployed JsonLord/screenshot-to-code
    screenshotone_api_key: str = ""  # for its POST /api/screenshot live capture
    nova_act_api_key: str = ""

    # Journey engine: "open" (CPU-Space engine), "nova" (Amazon fallback), or
    # "auto" (nova when configured, else open) — spec.md §17.
    usersync_engine: str = "auto"

    # Account defaults
    free_credits: int = 1000

    @property
    def data_dir(self) -> Path:
        if self.usersync_data_dir:
            return Path(self.usersync_data_dir)
        hf_data = Path("/data")
        return hf_data if hf_data.is_dir() else Path("./data")

    @property
    def enabled_packs(self) -> list[str]:
        raw = self.usersync_packs.strip().lower()
        if raw in ("", "all", "*"):
            return []  # empty means "all"
        return [p.strip() for p in raw.split(",") if p.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
