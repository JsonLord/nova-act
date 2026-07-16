# UserSync Frontend Backlog

Backend capabilities that have landed ahead of their UI. Each item is a frontend surface to build
against an existing, tested API. Grouped by tab (spec.md §3).

## Cross-cutting UX principles (apply to every tab)

- **Two layers of steering, visually distinct.** *Discovered steering* (`derive_steering` output —
  per-persona, deterministic, backend-owned) is always a **locked card with a "backend • read-only"
  badge** and provenance chips (`source_field → rationale`); it reads as *evidence*, never as an
  input. *Authored steering* (company / product / business-case / test-case config) always uses
  real input affordances. Never let the two look alike — this removes "can I edit this?" confusion.
- **One primary action per screen** (Hick's law). Each tab has a single dominant CTA.
- **Progressive disclosure**: show the summary first, expand to the ~15 knobs only on "Refine".
- **Provenance always visible** — trust is the product.
- **Skeleton loaders, not spinners**; optimistic/streamed reveals (see Phase 3).
- **Empty states teach the next action.** Personas look like *people* (avatar, name, one-line voice),
  not table rows.

## Recommended build sequence
Phase 0 Foundation (build-time Tailwind, API client wrapper, URL routing) → Phase 1 Journey Console
evidence → Phase 2 Persona enrich + Steering Lab auto-fill → **Phase 3 DataHub Render Flow (below)**
→ Phase 4 Graph & Social viz → Phase 5 Dev/Account → Phase 6 Motion & rebrand polish.

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

## DataHub / Personas — the "Render Flow" (Phase 3, flagship tab)

The centerpiece experience, top to bottom on one screen:

### Top band — source flow diagram
A horizontal row of source nodes: HubSpot, Salesforce, Figma, last30days, Web Monitoring, Neo4j.
Each box's border encodes verified connection health:
- grey dashed = not configured · amber pulsing = verifying · **green + lightning bolt + glow =
  verified & live** · red = failing (error on hover).
Flow lines converge sources → **Unify** node → **OASIS generator** node → the graph canvas below.
The data physically "becomes" personas — the mental model made literal.

### The Render button
Sits at the convergence point; disabled until ≥1 source is green (or "synthetic only" chosen),
with a helper line naming what's missing. Press → the flow line pulses source→unify→generator.

### Bottom — the one-by-one generation reveal
Persona cards **materialize into the graph one at a time** as OASIS generates + enriches each
(node drops in, social-tie edges draw, brief shimmer). Cadence reflects real work (enrichment is
the LLM-bound step). Live caption shows pipeline-run provenance ("shaping persona 12 from HubSpot
cohort + last30days sentiment…").

### Per-persona read-only steering card
Expand/flip a persona → its **discovered steering** panel: "Because this persona is [58, low
acuity, low patience, deuteranopia] → the agent [zooms 1.5×, 655ms observation delay,
grayscale-safe perception, aborts after 3 failed steps]." Every line a provenance chip. **Read-only,
backend-owned, badged.** (`GET /api/personas/{hub}/steering/{index}`.)

### Authored steering (separate, on top)
A "Test setup" panel — company / product / business-case / data-source-mode / count / seed —
clearly editable and **test-case scoped**. Change → Render again → new cohort.

### Backend additions this needs (small; not yet built)
1. **Streaming generation** — make `POST /api/personas/generate` a background job (reuse the job
   runner) that appends personas to the hub artifact incrementally, so the reveal is *honest*
   (frontend polls `GET /api/personas/{hub}/graph` and reveals new nodes) rather than a faked
   animation over a completed batch.
2. **Per-connector verify endpoints** — uniform `GET /api/connectors/{name}/verify` →
   `{configured, connected, detail}` for HubSpot/Salesforce/Figma/last30days/monitoring, so the
   green-lightning boxes are truthful. (`/api/graph-store/status` already exists for Neo4j.)
3. **Pipeline-run provenance on graph nodes** — surface `datahub_snapshot_ids` / `research_drop_ids`
   per node for the live caption and the card (mostly present in provenance already).

### Supporting panels (same tab)
- **Figma import**: `POST /api/connectors/figma/import` (file_key + token) → frame inventory +
  render thumbnails.
- **Research-drops**: `POST /api/connectors/last30days/import` (platform picker: reddit, x, tiktok,
  instagram, youtube, bluesky, hackernews, truthsocial) → sentiment/topics feeding unify.
- **Persona graph time-captures**: scrub the graph across data updates / pipeline runs.
- **Graph-store export/import**: `POST /api/graph-store/export`, `GET /api/graph-store/status`.

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
