# UserSync Tabbed Frontend Vision

## Goal

Create one deployable Hugging Face Space that feels like a single UserSync product while it can host multiple existing frontends: the current UserSync app, Nova Act workflows, Nova Act's internal task tabs, Mindwalk UI rendering, and future operational tabs. The shell should make switching frontends feel as simple as changing browser tabs, without forcing every embedded app to be rewritten at once.

## Brand System

Rebrand the shared product as **UserSync** and apply the same visual language across the host shell and any Nova Act-adapted screens.

- **Name:** UserSync
- **Positioning:** coordinated user simulation, browser automation, and workflow evaluation in one workspace
- **Primary color:** sync blue `#2563EB`
- **Secondary color:** signal cyan `#06B6D4`
- **Accent color:** action violet `#7C3AED`
- **Background:** deep navy `#020617`
- **Surface:** slate `#0F172A`
- **Text:** near white `#F8FAFC`
- **Muted text:** blue gray `#94A3B8`
- **Success:** emerald `#10B981`
- **Warning:** amber `#F59E0B`

Nova Act should no longer appear as a separate Amazon-branded product in the deployed UI. It should be framed as **UserSync Act**, the automation engine inside UserSync. Product copy can still say "powered by Nova Act-compatible browser automation" in technical documentation where needed.

## Information Architecture

Use a persistent top-level shell with a left rail on desktop and a bottom tab bar on mobile. Every major frontend becomes a top-level tab in this shell.

| Tab | User-facing name | Purpose | Rendering model |
| --- | --- | --- | --- |
| 1 | Home | UserSync landing, onboarding, auth, and deployment status | Native React route |
| 2 | Simulation | Existing UserSync simulation builder and results | Existing UserSync React components |
| 3 | Act Studio | Rebranded Nova Act workflow authoring and execution | Native adapter around Nova Act workflows |
| 4 | Browser Live | Mindwalk / live browser rendering and session observation | iframe or webview panel with shell chrome |
| 5 | Runs | Unified history, traces, videos, artifacts, and metrics | Native React route backed by API |
| 6 | Settings | HF auth, API keys, model/runtime config, storage, and Space health | Native React route |

## Navigation Shell

### Desktop layout

- Fixed top bar with UserSync logo, active Space/user identity, environment pill, and deploy health.
- Left rail with icon + label tabs.
- Main content area with a route-level header that shows the selected tab title, description, primary action, and breadcrumbs when needed.
- Optional right inspector drawer for run metadata, logs, selected browser element details, or generated artifacts.

### Mobile layout

- Compact top bar with UserSync logo and user/avatar menu.
- Bottom tab bar with the four most important tabs: Home, Simulation, Act Studio, Runs.
- Browser Live and Settings move into a More menu.

### Switching behavior

- Tab switches should be instant and should preserve local state per tab.
- Long-running browser sessions should continue when the user switches away from Browser Live.
- The URL should be shareable: `/simulation`, `/act`, `/browser`, `/runs/:runId`, `/settings`.
- If a tab depends on auth or missing config, show an inline setup card instead of redirecting the user away.

## Visual Design Direction

The UI should adapt Nova Act and Mindwalk into the UserSync look instead of trying to make every frontend visually identical on day one.

### Shared shell

- Dark, high-contrast workspace that matches the current UserSync app direction.
- Rounded cards, subtle blue/cyan gradients, and thin slate borders.
- Consistent status pills for Idle, Running, Needs Attention, Passed, Failed.
- Consistent primary CTA styling: blue-to-cyan gradient for creation and execution actions.

### Embedded/adapted frontends

For existing frontends that are hard to rewrite immediately:

1. Wrap them in a **UserSync chrome adapter** with the shell header, tab title, and status actions.
2. Apply CSS variables where possible for colors, fonts, and buttons.
3. Hide or de-emphasize duplicate app headers inside iframes.
4. Add a small context banner only when the embedded app's branding cannot yet be fully replaced.

## Tab Details

### Home

Home should answer: "What can I do next?"

- Hero: "Build, simulate, and validate user workflows with UserSync."
- Cards for Start Simulation, Create Act Workflow, Watch Browser Live, View Latest Runs.
- Space readiness checklist: HF OAuth, persistent storage, API keys, browser runtime, backend health.
- Recent activity summary.

### Simulation

This is the current UserSync app's core experience. Keep its simulation-first flow but place it inside the shared shell.

- Prompt / scenario input
- Audience or persona configuration
- Simulation graph and results
- Export/share controls
- CTA to send a winning scenario into Act Studio for browser execution

### Act Studio

This is the rebranded Nova Act workspace.

- Workflow prompt composer
- Starting URL and session settings
- Secrets/API key readiness indicators
- Step timeline with natural-language actions
- Run button using UserSync styling
- Human-in-the-loop escalation state as "Needs review"

Recommended copy:

- "UserSync Act turns simulation intent into browser actions."
- "Draft, run, inspect, and promote workflows from one workspace."

### Browser Live

This hosts Mindwalk UI rendering and live session observation.

- Browser viewport centered in a card with a dark frame
- Session controls: pause, resume, stop, screenshot, record
- Element inspector drawer
- Live event log underneath or in the right rail
- Clear warning when the user should not manually interact with an active automation run

### Runs

Unify artifacts across Simulation, Act Studio, and Browser Live.

- Filterable run table
- Status, owner, created time, duration, source tab, and deployment environment
- Detail page with trace, transcript, video, screenshots, exported files, and retry/promote actions

### Settings

Make Hugging Face Space deployment operable by non-engineers.

- HF OAuth status
- Persistent storage status
- Environment variables checklist
- Backend endpoint and health check
- Browser runtime status
- Import/export config

## Hugging Face Space Deployment Shape

Ship as one Docker Space that serves the Vite frontend and a small backend.

Recommended process model:

- `server.cjs` serves the React app and auth/session endpoints.
- Backend proxies calls to Gradio, Nova Act-compatible runners, and artifact storage.
- Long-running jobs write run state and artifacts to persistent storage.
- Frontend polls or subscribes to run status updates.

Recommended routes:

- `/` Home
- `/simulation` UserSync simulation
- `/act` UserSync Act / Nova Act adapter
- `/browser` Mindwalk rendering panel
- `/runs` Run history
- `/settings` Space setup
- `/api/user` HF OAuth user info
- `/api/runs` unified run metadata
- `/api/health` backend/runtime health

## Implementation Phases

### Phase 1: Shippable shell

- Add shared `AppShell`, `TopBar`, `SideNav`, and `MobileTabBar` components.
- Move current view switching into route-like tab state.
- Rename visible product labels from SyncUsers/Nova Act to UserSync/UserSync Act.
- Add placeholder cards for Act Studio, Browser Live, Runs, and Settings.
- Keep existing Simulation components intact.

### Phase 2: Frontend adapters

- Wrap Nova Act UI flows in UserSync Act cards and headers.
- Add Mindwalk rendering in Browser Live with session controls.
- Add CSS variables for colors and spacing so embedded surfaces inherit UserSync branding.
- Normalize empty, loading, running, success, and failure states.

### Phase 3: Unified operations

- Add `/api/runs` and persistent run metadata.
- Store traces, videos, screenshots, and simulation outputs under a common run ID.
- Add Settings health checks for HF OAuth, persistent storage, browser runtime, and required secrets.
- Add one-click retry/promote actions between Simulation and Act Studio.

## Acceptance Criteria

A version is ready to ship when:

- A user can switch between all top-level tabs from the navbar without losing context.
- UserSync branding is visible in the shell, landing page, Simulation, Act Studio, and Browser Live.
- Nova Act appears as UserSync Act in user-facing UI.
- The app runs in a Hugging Face Docker Space with OAuth and persistent storage enabled.
- Missing backend/runtime configuration is explained in Settings with actionable setup cards.
- Runs from simulation and browser automation appear in one run history.

## Responsive Test Screen Sharing Inside UserSync Act

UserSync Act should include a native **Test Screen Share** panel for previewing the automated browser session across web, tablet, and mobile viewports without leaving the Act Studio tab. This makes responsive QA part of Nova Act-style execution rather than a separate Mindwalk-only surface.

### Placement inside Act Studio

Add a split workspace to the Act Studio tab:

- **Left panel:** workflow prompt, target URL, secrets/config readiness, run controls, and step timeline.
- **Center panel:** shared testing screen with the selected viewport frame.
- **Right panel:** inspector for logs, element metadata, screenshots, trace events, and human-review notes.

The center panel should become the primary focus while a run is active. On smaller screens, the panels collapse into stacked drawers so the shared test screen remains easy to inspect.

### Viewport modes

The shared testing screen should support three first-class viewport modes with a segmented control in the Act Studio header:

| Mode | Suggested viewport | Use case | Shell behavior |
| --- | --- | --- | --- |
| Web | `1440 x 900` or responsive full width | Desktop browser workflow testing | Full center canvas with optional right inspector |
| Tablet | `834 x 1194` portrait and `1194 x 834` landscape | Touch/tablet layout validation | Device frame centered on a neutral canvas |
| Mobile | `390 x 844` and `430 x 932` | Phone checkout, login, onboarding, and critical flows | Device frame with zoom controls and bottom action bar |

Each mode should include orientation switching, zoom fit, actual-size preview, screenshot capture, and a clear label showing viewport dimensions.

### UserSync Act rendering contract

To make existing Nova Act browser execution compatible with this screen-share UI, use a small rendering contract between the backend/session runner and the frontend:

```ts
type TestViewportMode = 'web' | 'tablet' | 'mobile';

type TestScreenState = {
  runId: string;
  mode: TestViewportMode;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  scale: number;
  status: 'idle' | 'starting' | 'running' | 'paused' | 'needs_review' | 'passed' | 'failed';
  screenshotUrl?: string;
  streamUrl?: string;
  activeStep?: string;
  lastEventAt?: string;
};
```

The Act Studio frontend should render `streamUrl` when live streaming is available and fall back to refreshing `screenshotUrl` when streaming is not available in the Hugging Face Space environment.

### Responsive layout rules

- **Desktop/web:** use a three-column Act Studio layout with a sticky shared-screen toolbar.
- **Tablet:** keep the test screen above the timeline, move the inspector into a slide-over drawer, and keep run controls in a sticky top bar.
- **Mobile:** show one panel at a time with tabs for Screen, Steps, and Logs; keep pause/stop/screenshot actions in a thumb-friendly bottom bar.
- **All sizes:** preserve the active run and viewport selection when switching to other top-level UserSync tabs.

### Screen sharing controls

The shared testing screen should expose these controls consistently across web, tablet, and mobile:

- Start run
- Pause/resume
- Stop run
- Request human review
- Capture screenshot
- Start/stop recording when supported
- Switch viewport mode
- Switch portrait/landscape
- Fit to panel / actual size
- Open latest trace artifact

Manual interaction with the shared browser should be disabled by default during active automation and require an explicit **Take control** action so the automation model is not surprised by user input.

### Hugging Face Space considerations

For Space deployment, the feature should degrade gracefully:

1. Prefer a live browser stream when the runtime supports it.
2. Fall back to periodic screenshots when WebSocket or VNC-style streaming is unavailable.
3. Store screenshots, recordings, and traces under the same run ID used by the Runs tab.
4. Show a Settings warning if browser streaming dependencies are missing.
5. Keep the UI useful even on mobile by making screenshot fallback the default reliable path.

### Acceptance criteria for responsive Act Studio screen sharing

- Users can run the same UserSync Act workflow in web, tablet, and mobile viewport modes from inside Act Studio.
- Users can switch viewport modes before starting a run and can view the selected dimensions during execution.
- The shared testing screen is usable on desktop, tablet, and phone layouts.
- Screenshots and recordings produced from the shared test screen are attached to the unified run record.
- If live streaming is unavailable in HF Spaces, the UI automatically falls back to screenshot refresh with a visible status message.
