---
title: UserSync
emoji: 🧪
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
short_description: AI usability testing with persona-steered browser agents
---

# UserSync

**AI usability testing with steerable persona agents.** UserSync generates a synthetic user group
from your product and data, derives how each persona *perceives, thinks, and acts*, and runs those
personas as browser agents against your website or app — capturing their reasoning, their
frustrations, and the UX decisions that follow. Powered by the Nova Act engine (with a keyless
BYOK fallback), OASIS persona/social simulation, and OmniParser vision.

> This file is the **Hugging Face Space config** (Docker SDK). Copy it to the root of your Space
> repo as `README.md`. A ready root `Dockerfile` already exists in the repo, so the Space builds
> out of the box — the only step is swapping the root `README.md` for this one (the repo's root
> README is the Nova Act SDK readme, which has no Space front-matter). The Space serves the FastAPI
> backend and the built frontend from one process on port 7860.

---

## Deploy (Docker Space)

The repo already carries a root `Dockerfile` and the app source. To deploy:

1. Create a new **Docker** Space on Hugging Face.
2. Push this repo to the Space, **replacing the root `README.md` with `deploy/space/README.md`**
   (this file — it has the Space front-matter HF reads).
3. Add the OAuth secrets (below) and open the Space.

The image builds the Vite frontend, then runs `uvicorn backend.app.main:app` on port 7860 and
serves both. Repo root already contains:

```
Dockerfile        # builds frontend + backend (context = repo root)
README.md         # -> replace with deploy/space/README.md on the Space
backend/  UserSync/  oasis/generator/
```

### Storage
Artifacts persist to `/data` when **persistent storage** is enabled on the Space (Settings →
persistent storage); otherwise they fall back to an ephemeral `./data` (fine for trials, wiped on
restart). The default backend is WAL-mode SQLite (`USERSYNC_STORAGE=sqlite`).

---

## Secrets & variables (Settings → Variables and secrets)

**None are required to boot** — the app runs and every integration degrades gracefully. Add these
to unlock features:

| Name | Enables |
| --- | --- |
| `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET` | Hugging Face sign-in (required to save BYOK keys, per-user budgets) |
| `SPACE_HOST` | Correct OAuth redirect on the Space host |
| `USERSYNC_PUBLIC_BASE_URL` | Absolute URLs in OpenAPI + the `/mcp` tool manifest |
| `UX_MENTOR_BASE_URL` | UX Chain heatmaps/iteration (a deployed ux-mentor Space) |
| `SCREENSHOT_TO_CODE_BASE_URL`, `SCREENSHOTONE_API_KEY` | UX Chain code-fix + live screenshots |
| `OMNIPARSER_BASE_URL` + `USERSYNC_PERCEPTION=zerogpu` | Vision parsing of canvas/Figma surfaces (a GPU OmniParser Space) |
| `NOVA_ACT_API_KEY` | Premium Nova engine tier (optional — keyless nova-compat is the default) |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` | Graph store export/status |
| `HUBSPOT_TOKEN`, `SALESFORCE_TOKEN`, `MONITORING_URL` | CRM / monitoring connectors |

Tuning variables: `USERSYNC_PACKS` (default `all`; e.g. `personas,steering` for a standalone
station), `USERSYNC_ENGINE` (`open`|`nova`|`auto`), `USERSYNC_PERCEPTION` (`cpu`|`zerogpu`|`auto`),
`USERSYNC_MAX_WORKERS` (default `2` — the browser-session ceiling), `FREE_CREDITS` (default `1000`).

**LLM access is strictly bring-your-own-key** — there are no server-side model keys. Users add their
own OpenAI / Anthropic / Gemini / HF-Inference key in the app (Dev → settings); keys are
**session-only, in-memory, never written to disk**, and login-gated.

---

## First run

1. **Sign in with Hugging Face** (needs the OAuth secrets).
2. **Dev → settings**: add a BYOK **text** model (and a **vision** model for screenshot-driven
   journeys). Test the connection.
3. **DataHub → Render Flow**: press **Render** — personas grow into the graph one by one, each with
   a read-only steering card. Optionally **Enrich (LLM)** them.
4. **Nova Console**: run a persona-steered journey; watch the agent's steps, thinking, and the
   screenshots it actually saw. Toggle **👁 Vision** for visually dense pages.
5. **Graph → Action Trace**: analyze runs, read the decision findings, ask the graph AI.
6. **Oasis → Social Mirror**: grow a living persona network and compare it to a real social graph.

---

## API

The Space is also a metered REST API — every pack is under `/api/*`. Authenticate with your own HF
token (`Authorization: Bearer hf_...`), **1000 free requests per token**.

- `GET /healthz` · `GET /openapi.json` · `GET /api/docs` (interactive)
- `GET /mcp` — an MCP tool manifest auto-generated from the API (`usersync.<pack>.<operation>`)

Packs: personas, steering (+ derivation rulesets, corrections), journeys, analysis, social-mirror,
ux-chain, datahub/connectors/graph-store, account, jobs. Deploy a subset with `USERSYNC_PACKS`.

---

Built on [Nova Act](https://nova.amazon.com/act), [OASIS](https://github.com/camel-ai/oasis),
and OmniParser. Apache-2.0.
