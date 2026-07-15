# UserSync — Product & Architecture Specification

**UserSync** is the product this repository is converging on: an AI usability-testing platform where
**Nova Act is the automation backend** — the driver of every usability-testing workflow — and the
frontend is a user-friendly workstation that prepares, steers, runs, and analyzes those workflows.

This spec supersedes `PROJECT_SPEC.md` (10-tab header navbar) and `UserSync/DELIVERY_SPEC.md`
(6-tab prototype). It defines the target tab UX, the workstation-pack architecture, the FastAPI
backend contracts, the rebranding plan, and the placeholder depth-specs for the concepts that still
need in-depth conceptualization (agent behavior steering, persona generation).

---

## 1. Vision

Nova Act stops being "one tab among many" and becomes the **execution engine underneath the whole
product**. Every user-facing feature triggers a Nova Act **workflow** — a prepared, parameterized,
reusable web-agent run — through a FastAPI layer. These are not generic LLM web agents: their
behavior is **steered** to simulate specific personas with specific browsing limitations, and the
agent's step-by-step thinking is captured **in the style of that persona** to produce usability
evidence.

Multidimensional adaptation of nova-act:

1. **Workflow-native usability testing** — `ui-test-execution-agent/` (Java/VNC test runner) is
   dissolved as a folder and fully re-created as Nova Act native workflows (`@workflow` decorator,
   `Workflow` class, `nova_act/cli/workflow/` deployer) that exercise UI user journeys across web
   content.
2. **Design/device dimension** — Nova Act runs are switchable between desktop, smartphone, and
   tablet views, and extended toward design surfaces (Figma boards/prototypes) so journeys can be
   tested against designs, prototypes, and live sites.
3. **Persona dimension** — OASIS-generated personas (from the upstream `generator/` module) shape
   how the agent browses (limitations) and how it reflects (thinking style).
4. **Data dimension** — DataHub connectors (HubSpot, Salesforce, other CRMs), `last30days` social
   research (paid), and web-monitoring integrations feed and validate persona generation.
5. **Social dimension** — an OASIS-driven living social network of the personas (Reddit/X style),
   compared against the real social graph built from real data.

---

## 2. Rebranding: UserSync

The rebrand starts at **Tab 1** and radiates outward during code adaptation.

- **Name**: the product is **UserSync** (not "Nova Act Suite"). Nova Act is named as the engine
  ("powered by Nova Act"), not as the brand. `Navbar.tsx` brand mark, `<title>`, README badges, and
  Space metadata change first.
- **Design language** (seeded from the current prototype, formalized as tokens):
  - Dark workstation surface (`#0a0a0a`/`#0b0b0b` panels, `gray-800` borders) with the teal accent
    retained as the UserSync primary; a secondary accent per pack is allowed but must come from one
    shared palette token file.
  - Every screen follows the same interaction grammar: **selected source → action button →
    progress state → generated artifact → evidence/provenance → approval/promotion →
    export/download**.
  - Cross-pack dependencies are shown as **linked source objects** (chips linking to the Journey
    Run, Persona, DataHub snapshot, or Research Drop that produced an artifact), never hidden.
- **Tab promise messaging**: each tab header carries a one-line service promise, adapted per tab
  (see the tab table below). These strings live in one `branding.ts` module so the rest of the
  design can be derived during coding without re-litigating copy.
- Remaining visual design is intentionally left to evolve during implementation, but only within
  the token file and interaction grammar above.

| Tab | Promise line (first draft, adapt during coding) |
| --- | --- |
| Journeys | "Run real user journeys with steerable AI testers." |
| Steering Lab | "Decide how your AI testers think, hesitate, and act." |
| Personas | "Grow user groups from your real customer data." |
| Nova Configurations | "Simulate the devices and limitations your users really have." |
| DataHub | "One graph of everything your users are made of." |
| Social Mirror | "Watch your personas live, post, and react — then compare to reality." |
| Dev & Account | "Your API. 1000 free credits. Metered, transparent, yours." |

---

## 3. Tab Specification (minimum 5 tabs; target 7)

The minimum shippable navigation is 5 tabs: **Journeys, Nova Configurations, DataHub, Social
Mirror, Dev & Account** — with Steering and Persona Generation carried as subviews/placeholders
inside Journeys and DataHub until their depth-specs (§4, §5) mature into their own tabs.

### Tab 1 — UserSync Journeys (as-is, re-wired)

The existing UserSync tab stays, but every functionality is re-wired so that **each action triggers
a Nova Act workflow through FastAPI** instead of mock endpoints.

- Journey category selection, workflow generation, run controls, stage prompts, run traces,
  heatmaps, transcripts, downloads.
- Backend: **Journey & Nova Act Runtime API** (`/api/journeys`, `/api/nova-runtime`), a FastAPI
  service owning workflow definitions, run scheduling, and trajectory artifacts.
- A journey run is a Nova Act `Workflow` invocation: `workflow_definition_name`,
  `workflow_run_id`, per-`act()` steps with prompts, observations, AWL programs, and captured
  `think()` output (see §7) persisted as the run trace.
- The former `ui-test-execution-agent` capabilities (scripted UI test execution, run reports,
  screenshots/video evidence) are re-implemented here as prepared workflow templates. The Java
  folder is deleted once parity is demonstrated by workflow templates covering: journey replay,
  regression assertion (`act_get()` with schema), and evidence capture.

### Tab 2 — Behavior Steering Lab *(placeholder — Depth-2 spec, §4)*

How agent behavior can be steered. This is genuinely new and is kept **open as a placeholder for
future development**; §4 fixes the conceptual frame and the extension points without freezing the
solution.

### Tab 3 — Nova Configurations (browser limitations & device/design views)

Configuration studio for the **browser-level constraints** that restrict Nova agent behavior and
simulate real user conditions — e.g. an elderly person browsing the web — to surface usability
issues.

- **Device/view switching**: desktop / smartphone / tablet profiles built on what nova-act already
  exposes (`screen_width`, `screen_height`, `user_agent` in the `NovaAct` constructor), extended
  with Playwright/CDP device descriptors (touch, DPR, orientation).
- **Limitation profiles** (named, saveable, persona-linkable):
  - *Perceptual*: reduced viewport, font scaling, forced zoom, color-vision-deficiency emulation
    (CDP `Emulation.setEmulatedVisionDeficiency`), reduced-motion.
  - *Motor*: injected pointer jitter/misclick radius, slowed typing cadence, scroll granularity —
    implemented in the actuator layer (see §7 extension points).
  - *Cognitive/pacing*: `observation_delay_ms`, lowered `max_steps`, hesitation waits, re-reading
    (repeat observations before acting).
  - *Network/hardware*: CDP network throttling and CPU throttling profiles.
- **Figma/design integration** (see §6): a configuration can target a Figma prototype or frame set
  instead of a live URL.
- **Auto-update hook** (later): demographic data from DataHub (Tab 5) can auto-propose updates to
  limitation profiles; user opts in per profile ("shaped by data" badge with provenance link).
- Backend: part of the Journey/Runtime API surface (`/api/nova-runtime/configurations`), stored as
  versioned artifacts so runs record exactly which limitation profile they used.

### Tab 4 — Persona Generation *(placeholder — Depth-3 spec, §5)*

Persona Studio: how personas are generated for business cases based on DataHub integrations. Entry
point is OASIS's `generator/` module (§5). Ships first as a subview of DataHub, promoted to its own
tab when the depth-spec matures.

### Tab 5 — DataHub (persona network, connectors, pipelines)

The data workstation. Visualizations are first-class here.

- **Persona network graph**: personas generated by OASIS rendered as an interactive graph with
  detailed per-persona information (profile, habits, provenance). **Time captures** of the graph
  show how each persona is shaped over time by data updates, pipeline runs, and config changes.
- **Company data connectors** (paid service): HubSpot, Salesforce, and other CRM systems.
  Normalization layer maps CRM objects → UserSync canonical customer records → inputs to persona
  generation (feeding the OASIS `generator/` entry point). Pipelines are configured here; runs are
  logged with provenance.
- **`last30days` (paid extra service)**: brings in recent social data from various platforms,
  stored normalized and cleansed as **research drops**. (ML processing of these drops: later,
  explicitly out of scope for now.)
- **Monitoring integrations**: connectors to web/website monitoring services for real user-behavior
  telemetry, used to **validate** (and record *did validate*) the synthesized persona datasets.
- **Graph store**: placeholder for Amazon Neptune or Neo4j behind a `/api/graph-store` abstraction;
  ship first on file-based snapshots under HF `/data`, keep import/export in both directions.
- Backend: **DataHub & Integration API** (`/api/datahub`, `/api/connectors`, `/api/graph-store`).
- Demographic data from here later auto-updates the Nova limitation configurations (Tab 3) when the
  user opts in.

### Tab 6 — Social Mirror (OASIS living network)

A living social network built from OASIS: the personas simulate **Reddit- and X-style** platforms,
growing a synthetic network whose analysis is **compared to the real social-analysis graph** built
from real data (which we also grow as a visual data graph; Neptune/Neo4j placeholder shared with
Tab 5).

- OASIS **network actions are conserved**: the OASIS action space (post, comment, like, repost,
  follow, search, …) remains the simulation vocabulary.
- **Nova×OASIS agent fusion** (exploration item): evaluate whether Nova Act actions can be
  translated to OASIS agent actions, or how to fuse an OASIS agent persona with a Nova agent so one
  agent has both benefits — *web navigation* (Nova) and *persona thinking in terms of website
  context, actions, and reflections* (OASIS). Candidate designs, to be prototyped in this order:
  1. **Prompt-fusion**: OASIS persona profile + memory injected into the Nova `act()` prompt;
     Nova `think()` output written back into OASIS agent memory (cheapest, no engine changes).
  2. **Action-bridge**: an adapter mapping OASIS `ManualAction`/platform actions onto Nova Act
     workflows against a real or mocked web UI of the simulated platform.
  3. **Shared-agent**: one agent loop where OASIS supplies the reflection/social policy and Nova
     supplies actuation — requires the §4 steering interfaces to exist first.
- Real-vs-synthetic comparison views: degree distributions, community structure, sentiment/topic
  drift, growth over time.
- Backend: **Social Mirror API** (`/api/social-mirror`, `/api/research-drops`).

### Tab 7 — Dev & Account (conserved Nova Act dev tab)

**Important to conserve.** The Nova Act developer tab for API access.

- We build **our own API endpoint** (the UserSync Gateway + per-pack APIs) and expose it here with
  docs, keys, and a console.
- **1000 free credits** budget per account, **measured**: every pack API call is metered against a
  `quota_category`; the usage ledger is visible here.
- **Company data integrations are a paid service** — entitlement checks gate the DataHub
  connectors.
- **Account backend: placeholder** for whichever service we adopt (Supabase is the current
  candidate for budgets; Stripe/payment abstraction behind an interface). HF login remains the
  identity anchor; paid UserSync API tokens are issued on top.
- Backend: **Developer, Identity & Billing API** (`/api/developer`, `/api/account`,
  `/api/billing`) — cross-cutting, consumed by every other pack.

---

## 4. Depth-2 Spec (placeholder): Steering Agent Behavior

> Status: **conceptual placeholder** — this section fixes vocabulary and extension points; the
> mechanism design is future work and must stay open.

**Goal**: steer Nova agents so they are not generic web agents but simulations of specific personas
— and capture the agent's thinking *in the persona's style* as usability evidence.

Two pillars:

1. **Exposing the LLM thinking tags.** Nova Act already emits explicit reasoning: each model step
   may contain a `think("...")` statement — a first-class no-op tool ("has no effect on the
   environment; should be used for reasoning about the next action") that the interpreter extracts
   and the dispatcher logs per step (§7). Steering means (a) surfacing this stream live in the UI,
   (b) persisting it per step in the run trace, and (c) **restyling/regenerating it through the
   persona lens** — a post-step transformation that rewrites the raw `think()` content as the
   persona would experience it ("I can't find the search box, the text is too small…"), stored
   alongside (never instead of) the raw reasoning.
2. **Simulating browsing limitations of a persona.** The persona's constraints bind to the
   limitation profiles of Tab 3 and to the runtime steering surfaces below.

**Steering surfaces that exist in nova-act today** (the extension points this tab will drive):

| Surface | Where | Steering use |
| --- | --- | --- |
| Prompt composition | `act(prompt)` | Persona framing, goals, vocabulary (no system-prompt param exists today — composition happens in our workflow layer) |
| Tool restriction | `tools: list[ActionType]` | Remove/replace actions a persona wouldn't use |
| Guardrails | `state_guardrail: GuardrailCallable` (URL → PASS/BLOCK) | Hard boundaries (no checkout, no external domains) |
| Agent redirect | `AgentRedirectError(error_and_correction)` | Mid-run corrective steering, injected back into the model loop |
| Pacing | `max_steps`, `timeout`, `observation_delay_ms` | Cognitive-load and hesitation simulation |
| Human-in-the-loop | `human_input_callbacks` | Supervisor pause on sensitive states |
| Actuator override | `ActuatorBase` | Motor-limitation injection (jitter, slow typing) |
| Events | `EventHandler` (LOG/ACTION) | Live streaming of steps/thinking to the frontend |

**Parameter taxonomy** (to be developed): direct / indirect / user-group / internal steering flags;
analysis configs; valuable-signal algorithms; promotion rules ("this steering setting produced
signal, promote it to the persona"); thinking-style summaries; acting-policy suggestions.

Backend: **Steering & Analysis API** (`/api/steering`, `/api/analysis`). Everything here is
versioned and provenance-linked so a journey run records exactly which steering set produced it.

---

## 5. Depth-3 Spec (placeholder): Persona Generation via OASIS `generator/`

> Status: **placeholder** — the OASIS `generator/` module is the main entry point for us to shape
> later.

Findings from investigation:

- The vendored `oasis/` in this repo contains **only docs, data samples, and assets** — the
  `generator/` folder exists upstream (`camel-ai/oasis`) but is **not vendored here yet**. First
  implementation step is vendoring or depending on upstream and wrapping `generator/` behind our
  Persona Hub API.
- The generator's **output contracts are already documented** in
  `oasis/docs/user_generation/generation.mdx` and sample data exists in `oasis/data/`:
  - **Twitter format (CSV)**: `name`, `username`, `user_char`, `description` (persona text becomes
    the agent's system prompt; `agent_id` = row order).
  - **Reddit format (JSON)**: `realname`, `username`, `bio`, `persona` (detailed personality text),
    `age`, `gender`, `mbti`, `country` (see `oasis/data/reddit/user_data_36.json`).
- These fields are exactly the demographic/psychographic slots our DataHub pipelines must fill:
  CRM records + `last30days` research drops + monitoring telemetry → normalized customer traits →
  generator inputs → persona profiles → (a) OASIS simulation agents, (b) steering/limitation
  bindings for Nova runs.

To shape later: business-case templates for generation, approval/locking of persona updates,
persona scale controls, and the mapping table CRM-field → generator-field. Backend: **Persona Hub
API** (`/api/personas`, `/api/lenses`).

---

## 6. Figma Integration Research

**How a Figma board is structured.** A Figma file is addressed by a `file_key`
(`figma.com/design/:file_key/:name?node-id=…`) and is a single **node tree**:
`DOCUMENT` → `CANVAS` nodes (the pages) → `FRAME` nodes (the artboards/screens a designer calls a
"board") → nested children (`GROUP`, `COMPONENT`, `INSTANCE`, `TEXT`, vector shapes). Every node
has an `id`, `name`, `absoluteBoundingBox`, fills/styles, and — crucially for us — text content and
layout geometry. FigJam boards are the same model with sticky/shape/connector node types.
Prototypes are frames plus interaction/flow metadata (`transitionNodeID`, flow starting points).

**Integration surfaces:**

| Surface | What it gives UserSync |
| --- | --- |
| REST `GET /v1/files/:key` and `/v1/files/:key/nodes?ids=…` | Full/partial node tree JSON — frame inventory, text, layout boxes for parity checks |
| REST `GET /v1/images/:key?ids=…&format=png&scale=…` | Rendered PNG/SVG exports of frames — the design-side baseline for visual comparison |
| REST `GET /v1/files/:key/comments` (+ POST) | Design comments in/out — comments become journey context; findings can be posted back |
| Webhooks v2 (`FILE_UPDATE`, `FILE_COMMENT`) | Re-trigger design-review workflows on design changes |
| Embed (`figma.com/embed?embed_host=usersync&url=…`) | Live file/prototype iframe inside the app |
| OAuth2 (or PAT for dev) | Per-user authorization; tokens live in the account layer |

**How Nova Act drives it:** an embedded Figma **prototype is itself web content** — the agent can
run a journey against the prototype exactly as against a live site (screenshot observation + click
coordinates; DOM selectors are not meaningful inside Figma's canvas, which is fine because Nova Act
is vision-driven). This enables three workflow families:

1. **Prototype walkthrough**: persona-steered journey through a Figma prototype before code exists.
2. **Design-to-live parity**: render frames via the images API, run the same journey on the live
   site, compare (layout drift, brand/component drift, missing states).
3. **Design import as journey context**: frame names/flows seed journey definitions; design
   comments attach as steering context.

Figma is implemented as a **DataHub connector** (`/api/figma` under the design-review pack) with
the same normalization/provenance rules as CRM connectors.

---

## 7. Analysis: the Current Thinking & Acting Dynamic in Nova Act

*(Requested report — this is how the engine behaves today, and what we build on.)*

**The loop** (`ActDispatcher.dispatch`, `src/nova_act/impl/dispatcher.py:216`):

1. **Prologue**: optional `wait(observation_delay_ms)` → `waitForPageToSettle` →
   `takeObservation` (screenshot as the model's world state).
2. **Think**: `backend.step(act, call_results, tool_map)` sends the prompt + observation to the
   Nova model, which returns a small **AWL program** (Agent Workflow Language — JS-like statements).
   The raw program is decoded and trace-logged every step.
3. **Interpret** (`src/nova_act/impl/interpreter.py`): the interpreter accepts at most **one
   `think("…")` statement immediately before the final statement**, plus **exactly one terminal
   action**: `agentClick`, `agentHover`, `agentType`, `agentScroll`, `goToUrl`, `wait`, `return`,
   or `throw`. `think` is a real registered tool whose contract is *"Has no effect on the
   environment. Should be used for reasoning about the next action."* — i.e., **the thinking tag is
   already a first-class, per-step, machine-readable artifact**, not something we need to scrape
   from logs.
4. **Act**: the program is compiled against the tool map (JSON-schema-validated arguments) and run
   by `ProgramRunner`; results feed the next step. `AgentRedirectError` lets the client reject an
   action and inject a correction string back into the loop.
5. **Terminate**: `return` completes the act (result string / `act_get()` schema extraction),
   `throw` raises `ActAgentFailed`; `max_steps` and `timeout` bound the loop; pause/cancel run
   through `NovaStateController`; each step is appended to the `Act` object and persisted to
   trajectory files (`run_info_compiler.py`, session logs directory).

**Important clarification**: the `Thinker` class (`impl/thinker.py`) is *only a console spinner*
(animated dots while waiting on the model) — it is UX, not reasoning. The actual reasoning stream
is the `think()` calls inside AWL programs.

**Consequences for UserSync:**

- Exposing thinking (Depth-2 pillar 1) is an **extraction problem, not an engine change**: capture
  `think()` calls per step via the existing `EventHandler`/trace pipeline and stream them to the
  frontend; persona-styled restyling is a post-processing layer.
- The action vocabulary is small and closed (6 actions + return/throw) — translating it to OASIS
  social actions (§ Tab 6 fusion) is a tractable mapping exercise.
- Persona steering has no native slot (no system prompt, no persona param) — it must live in our
  workflow layer: prompt composition, tool restriction, guardrails, pacing, and actuator overrides
  (table in §4).
- One `think` + one action per step means persona pacing/hesitation is naturally simulated by
  inserting `wait` steps and observation delays rather than fighting the loop.
- The `workflow` module (`types/workflow.py`, `cli/workflow/`) already gives us named, deployable,
  run-tracked workflow definitions — the landing zone for the `ui-test-execution-agent`
  transformation and the unit the Journeys tab schedules.

---

## 8. Workstation Packs (app consistency model)

Features group into **workstation packs**: coherent frontend areas that run together in the full
product but can be split into independently deployable stations backed by narrow FastAPI services.
A pack is a pattern of UI surfaces + APIs + data artifacts + permissions that users experience as
one job-to-be-done.

| Pack | Tabs (this spec) | API stack | Split-out station |
| --- | --- | --- | --- |
| 1. Journey Execution | Tab 1 (+ Tab 7 dev mode) | Journey & Nova Act Runtime API | `usersync-journey-station` |
| 2. Steering & Analysis | Tab 2 | Steering & Analysis API | `usersync-steering-station` |
| 3. Visualization & Research | graph views in Tabs 5/6 | Visualization API | `usersync-visual-station` |
| 4. Persona & Experience | Tab 4 (+ lenses in Tab 3) | Persona Hub + Experience Lens API | `usersync-persona-station` |
| 5. DataHub Integration | Tab 5 | DataHub & Integration API | `usersync-data-station` |
| 6. Social Enrichment | Tab 6 | Social Mirror API | `usersync-social-station` |
| 7. Design & Brand Review | Figma surfaces of Tabs 1/3/5 | Journey + Visualization + DataHub APIs | `usersync-design-station` |
| 8. Developer, Identity & Billing | Tab 7 | Developer/Identity/Billing API | `usersync-dev-station` |

Consistency rules:

- Every pack exposes its own narrow FastAPI router and MCP tool group; all packs share identity,
  entitlement, audit, provenance, and artifact-storage conventions.
- Same design language everywhere (§2 interaction grammar).
- Cross-pack dependencies appear as linked source objects in the UI.
- Stations stay composable: each can run alone for a narrow buyer; the full app stitches them
  through shared IDs, HF `/data` artifacts, graph references, and API contracts.
- No oversized endpoints: cross-pack orchestration passes **artifact IDs and provenance
  references, not giant payloads** (`journey_run_id`, `persona_id`, `datahub_snapshot_id`,
  `research_drop_id`, `graph_id`, `figma_frame_id`).

Feature consistency pattern:

```text
Frontend pack
  -> Narrow FastAPI router
  -> Shared auth/entitlement check
  -> Pack-specific artifact
  -> HF /data + optional graph-store reference
  -> Visualization / report / downstream steering promotion
```

---

## 9. Hugging Face Space Deployment Model

Each pack is buildable as its own HF Space, testable and sellable alone, and combinable into the
full app through a thin **UserSync Gateway API** (cross-pack routing, account lookup, quota
enforcement, audit logging, artifact-reference passing).

```text
Full UserSync frontend
  -> UserSync Gateway API
    -> usersync-journey-station    /api/journeys, /api/nova-runtime
    -> usersync-steering-station   /api/steering, /api/analysis
    -> usersync-visual-station     /api/visualizations, /api/graph-research
    -> usersync-persona-station    /api/personas, /api/lenses
    -> usersync-data-station       /api/datahub, /api/connectors, /api/graph-store
    -> usersync-social-station     /api/social-mirror, /api/research-drops
    -> usersync-design-station     /api/design-review, /api/figma
    -> usersync-dev-station        /api/developer, /api/account, /api/billing
```

Per-Space runtime requirements:

- FastAPI app mounted under the pack base paths; small standalone frontend shell.
- HF OAuth login reading identity from the shared account layer.
- `/healthz`; `/openapi.json` with stable operation IDs; `/mcp` manifest when the pack exposes
  agent-callable tools (gateway generates MCP namespaces `usersync.journey.*`, `usersync.visual.*`,
  `usersync.persona.*`, `usersync.social.*`, …).
- Shared headers: `Authorization`, `X-UserSync-Account-Id`, `X-UserSync-Workspace-Id`,
  `X-UserSync-Run-Id`, `X-UserSync-Artifact-Root`.
- Shared response envelope: `artifact_id`, `provenance`, `quota`, `warnings`, `next_actions`.
- Storage under `/data/users/{hf_user_id}/…` with pack subfolders
  (`journeys/ steering/ analyses/ visualizations/ graph_research/ personas/ lenses/ connectors/
  graph_snapshots/ social_mirror/ research_drops/ design_reviews/ account/ usage/`).
- Optional Neo4j/Neptune connection through HF Secrets where graph runtime is needed.

Combination rules: expose capabilities not internals; pass artifact references not payloads;
gateway is source of truth for auth/quotas/budgets; provenance is portable (source Space, endpoint,
input artifact IDs, user/account IDs, timestamp, version); each Space independently useful; MCP
tools generated from pack OpenAPI.

Gateway service-registry entry (shape):

```json
{
  "usersync-visual-station": {
    "space_url": "https://huggingface.co/spaces/usersync/usersync-visual-station",
    "api_base_path": "/api/visualizations",
    "openapi_url": "/openapi.json",
    "mcp_manifest_url": "/mcp",
    "quota_category": "visualization_api_calls",
    "artifact_root": "/data/users/{hf_user_id}/visualizations"
  }
}
```

---

## 10. Current State (what exists today, honestly)

| Asset | State | Fate under this spec |
| --- | --- | --- |
| `UserSync/` frontend (6 tabs + subview slider) | Working Vite/React prototype | Rebranded Tab-1 seed; re-wired to FastAPI/nova-act workflows |
| `UserSync/server.cjs` (Express) | Only running backend; real HF OAuth; mock nova/mindwalk/omniparser endpoints | Replaced by per-pack FastAPI services + gateway |
| `UserSync/fastapi_app.py` | Inert reference, not deployed | Seed of the first FastAPI station |
| `src/nova_act/` | Full Nova Act SDK incl. `workflow` module | **The engine.** Untouched core; extended via §4 steering surfaces |
| `ui-test-execution-agent/` (Java) | Standalone, unintegrated | **Dissolved** → Nova Act native workflow templates (Tab 1) |
| `oasis/` | Docs/data/assets only; **no `generator/` vendored** | Vendor/depend on upstream; wrap `generator/` behind Persona Hub API |
| `last30days-skill/` | Full standalone CLI/skill | Wrapped as paid research-drop service in DataHub |
| `nova-act-agent-skills/` | Skill/packaging metadata | Source for MCP tool wrapping conventions |
| HF login | Real OAuth in Express; cookie-only, no user records | Anchor identity for account layer; move to shared account resolution + tokens/credits |

## 11. Implementation Order

1. Rebrand Tab 1 to UserSync (brand mark, titles, `branding.ts` promise lines, token file).
2. Stand up the first FastAPI station (`usersync-journey-station`) from `fastapi_app.py`: `/healthz`,
   `/openapi.json`, HF OAuth, `/api/journeys` triggering a real `nova_act` workflow.
3. Port one `ui-test-execution-agent` scenario as a Nova Act workflow template; delete-parity list.
4. Nova Configurations tab: device profiles + first limitation profiles on existing constructor
   params; CDP throttling next.
5. Expose the `think()` stream per step in the run trace UI (Depth-2 pillar 1, extraction only).
6. DataHub skeleton: HF `/data` artifact conventions, persona graph from OASIS sample data
   (`oasis/data/reddit/user_data_36.json`), first connector stub (Figma or HubSpot).
7. Vendor OASIS `generator/`; Persona Hub API placeholder around it.
8. Social Mirror: OASIS Reddit/X simulation on generated personas; comparison views; prompt-fusion
   prototype (§ Tab 6, design 1).
9. Gateway + service registry; account layer with 1000-credit metering (Supabase placeholder).
10. Steering Lab tab once §4 concepts harden through use.
