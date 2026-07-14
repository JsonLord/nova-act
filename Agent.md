# Deployment Management & Agent Guide

This file outlines tricks, configurations, and ongoing deployment best practices for running this application on Hugging Face Spaces.

## 1. Deployment Configuration

### Target Space
- **Profile:** `Leon4gr45`
- **Space:** `nova-test`
- **Full Identifier:** `Leon4gr45/nova-test`
- **Frontend Port:** `7860` (mandatory for all Hugging Face Spaces)

### Deployment Method
Choose the correct SDK based on the app type based on the codebase language:

- **Docker SDK** — Used for this application to provide maximum flexibility with an Express backend and a React/Vite frontend.

### HF Token
- The environment variable `HF_TOKEN` must be set at execution time. Never hardcode the token. Always read it from the environment.

### Required Files
- `Dockerfile`
- `README.md` with Hugging Face YAML frontmatter:
  ```yaml
  ---
  title: Branding Content Testing
  sdk: docker
  app_port: 7860
  ---
  ```
- `.hfignore` to exclude unnecessary files
- This `Agent.md` file (must be committed before deployment)

---

## 2. API Exposure and Documentation

### Mandatory Endpoints
Every deployment **must** expose:

- **`/health`**
  - Returns HTTP 200 when the app is ready.
  - Required for Hugging Face to transition the Space from *starting* → *running*.

- **`/api-docs`**
  - Documents **all** available API endpoints.
  - Must be reachable at:
    `https://Leon4gr45-nova-test.hf.space/api-docs`

### Functional Endpoints

### /api-docs
- Method: GET
- Purpose: Documents all available API endpoints.
- Response: HTML page displaying API documentation.

### /health
- Method: GET
- Purpose: Simple healthcheck endpoint returning HTTP 200 OK.
- Response: "OK"

### /api/craft
- Method: POST
- Purpose: Help craft marketing and social media content based on input content and variation using Blablador API.
- Request:
  ```json
  {
    "content": "hello world",
    "variation": "social media post"
  }
  ```
- Response:
  ```json
  {
    "result": "..."
  }
  ```

### /api/config
- Method: GET
- Purpose: Retrieve OAuth client configuration.
- Response:
  ```json
  {
    "clientId": "some-client-id",
    "scopes": "openid profile"
  }
  ```

### /login
- Method: GET
- Purpose: Initiate OAuth login redirect flow to Hugging Face.
- Response: Redirects user to Hugging Face authorize page.

### /oauth/callback
- Method: GET
- Purpose: OAuth callback endpoint to exchange authorization code for an access token and retrieve user info.
- Response: Redirects user back to root / with hf_user cookie.

### /api/user
- Method: GET
- Purpose: Retrieve authenticated Hugging Face user details from hf_user cookie.
- Response:
  ```json
  {
    "name": "Jane Doe",
    "preferred_username": "janedoe",
    "picture": "https://..."
  }
  ```

### /api/logout
- Method: GET
- Purpose: Log out the user by clearing the hf_user cookie and redirecting to root /.
- Response: Redirects user to root /.

### /api/save-data
- Method: POST
- Purpose: Save JSON data to server's data directory under a unique timestamped filename.
- Request:
  ```json
  {
    "type": "branding",
    "data": { "theme": "dark" },
    "user": "janedoe"
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "message": "Data saved as janedoe_branding_2026-07-14-19-12-35-123Z.json"
  }
  ```

### /api/list-data
- Method: GET
- Purpose: Retrieve list of saved JSON data files filtered optionally by type and user.
- Response:
  ```json
  [
    {
      "user": "janedoe",
      "type": "branding",
      "timestamp": "2026-07-14T19-12-35-123Z",
      "data": { "theme": "dark" }
    }
  ]
  ```

All endpoints listed here appear in `/api-docs`.

---

## 3. Deployment Workflow

Precondition: Use the huggingface hub cli hf to check that the space is empty of files and delete any which are still in there and not belonging to the project to be uploaded.

### Standard Deployment Command
After any code change, run:

```bash
hf upload Leon4gr45/nova-test ./UserSync . --repo-type=space
```

### Scan build and run logs
To scan build logs (SSE):
```bash
curl -N -H "Authorization: Bearer <TOKEN>" "https://huggingface.co/api/spaces/Leon4gr45/nova-test/logs/build"
```

To get run logs (SSE):
```bash
curl -N -H "Authorization: Bearer <TOKEN>" "https://huggingface.co/api/spaces/Leon4gr45/nova-test/logs/run"
```

Wait up to 300 seconds to see if the deployment has been successful, and if not, fix the errors of deployment, and redeploy and monitor in a cycle until the space is running and reacts to the API endpoints.
