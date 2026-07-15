"""HF OAuth router — Python port of the flow in UserSync/server.cjs."""

from __future__ import annotations

import base64
import json
import secrets

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

from backend.app.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _redirect_uri() -> str:
    settings = get_settings()
    if settings.space_host:
        return f"https://{settings.space_host}/api/auth/callback"
    return "http://localhost:7860/api/auth/callback"


@router.get("/config", operation_id="auth_config")
def auth_config():
    settings = get_settings()
    return {"clientId": settings.oauth_client_id, "scopes": settings.oauth_scopes}


@router.get("/login", operation_id="auth_login")
def login():
    settings = get_settings()
    if not settings.oauth_client_id:
        raise HTTPException(status_code=500, detail="OAuth is not configured (missing OAUTH_CLIENT_ID)")
    state = secrets.token_hex(16)
    url = (
        f"{settings.openid_provider_url}/oauth/authorize"
        f"?client_id={settings.oauth_client_id}"
        f"&redirect_uri={_redirect_uri()}"
        f"&scope={settings.oauth_scopes}"
        f"&response_type=code&state={state}"
    )
    response = RedirectResponse(url)
    response.set_cookie("oauth_state", state, httponly=True, max_age=600)
    return response


@router.get("/callback", operation_id="auth_callback")
async def callback(request: Request, code: str, state: str):
    settings = get_settings()
    if state != request.cookies.get("oauth_state"):
        raise HTTPException(status_code=403, detail="Invalid OAuth state")

    auth_header = base64.b64encode(
        f"{settings.oauth_client_id}:{settings.oauth_client_secret}".encode()
    ).decode()
    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post(
            f"{settings.openid_provider_url}/oauth/token",
            headers={
                "Authorization": f"Basic {auth_header}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(),
                "client_id": settings.oauth_client_id,
            },
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to retrieve access token")
        access_token = token_response.json()["access_token"]
        user_response = await client.get(
            "https://huggingface.co/api/whoami-v2",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_info = user_response.json()

    response = RedirectResponse("/")
    response.delete_cookie("oauth_state")
    response.set_cookie("hf_user", json.dumps(user_info), path="/")
    return response


@router.get("/user", operation_id="auth_user")
def user(request: Request):
    hf_user = request.cookies.get("hf_user")
    if not hf_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return json.loads(hf_user)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user cookie")


@router.get("/logout", operation_id="auth_logout")
def logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie("hf_user")
    return response
