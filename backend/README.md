# UserSync Backend (FastAPI)

The composable backend from spec.md: eight pack routers that run **together as the full app** or
**alone as standalone API service packages** (spec §14), ready for Hugging Face Space deployment.

## Run

```bash
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --port 7860           # full app
USERSYNC_PACKS=personas,account uvicorn backend.app.main:app   # standalone station
python -m pytest backend/tests/ -q                 # smoke tests (7)
```

When `UserSync/dist` exists (`npm run build` in `UserSync/`), the same process serves the frontend.
`backend/Dockerfile` builds both stages for a Docker-SDK Space on port 7860.

## Packs & endpoints

| Pack | Endpoints | Notes |
| --- | --- | --- |
| auth | `/api/auth/{config,login,callback,user,logout}` | HF OAuth (port of server.cjs) |
| personas | `/api/personas/generate`, `/{hub}/graph`, `/{hub}/steering/{i}` | wraps `oasis/generator` |
| datahub | `/api/datahub/unify`, `/api/datahub/records`, `/api/connectors/{name}/import` | spec §15 unification |
| journeys | `/api/journeys` | executes via nova_act when configured, else queued |
| analysis | `/api/analysis/{action-trace,decisions}`, `/api/graph-research/qa` | spec §12.2/§16 |
| social | `/api/social-mirror/simulations` | OASIS runtime optional |
| uxchain | `/api/ux-chain/{modes,runs}` | 3-piece chain; ux-mentor + screenshot-to-code adapters |
| account | `/api/account/{credits,usage}` | 1000 free credits, file-backed ledger |

## API authentication: HF tokens, 1000 requests per token

API callers authenticate with their own Hugging Face token — no UserSync-issued keys:

```bash
curl -H "Authorization: Bearer hf_..." https://<space>/api/personas/generate -d '{...}'
```

The token is validated against `huggingface.co/api/whoami-v2` (cached 10 min, sha256-hashed in
the ledger, never stored raw) and **each token carries its own budget of 1000 API requests**
(`FREE_CREDITS`); exhausted tokens get 402. Browser sessions keep the `hf_user` cookie flow with
a per-account budget. The Nova Act dev token (`NOVA_ACT_API_KEY`) is unrelated: it is a
server-side Space secret authenticating the backend to Amazon's engine and is never exposed to
API callers.

Meta: `/healthz`, `/openapi.json` (stable operation ids), `/api/docs`, and `/mcp` — an
MCP-compatible tool manifest auto-generated from the pack APIs (`usersync.<pack>.<operation>`).

## Configuration (env / HF Secrets)

`USERSYNC_PACKS`, `USERSYNC_DATA_DIR` (defaults to `/data` on Spaces), `OAUTH_CLIENT_ID`,
`OAUTH_CLIENT_SECRET`, `SPACE_HOST`, `UX_MENTOR_BASE_URL` (e.g.
`https://leon4gr45-ux-mentor.hf.space`), `SCREENSHOT_TO_CODE_BASE_URL` (a deployed
abi/screenshot-to-code fork), `NOVA_ACT_API_KEY`, `USERSYNC_ENGINE` (open|nova|auto), `USERSYNC_PERCEPTION` (cpu|zerogpu|auto — the CPU/ZeroGPU toggle), `OMNIPARSER_BASE_URL`, `USERSYNC_PUBLIC_BASE_URL`, `USERSYNC_MAX_WORKERS` (bounded job/browser concurrency, default 2), `FREE_CREDITS`. LLM access is strictly BYOK — no server-side model keys.

Every response uses the shared envelope: `data`, `artifact_id`, `provenance`, `quota`,
`warnings`, `next_actions`. Artifacts live under `/data/users/{user}/{pack-folder}/` (spec §9).
