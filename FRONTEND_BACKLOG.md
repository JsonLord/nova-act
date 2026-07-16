# UserSync Frontend Backlog

Backend capabilities that have landed ahead of their UI. Each item is a frontend surface to build
against an existing, tested API. Grouped by tab (spec.md §3).

## Journeys / Nova Console (Tab 1)
- **Journey evidence viewer**: per-step screenshot strip (`GET /api/journeys/{id}/screenshot/{step}`),
  the `perceived` vs `missed` element overlay per step (the perception delta), and the run heatmap.
- **Vision-mode toggle** on the composer (`vision_mode` flag) with a note that it needs a BYOK
  vision slot.
- **Decision findings panel**: after a goal has ≥2 completed runs, show the auto-built decision set
  (`same_path_different_experience` / `same_goal_different_path` / `diverged`) with linked runs.
- **Jobs panel**: live queue + job status from `GET /api/jobs` (queued/running/done/failed/
  interrupted), and the `max_workers` cap indicator.

## Behavior Steering Lab (Tab 2)
- **Auto-fill UI**: call `POST /api/steering/autofill`, render each `SteeredValue` as a provenance
  chip (source_fields + rationale), editable, with the observe/think/act grouping — including the
  new perception fields (scan_pattern, fixation_budget, vision_acuity, digital_literacy).

## Persona Generation (Tab 4)
- **Enrich button** on a generated hub (`POST /api/personas/{hub}/enrich`) with progress
  (llm_calls / enriched / failed_batches).
- Node inspector already exists; add the derived steering chips and provenance links.

## DataHub (Tab 5)
- **Unify flow**: connector import → `POST /api/datahub/unify` → pass `unified_traits_id` into
  generation (backend supports it; only the UI wiring is missing).
- **Figma import panel**: `POST /api/connectors/figma/import` (file_key + token), show the frame
  inventory and render thumbnails.
- **Research-drops panel**: `POST /api/connectors/last30days/import` (platform picker: reddit,
  x/twitter, tiktok, instagram, youtube, bluesky, hackernews, truthsocial), show
  sentiment/topics feeding unify.
- **Graph store status**: `GET /api/graph-store/status` (Neo4j connection state), export/import
  buttons for graph snapshots.
- **Persona graph time-captures**: scrub the graph across data updates / pipeline runs.

## Social Mirror (Tab 6)
- **Network animation**: play/scrub the simulation frames (`GET /api/social-mirror/simulations/{id}`
  → `frames[]`), nodes joining, edges forming, posts rippling.
- **Real-vs-synthetic panel**: metrics table + `POST /api/social-mirror/compare` similarity score.

## Graph views (cross-tab)
- **Action Trace Graph** with the heatmap/thinking similarity blend slider (§12.2), and the
  **AI Graph Answers** Q&A panel (`POST /api/graph-research/qa`) with diff-aware regeneration.
- **Endpoint Connection Map** rendered from the gateway registry / OpenAPI (§13).

## Dev & Account (Tab 7)
- **Credits/usage** (`/api/account/credits`, `/usage`), **capabilities** panel (perception tier,
  engine, job queue), **MCP manifest** viewer (`/mcp`), and the HF-token how-to.

## Cross-cutting
- **Motion overhaul** (§11): build-time Tailwind, directional view transitions, URL routing,
  skeleton loaders, `prefers-reduced-motion`.
- **Rebrand pass** completion beyond navbar/title: `branding.ts` promise lines into each tab
  header, shared token file.
