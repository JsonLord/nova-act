import json
import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import Cookie, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

APP_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = APP_DIR / "dist"
LOCAL_DATA_DIR = APP_DIR / "data"
DEFAULT_DATA_DIR = Path(os.environ.get("DATA_DIR", "/data/usersync"))
TARGET_API_BASE_URL = os.environ.get("TARGET_API_BASE_URL", "https://auxteam-usersyncui.hf.space").rstrip("/")

OAUTH_CLIENT_ID = os.environ.get("OAUTH_CLIENT_ID")
OAUTH_CLIENT_SECRET = os.environ.get("OAUTH_CLIENT_SECRET")
OAUTH_SCOPES = os.environ.get("OAUTH_SCOPES", "openid profile")
OPENID_PROVIDER_URL = os.environ.get("OPENID_PROVIDER_URL", "https://huggingface.co").rstrip("/")
SPACE_HOST = os.environ.get("SPACE_HOST") or "leon4gr45-usersync.hf.space"
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", f"https://{SPACE_HOST}").rstrip("/")
REDIRECT_URI = os.environ.get("OAUTH_REDIRECT_URI", f"{PUBLIC_BASE_URL}/oauth/callback")
COOKIE_SECURE = PUBLIC_BASE_URL.startswith("https://")

app = FastAPI(
    title="UserSync",
    description="FastAPI backend for the UserSync Hugging Face Space UI and API proxy.",
    version="1.0.0",
)


class CraftRequest(BaseModel):
    content: str
    variation: str | None = None


class SaveDataRequest(BaseModel):
    type: str
    data: Any
    user: str


def _safe_segment(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]", "_", str(value))


def _data_dir() -> Path:
    try:
        DEFAULT_DATA_DIR.mkdir(parents=True, exist_ok=True)
        return DEFAULT_DATA_DIR
    except OSError:
        LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
        return LOCAL_DATA_DIR


def _proxy_headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    token = os.environ.get("HF_TOKEN") or os.environ.get("HF_API_KEY")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _proxy_request(method: str, path: str, json_body: Any | None = None) -> Any:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.request(
            method,
            f"{TARGET_API_BASE_URL}{path}",
            headers=_proxy_headers(),
            json=json_body,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/craft")
async def craft(payload: CraftRequest) -> dict[str, str]:
    api_key = os.environ.get("BLABLADOR_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="BLABLADOR_API_KEY is not configured on the server.")

    model = "alias-large" if len(payload.content) > 500 else "alias-fast"
    prompt = (
        f"You are a professional content creator. Help me craft a "
        f"{payload.variation or 'social media post'} based on the following content:\n\n"
        f"{payload.content}\n\nProvide 3 distinct and engaging variations."
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.helmholtz-blablador.fz-juelich.de/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that helps craft engaging marketing and social media content.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.7,
            },
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    return {"result": data["choices"][0]["message"]["content"]}


@app.get("/api/config")
async def config() -> dict[str, str | None]:
    return {"clientId": OAUTH_CLIENT_ID, "scopes": OAUTH_SCOPES}


@app.get("/login")
async def login() -> RedirectResponse:
    if not OAUTH_CLIENT_ID:
        raise HTTPException(status_code=500, detail="OAuth is not configured (missing OAUTH_CLIENT_ID)")

    state = secrets.token_hex(16)
    auth_url = f"{OPENID_PROVIDER_URL}/oauth/authorize?" + urlencode(
        {
            "client_id": OAUTH_CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "scope": OAUTH_SCOPES,
            "response_type": "code",
            "state": state,
        }
    )
    response = RedirectResponse(auth_url)
    response.set_cookie("oauth_state", state, httponly=True, max_age=600, samesite="lax", secure=COOKIE_SECURE)
    return response


@app.get("/oauth/callback")
async def oauth_callback(code: str, state: str, oauth_state: str | None = Cookie(default=None)) -> RedirectResponse:
    if not state or state != oauth_state:
        raise HTTPException(status_code=403, detail="Invalid OAuth state")
    if not OAUTH_CLIENT_ID or not OAUTH_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="OAuth client credentials are not configured")

    async with httpx.AsyncClient(timeout=60.0) as client:
        token_resp = await client.post(
            f"{OPENID_PROVIDER_URL}/oauth/token",
            auth=(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "client_id": OAUTH_CLIENT_ID,
            },
        )
    if token_resp.status_code >= 400:
        raise HTTPException(status_code=400, detail="Failed to retrieve access token")

    access_token = token_resp.json()["access_token"]
    async with httpx.AsyncClient(timeout=60.0) as client:
        user_resp = await client.get(
            "https://huggingface.co/api/whoami-v2",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if user_resp.status_code >= 400:
        raise HTTPException(status_code=user_resp.status_code, detail="Failed to retrieve Hugging Face user")

    response = RedirectResponse("/")
    response.delete_cookie("oauth_state")
    response.set_cookie("hf_user", json.dumps(user_resp.json()), path="/", httponly=False, samesite="lax", secure=COOKIE_SECURE)
    return response


@app.get("/api/user")
async def user(hf_user: str | None = Cookie(default=None)) -> Any:
    if not hf_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return json.loads(hf_user)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid user cookie") from exc


@app.get("/api/logout")
async def logout() -> RedirectResponse:
    response = RedirectResponse("/")
    response.delete_cookie("hf_user", path="/")
    return response


@app.post("/api/save-data")
async def save_data(payload: SaveDataRequest) -> dict[str, Any]:
    user = _safe_segment(payload.user)
    data_type = _safe_segment(payload.type)
    timestamp = datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    filename = f"{user}_{data_type}_{timestamp}.json"
    file_path = _data_dir() / filename
    file_path.write_text(
        json.dumps({"user": user, "type": data_type, "timestamp": timestamp, "data": payload.data}, indent=2),
        encoding="utf-8",
    )
    return {"success": True, "message": f"Data saved as {filename}"}


@app.get("/api/list-data")
async def list_data(type: str | None = None, user: str | None = None) -> list[Any]:
    data_dir = _data_dir()
    safe_user = _safe_segment(user) if user else None
    safe_type = _safe_segment(type) if type else None
    results: list[Any] = []

    for file_path in data_dir.glob("*.json"):
        try:
            record = json.loads(file_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if safe_type and record.get("type") != safe_type:
            continue
        if safe_user and record.get("user") != safe_user:
            continue
        results.append(record)
    return results


@app.get("/api/v1/personas")
async def personas() -> Any:
    return await _proxy_request("GET", "/api/v1/personas")


@app.post("/api/v1/personas/generate")
async def generate_personas(request: Request) -> Any:
    return await _proxy_request("POST", "/api/v1/personas/generate", await request.json())


@app.post("/api/v1/simulations")
async def create_simulation(request: Request) -> Any:
    return await _proxy_request("POST", "/api/v1/simulations", await request.json())


@app.get("/api/v1/simulations/{job_id}")
async def simulation_status(job_id: str) -> Any:
    return await _proxy_request("GET", f"/api/v1/simulations/{job_id}")


TAB_DEFINITIONS = [
    {"id": "focus-groups", "title": "1. Focus Groups", "upstream": "GET /api/v1/personas"},
    {"id": "generate-personas", "title": "2. Generate Personas", "upstream": "POST /api/v1/personas/generate"},
    {"id": "identify-personas", "title": "3. Identify Personas", "upstream": "local placeholder"},
    {"id": "social-network", "title": "4. Social Network", "upstream": "local placeholder"},
    {"id": "start-simulation", "title": "5. Start Simulation", "upstream": "POST /api/v1/simulations"},
    {"id": "simulation-status", "title": "6. Simulation Status", "upstream": "GET /api/v1/simulations/{job_id}"},
    {"id": "chat-message", "title": "7. Chat Message", "upstream": "local persistence"},
    {"id": "chat-history", "title": "8. Chat History", "upstream": "local persistence"},
    {"id": "variants", "title": "9. Generate Variants", "upstream": "local placeholder"},
    {"id": "export", "title": "10. Export & Personas", "upstream": "GET /api/v1/simulations/{job_id}"},
]


def _tab_response(tab_id: str, payload: dict[str, Any], result: Any) -> dict[str, Any]:
    return {"tab_id": tab_id, "space_url": PUBLIC_BASE_URL, "payload": payload, "result": result}


@app.get("/api/tabs")
async def api_tabs() -> list[dict[str, str]]:
    return TAB_DEFINITIONS


@app.post("/api/tabs/{tab_id}/run")
async def run_api_tab(tab_id: str, request: Request) -> dict[str, Any]:
    payload = await request.json()

    if tab_id == "focus-groups":
        return _tab_response(tab_id, payload, await personas())

    if tab_id == "generate-personas":
        body = {
            "business_description": payload.get("business_description", ""),
            "customer_profile": payload.get("customer_profile", ""),
            "num_personas": int(payload.get("num_personas") or 1),
        }
        return _tab_response(tab_id, body, await _proxy_request("POST", "/api/v1/personas/generate", body))

    if tab_id == "identify-personas":
        context = payload.get("context", "")
        return _tab_response(tab_id, payload, {"context": context, "status": "queued_for_persona_identification"})

    if tab_id == "social-network":
        return _tab_response(tab_id, payload, {"status": "network_request_recorded", "network": payload})

    if tab_id == "start-simulation":
        body = {
            "focus_group_id": payload.get("simulation_id", ""),
            "content_type": payload.get("format") or "text",
            "content_payload": payload.get("content_text", ""),
            "parameters": {},
        }
        return _tab_response(tab_id, body, await _proxy_request("POST", "/api/v1/simulations", body))

    if tab_id == "simulation-status":
        simulation_id = payload.get("simulation_id", "")
        return _tab_response(tab_id, payload, await _proxy_request("GET", f"/api/v1/simulations/{simulation_id}"))

    if tab_id == "chat-message":
        record = {
            "simulation_id": payload.get("simulation_id", ""),
            "sender": payload.get("sender") or "User",
            "message": payload.get("message", ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        chat_file = _data_dir() / f"chat_{_safe_segment(record['simulation_id'])}.jsonl"
        with chat_file.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record) + "\n")
        return _tab_response(tab_id, payload, {"saved": True, "message": record})

    if tab_id == "chat-history":
        chat_file = _data_dir() / f"chat_{_safe_segment(payload.get('simulation_id', ''))}.jsonl"
        history = []
        if chat_file.exists():
            history = [json.loads(line) for line in chat_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        return _tab_response(tab_id, payload, {"history": history})

    if tab_id == "variants":
        content = payload.get("content_text", "")
        count = int(payload.get("num_variants") or 5)
        variants = [{"variant": index + 1, "content": f"Variant {index + 1}: {content}"} for index in range(count)]
        return _tab_response(tab_id, payload, {"variants": variants})

    if tab_id == "export":
        action = payload.get("action") or "export_simulation"
        simulation_id = payload.get("simulation_id", "")
        if action in {"export_simulation", "get_network_graph"}:
            return _tab_response(tab_id, payload, await _proxy_request("GET", f"/api/v1/simulations/{simulation_id}"))
        if action == "list_personas":
            return _tab_response(tab_id, payload, await personas())
        if action == "get_persona":
            return _tab_response(tab_id, payload, {"simulation_id": simulation_id, "persona_name": payload.get("persona_name", ""), "status": "persona_lookup_ready"})
        if action == "delete_simulation":
            return _tab_response(tab_id, payload, {"simulation_id": simulation_id, "status": "delete_requested"})
        return _tab_response(tab_id, payload, {"status": "unknown_export_action", "action": action})

    raise HTTPException(status_code=404, detail=f"Unknown tab id: {tab_id}")


if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")


@app.get("/{full_path:path}")
async def spa(full_path: str) -> FileResponse:
    index_file = DIST_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=503, detail="Frontend build is not available. Run npm run build before serving.")

    requested = (DIST_DIR / full_path).resolve()
    if str(requested).startswith(str(DIST_DIR.resolve())) and requested.is_file():
        return FileResponse(requested)
    return FileResponse(index_file)
