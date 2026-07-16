"""UserSync backend entry point.

Composable: mounts every enabled pack router, exposes /healthz, OpenAPI with
stable operation ids, and an MCP tool manifest generated from the API — the
per-Space runtime contract of spec.md §9.

Run locally:   uvicorn backend.app.main:app --port 7860
Standalone:    USERSYNC_PACKS=personas uvicorn backend.app.main:app
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import get_settings
from backend.app.routers import PACKS


def create_app() -> FastAPI:
    settings = get_settings()
    enabled = settings.enabled_packs or list(PACKS.keys())

    app = FastAPI(
        title="UserSync API",
        version="1.0.0",
        description="Persona-steered usability testing over the Nova Act engine. "
        f"Enabled packs: {', '.join(enabled)}.",
        openapi_url="/openapi.json",
        docs_url="/api/docs",
    )
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    for pack in enabled:
        for router in PACKS.get(pack, []):
            app.include_router(router)

    @app.get("/healthz", tags=["meta"], operation_id="healthz")
    @app.get("/health", tags=["meta"], operation_id="health", include_in_schema=False)
    def healthz():
        return {"status": "ok", "packs": enabled}

    if settings.usersync_public_base_url:
        # Set once the HF Space URL is known: absolute server URL for
        # generated clients and MCP tools.
        app.servers = [{"url": settings.usersync_public_base_url.rstrip("/")}]

    @app.get("/mcp", tags=["meta"], operation_id="mcp_manifest")
    def mcp_manifest():
        """MCP-compatible tool manifest generated from the pack APIs, so
        agents (including design UI agents, spec.md §17) can call every
        operation as usersync.<pack>.<operation_id>."""
        schema = app.openapi()
        tools = []
        for path, methods in schema.get("paths", {}).items():
            for method, operation in methods.items():
                operation_id = operation.get("operationId")
                if not operation_id or operation_id in ("healthz", "mcp_manifest"):
                    continue
                pack = (operation.get("tags") or ["core"])[0]
                body_schema = (
                    operation.get("requestBody", {})
                    .get("content", {})
                    .get("application/json", {})
                    .get("schema", {})
                )
                tools.append(
                    {
                        "name": f"usersync.{pack}.{operation_id}",
                        "description": operation.get("summary")
                        or (operation.get("description") or "").strip()[:200]
                        or operation_id,
                        "endpoint": {"method": method.upper(), "path": path},
                        "input_schema": body_schema or {"type": "object"},
                    }
                )
        return {
            "tools": tools,
            "packs": enabled,
            "base_url": settings.usersync_public_base_url.rstrip("/") or None,
        }

    # Serve the built frontend when present (full-app deployment).
    dist = Path(__file__).resolve().parents[2] / "UserSync" / "dist"
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")

    return app


app = create_app()
