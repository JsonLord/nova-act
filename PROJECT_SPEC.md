# PROJECT_SPEC: Header Navbar & Unified Nova-Act Architecture

This specification outlines the architecture, layout, API routes, data flows, tasks, and test plans required to construct a comprehensive 10-tab workspace that brings together the multiple frontend and backend packages in this repository (UserSync, Nova Act, Oasis, and last30days-skill).

---

## 1. Project Description & Vision

The objective of this project is to build a unified **Header Navbar** application that acts as a single pane of glass for all agent tools, automation capabilities, data extraction workflows, and simulation/testing suites in this repo.

### In‑App Integrations & Data Flows
The workspace consists of **10 distinct tabs** organized under a persistent main navigation header. The components interact through local state stores and unified API routes:
- **Tab 1 (Home/Landing)** serves as the central directory pointing to all main packages.
- **Tab 2 (Simulation Dashboard)** and **Tab 3 (Content Chat / Test Runner)** fetch and visualize data generated via **Tab 4 (Persona Builder)** and **Tab 5 (Content Craft)**.
- **Tab 6 (Browser Automation)**, **Tab 7 (QA Testing)**, and **Tab 8 (Data Extraction / Research)** provide direct user interaction with Nova Act (browser control), feeding competitive intelligence and research data directly back into the Persona Builder database.
- **Tab 9 (UI Verification)** runs deterministic MCP verification tools and builds regression reports.
- **Tab 10 (Deployment & Integrations)** acts as the configuration hub for AWS/IAM, MCP settings, Kiro Power packaging, and OAuth credentials.

---

### Proposed FastAPI Backend Setup
To transition the Node.js/Express server into a unified Python-based backend that directly integrates the Python SDKs (`nova_act`, `last30days-skill`, etc.), the following setup is specified.

#### App Structure
```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── usersync.py
│   │   ├── nova_act.py
│   │   ├── content_craft.py
│   │   ├── research.py
│   │   └── deployment.py
│   └── models/
│       └── schemas.py
└── requirements.txt
```

#### FastAPI Router Architecture & Dependency Injection
1. **Config & Environment (`config.py`)**:
   Uses `pydantic-settings` to load and validate variables:
   - `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `HF_TOKEN`, `BLABLADOR_API_KEY`.
   - SQLite or PostgreSQL connection strings for persistent storage.

2. **Dependency Injection (`dependencies.py`)**:
   - `get_current_user`: Handles verification of the Hugging Face session or JWT.
   - `get_db`: Handles database session injection.
   - `get_nova_client`: Instantiates the `NovaAct` Python client.

---

## 2. The 10-Tab Interface Specification

### Tab 1: Home / Landing
- **Purpose**: Welcoming entry point detailing system capabilities.
- **Features**: Card layouts with active status indicators for UserSync, Nova Act, UI Verification, and Docs. Quick shortcuts to assemble a focus group or launch an exploratory browser session.

### Tab 2: UserSync Simulation Dashboard
- **Dependencies**: Depends on selected focus groups from **Tab 4**, simulation runs executed in **Tab 3**.
- **Features**: Multi-agent network visualization mesh, real-time node sentiment graphs, and engagement metric comparisons. Filters for Country, Job Title, Sentiment, and Activity Level.

### Tab 3: UserSync Content Chat / Test Runner
- **Dependencies**: Selected Focus Group (Tab 4), Content Craft variants (Tab 5).
- **Features**: Text canvas to paste marketing copy, brand assets, or survey questions. "Simulate" and "Help Me Craft" execution controls with status polling logs. Integrates with the UserSync Simulation REST API.

### Tab 4: Persona / Focus Group Builder
- **Features**: Interactive forms to define Customer Profile, Company Information, and a slider for "Persona Scale" (Conservative to Radical). Integrates with UserSync local database persistence to feed directly into Tab 2 and Tab 3.

### Tab 5: Content Craft / Variant Studio
- **API Endpoint**: `/api/craft` (proxied to Helmholtz-Blablador LLM model).
- **Features**: Takes raw text and generates 3 distinct optimized variations (e.g., LinkedIn post, ad copy, email blast) with copy-to-clipboard functionality. Can run entirely standalone or feed into Tab 3.

### Tab 6: Nova Act Browser Automation
- **Features**: Interactive canvas displaying a live browser session controlled via Nova Act. Supports inputting URLs, clicking elements, and typing. Serves as the interactive UI foundation for exploratory QA.

### Tab 7: Nova Act QA / Flow Testing
- **API / Engine**: Nova Act SDK/CLI (`act()`, `act_get()`).
- **Features**: Code studio and visual block interface to build automated verification scripts (e.g., sign-up flow, checkout flow). Includes test result tables and execution logs.

### Tab 8: Nova Act Data Extraction / Research
- **API / Engine**: Nova Act SDK/CLI & `last30days-skill`.
- **Features**: Configurable structured extraction schemas (e.g., JSON schema for extracting price lists or competitor social media posts). Ability to feed this research directly as mock personas or context into UserSync.

### Tab 9: UI Verification
- **API / Engine**: `nova-act-mcp` with deterministic `verify_*` tools.
- **Features**: Automated pixel-perfect checks, structural layout tests, accessibility verifications, and visual regression report charts.

### Tab 10: Deployment / Production / Integrations
- **Features**: Central control room.
  - Hugging Face OAuth credential manager.
  - AWS/IAM policy and workflow builder.
  - MCP (Model Context Protocol) configuration schema editor.
  - Kiro Power packaging configurations.
  - Production deployment status logs and health documentation.

---

## 3. Exposed API Endpoints & Schemas

### A. Authentication Router (`/api/auth`)
- **GET `/api/auth/config`**
  - *Response*: `{ "clientId": "string", "scopes": "string" }`
- **GET `/api/auth/login`**
  - *Description*: Redirects user to Hugging Face OAuth page.
- **GET `/api/auth/callback`**
  - *Description*: Swaps authorization code for access token, stores secure cookie.
- **GET `/api/auth/user`**
  - *Response*: `{ "username": "string", "avatarUrl": "string" }`

### B. UserSync Router (`/api/usersync`)
- **POST `/api/usersync/assemble`**
  - *Request*: `{ "companyInfo": "string", "customerProfile": "string", "personaScale": int }`
  - *Response*: `{ "groupId": "string", "personas": ["string"] }`
- **POST `/api/usersync/simulate`**
  - *Request*: `{ "simulationId": "string", "content": "string", "variation": "string" }`
  - *Response*: `{ "jobId": "string", "status": "string" }`
- **GET `/api/usersync/status/{job_id}`**
  - *Response*: `{ "jobId": "string", "status": "string", "results": {} }`

### C. Content Craft Router (`/api/craft`)
- **POST `/api/craft`**
  - *Request*: `{ "content": "string", "variation": "string" }`
  - *Response*: `{ "result": "string" }`

### D. Nova Act Automation Router (`/api/nova-act`)
- **POST `/api/nova-act/action`**
  - *Request*: `{ "url": "string", "action": "string", "selector": "string", "value": "string" }`
  - *Response*: `{ "screenshot": "string", "currentUrl": "string", "success": bool }`
- **POST `/api/nova-act/extract`**
  - *Request*: `{ "url": "string", "schema": {} }`
  - *Response*: `{ "extracted_data": {} }`

---

## 4. Concrete Task Breakdown & Test Specifications

### Phase 1: Header & Navigation Layout (Frontend)
*   **Task 1.1**: Build persistent responsive `<HeaderNavbar />` with state-linked active tabs (Tabs 1 to 10).
    *   *Test*: **E2E Test (Playwright)**. Verify that clicking on each of the 10 tabs correctly updates the URL route and switches the active workspace view.
*   **Task 1.2**: Refactor `App.tsx` routing state to support the 10 tabs gracefully.
    *   *Test*: **Unit Test (React Testing Library)**. Check that the navbar highlights the active tab based on state updates.

### Phase 2: FastAPI Backend Setup (Backend)
*   **Task 2.1**: Implement the FastAPI base application, configuration loading with Pydantic, and health endpoints.
    *   *Test*: **Integration Test (Pytest)**. Verify `GET /health` returns status `200` and config handles missing variables securely.
*   **Task 2.2**: Migrate Node.js OAuth flows and Helmhotz-Blablador API endpoints into FastAPI routers.
    *   *Test*: **Integration Test (Pytest)**. Mock the Blablador LLM server and verify `POST /api/craft` correctly structures prompt inputs and handles success/error statuses.

### Phase 3: Persona & Content Simulation (Frontend + Backend)
*   **Task 3.1**: Connect Tab 4 Persona Builder to write newly configured agent groups to `/api/usersync/assemble`.
    *   *Test*: **E2E Test (Playwright)**. Fill out a custom user profile, select radical level "80", submit, and verify that the simulation graph updates with the new group.

### Phase 4: Nova Act & Research Integrations (Browser & MCP)
*   **Task 4.1**: Build interactive Canvas in Tab 6 for exploratory browser automation and Tab 8 data extraction forms.
    *   *Test*: **Integration Test**. Mock the Python `nova_act` SDK browser output and assert structured extraction correctly processes schema inputs.

### Phase 5: Production & Configuration Studio
*   **Task 5.1**: Build the visual deployment configuration forms (Tab 10) for AWS/IAM configuration, MCP setups, and Hugging Face parameters.
    *   *Test*: **Unit Test**. Assert form input validations correctly reject malformed AWS IAM policies.

---

## 5. Non-Goals & Core Assumptions
- The actual background orchestration of full 30-minute agent simulations is assumed to be run asynchronously by the external Gradio system; the FastAPI backend acts as a proxy, scheduler, and persistence logger.
- Visual elements of Tab 6 (interactive browser session) utilize a VNC-to-canvas stream or high-frequency screenshot polling over WebSockets.
- Security-critical AWS/IAM configurations created in Tab 10 are generated as downloadable JSON artifacts and are not auto-applied to real production environments without separate administrator approval.
