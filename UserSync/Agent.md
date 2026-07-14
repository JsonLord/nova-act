# Deployment Agent Guidelines

This document details the configuration, architecture, and deployment procedures for the **SyncUsers & NovaAct Space Application**.

---

## 1. Deployment Configuration

### Target Space
- **Profile:** `Leon4gr45`
- **Space:** `nova-header-nav`
- **Target URL:** `https://huggingface.co/spaces/Leon4gr45/nova-header-nav`
- **Port:** `7860`

### Deployment SDK
- **Type:** Docker SDK
- **Reasoning:** Supports Node/Express for the server backend, combined with Vite/React frontend static assets distribution, offering maximum performance and flexibility.

---

## 2. API Exposure & Documentation

The space exposes the following functional REST API endpoints.

### Mandatory Endpoints

#### /health
- **Method:** GET
- **Purpose:** Verifies system health. Returns HTTP 200 OK. Required by Hugging Face orchestrator.

#### /api-docs
- **Method:** GET
- **Purpose:** Documents all functional server endpoints in OpenAPI format.
- **Location:** `https://Leon4gr45-nova-header-nav.hf.space/api-docs`

### Functional Endpoints

#### /api/craft
- **Method:** POST
- **Purpose:** Generates 3 distinct brand content copy variants using Helmholtz Blablador AI endpoints.
- **Request:**
  ```json
  {
    "content": "Our high-speed visual DB is launching today!",
    "variation": "LinkedIn Post"
  }
  ```
- **Response:**
  ```json
  {
    "result": "[Variation A]... [Variation B]... [Variation C]..."
  }
  ```

#### /api/save-data
- **Method:** POST
- **Purpose:** Save focus group, custom settings, or simulation parameters locally.
- **Request:**
  ```json
  {
    "type": "assemble",
    "data": {},
    "user": "anonymous"
  }
  ```

#### /api/list-data
- **Method:** GET
- **Purpose:** List previously saved configs filtered by owner/type.

---

## 3. Best Practices & Troubleshooting

### Build Failures: VITE CLI Not Found
- **Symptoms:** `Cannot find module '/app/node_modules/dist/node/cli.js' imported from /app/node_modules/.bin/vite`
- **Cause:** Local host's `node_modules` gets copied into build container context overriding container-specific packages.
- **Resolution:** A `.dockerignore` file containing `node_modules` must exist in the root of the upload repository.

### Local Testing
- Start the server using: `node server.cjs`
- Run Playwright E2E verification using: `npx playwright test`
