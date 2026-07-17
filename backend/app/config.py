"""Configuration via pydantic-settings; every value has an env override."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Which packs this deployment exposes: "all" or csv, e.g. "personas,steering"
    usersync_packs: str = "all"
    # Artifact backend (spec §10): "sqlite" (WAL DB, durable under concurrent
    # writes — the default) or "files" (flat JSON). Binary blobs stay on disk.
    usersync_storage: str = "sqlite"
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
    omniparser_base_url: str = ""  # JsonLord/OmniParser omniparserserver (GPU Space)
    nova_act_api_key: str = ""

    # CRM / monitoring connector credentials (HF Secrets; per-connector).
    hubspot_token: str = ""
    salesforce_token: str = ""
    monitoring_url: str = ""

    # Neo4j / Neptune graph store (spec §5/§10) — pulled from HF Secrets.
    # Placeholder connection: wired and status-checkable, tested in-Space later.
    neo4j_uri: str = ""  # e.g. neo4j+s://<id>.databases.neo4j.io
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    neo4j_database: str = "neo4j"

    # Journey engine: "open" (CPU-Space engine), "nova" (Amazon fallback), or
    # "auto" (nova when configured, else open) — spec.md §17.
    usersync_engine: str = "auto"

    # Perception tier — the CPU/ZeroGPU deployment toggle (spec.md §4.5):
    #   "cpu"     — DOM serializer + optical preprocessing only; visual (OmniParser)
    #               escalation is OFF even if a URL is set. Safe on CPU-only Spaces.
    #   "zerogpu" — visual escalation ON; the engine escalates to the OmniParser
    #               station for canvas/Figma surfaces (needs OMNIPARSER_BASE_URL).
    #   "auto"    — zerogpu behavior when OMNIPARSER_BASE_URL is set, else cpu.
    usersync_perception: str = "auto"

    # Bounded background-job concurrency — the browser-session ceiling on a
    # Space (spec §17.4). Journeys and simulations run through this pool.
    max_workers: int = 2

    # Account defaults
    free_credits: int = 1000

    @property
    def visual_perception_enabled(self) -> bool:
        """Whether the engine may escalate to OmniParser (the GPU path)."""
        mode = self.usersync_perception.strip().lower()
        if mode == "cpu":
            return False
        if mode == "zerogpu":
            return True
        return bool(self.omniparser_base_url)  # auto

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
