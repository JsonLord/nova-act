# Agent Deployment & Operational Guide

This document informs further developers and agents about operational configurations, deployment best practices, and tricks for maintaining the **Nova-Act Platform** on Hugging Face Spaces.

## 1. Deployment Configuration

### Target Space
- **Profile:** `Leon4gr45`
- **Space:** `nova-right-nav`
- **Full Identifier:** `Leon4gr45/nova-right-nav`
- **Frontend Port:** `7860` (Mandatory port exposed by the Node.js/Express server)

### Deployment Method
- **Docker SDK:** The application runs on a React (Vite) frontend with a Node/Express backend served out of `UserSync/`. This requires a customized multi-stage Dockerfile that builds the static frontend assets and runs the Express server at port `7860`.

### HF Token
- Loaded securely from environment variables at execution/build time (`HF_TOKEN_SECRET`).

---

## 2. API Exposure and Documentation

### Mandatory Endpoints

- **`/health`**
  - **Method:** GET
  - **Purpose:** Space health telemetry verification.
  - **Response Example:**
    ```
    OK
    ```

- **`/api-docs`**
  - **Method:** GET
  - **Purpose:** Detailed rest-swagger API spec catalog.
  - **Response Example:**
    ```json
    {
      "appName": "Nova-Act Branding Content Testing & Space Suite",
      "version": "2.1",
      "endpoints": [...]
    }
    ```

### Functional Endpoints

#### `/api/craft`
- **Method:** POST
- **Purpose:** Generates 3 engaging variations of marketing copy using advanced Blablador LLM.
- **Request Body:**
  ```json
  {
    "content": "Our security tool detects IAM vulnerability loops in AWS accounts instantly.",
    "variation": "social media post"
  }
  ```
- **Response Body:**
  ```json
  {
    "result": "1. 🚀 Detect IAM loops instantly...\n2. Protect your cloud infrastructure...\n3. Secure your AWS pipelines today..."
  }
  ```

#### `/api/save-data`
- **Method:** POST
- **Purpose:** Persist custom personas, simulation traces, and test suite definitions.
- **Request Body:**
  ```json
  {
    "type": "focus_group",
    "data": { "personas": [...] },
    "user": "developer"
  }
  ```
- **Response Body:**
  ```json
  {
    "success": true,
    "message": "Data saved as developer_focus_group_2024-07-14T20-33-00.json"
  }
  ```

#### `/api/list-data`
- **Method:** GET
- **Purpose:** Retrieve lists of previously persisted local configurations.
- **Query Params:** `type` (optional), `user` (optional)
- **Response Body:**
  ```json
  [
    {
      "user": "developer",
      "type": "focus_group",
      "timestamp": "2024-07-14T20-33-00",
      "data": { "personas": [...] }
    }
  ]
  ```

---

## 3. Ongoing Space Deployment Best Practices
1. Ensure the static React frontend is compiled and optimized before launching the Express server (`npm run build`).
2. Keep the space clean of auxiliary caches, `.log` files, and local artifacts by configuring `.hfignore` correctly.
3. Expose Port `7860` in the Dockerfile so that Hugging Face Proxy binds to the application traffic seamlessly.
