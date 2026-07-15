"""UX Chain API: the 3-piece chain for website/app/content testing.

Chain (spec.md §17.3):
  Piece 1 — screenshot with heatmap (journey run heatmap or ux-mentor
            /generate_heatmap/)
  Piece 2 — the UX/UI problem identified on it
  Piece 3 — the solution: screenshot-to-code produces code for the screen,
            the code is optimized to fix the problem, and re-rendered to a
            screenshot that solves the issue (ux-mentor /generate_iteration/).

Modes mirror the three ux-mentor modes (https://leon4gr45-ux-mentor.hf.space):
  ux_analysis, user_journey, design_iteration.

Every piece carries BOTH representations where they exist — `code` and
`rendered` — so the frontend card can flip between them with the switch
control. External engines are optional: without UX_MENTOR_BASE_URL /
SCREENSHOT_TO_CODE_BASE_URL configured, pieces are returned as structured
simulations flagged `simulated: true` so the UI and contract stay testable.
"""

from __future__ import annotations

from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.app.config import get_settings
from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import load_artifact, save_artifact

router = APIRouter(prefix="/api/ux-chain", tags=["ux-chain"])

MODES = {
    "ux_analysis": {
        "label": "UX Analysis",
        "engine_endpoint": "/generate_heatmap/",
        "description": "Heatmaps, drop-off points, UX score, and suggestions.",
    },
    "user_journey": {
        "label": "User Journey",
        "engine_endpoint": "/generate_simulation/",
        "description": "Simulated task walkthrough with step script.",
    },
    "design_iteration": {
        "label": "Design Iteration",
        "engine_endpoint": "/generate_iteration/",
        "description": "AI-improved design frame fixing identified issues.",
    },
}


class ChainRequest(BaseModel):
    mode: Literal["ux_analysis", "user_journey", "design_iteration"] = "ux_analysis"
    target_url: str = ""
    screenshot_b64: str = ""
    figma_ref: str = ""
    journey_run_id: str = ""  # reuse a Nova run's screenshot+heatmap as piece 1
    prompt: str = ""


@router.get("/modes", operation_id="uxchain_modes")
def modes():
    return envelope(data=[{"id": key, **value} for key, value in MODES.items()])


async def _call_ux_mentor(endpoint: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    base = get_settings().ux_mentor_base_url.rstrip("/")
    if not base:
        return None
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(f"{base}{endpoint}", json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError:
        return None


async def _call_screenshot_to_code(screenshot_b64: str, instructions: str) -> str | None:
    """Adapter for a deployed abi/screenshot-to-code instance.

    The upstream repo cannot be vendored into this session (cross-owner);
    deploy a fork (e.g. JsonLord/screenshot-to-code) and point
    SCREENSHOT_TO_CODE_BASE_URL at it. Contract: screenshot in, HTML/Tailwind
    code out.
    """
    base = get_settings().screenshot_to_code_base_url.rstrip("/")
    if not base:
        return None
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{base}/api/generate-code",
                json={"image": screenshot_b64, "stack": "html_tailwind", "instructions": instructions},
            )
            response.raise_for_status()
            return response.json().get("code")
    except httpx.HTTPError:
        return None


@router.post("/runs", operation_id="uxchain_run")
async def create_chain_run(
    body: ChainRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("ux_chain_runs", cost=5)),
):
    if not (body.target_url or body.screenshot_b64 or body.figma_ref or body.journey_run_id):
        raise HTTPException(status_code=422, detail="Provide target_url, screenshot_b64, figma_ref, or journey_run_id")

    warnings: list[str] = []
    mode = MODES[body.mode]

    # ---- Piece 1: screenshot + heatmap -------------------------------------
    heatmap_result = await _call_ux_mentor(
        mode["engine_endpoint"] if body.mode == "ux_analysis" else "/generate_heatmap/",
        {"figma_ref": body.figma_ref, "url": body.target_url, "prompt": body.prompt},
    )
    simulated = heatmap_result is None
    if simulated:
        warnings.append("ux-mentor not configured or unreachable; returning simulated pieces")
    piece_1 = {
        "kind": "screenshot_heatmap",
        "title": "Screenshot with interaction heatmap",
        "rendered": (heatmap_result or {}).get("heatmap_image")
        or body.screenshot_b64
        or "placeholder://screenshot-with-heatmap",
        "code": None,  # a screenshot has no code representation
        "body": (heatmap_result or {}).get(
            "summary", "Attention concentrates on the hero area; the primary CTA sits below the fold."
        ),
        "simulated": simulated,
    }

    # ---- Piece 2: UX/UI problem identified ----------------------------------
    problems = (heatmap_result or {}).get("suggestions") or [
        {
            "problem": "Primary call-to-action below the fold on smartphone viewports",
            "evidence": "Heatmap density 0.72 in hero, 0.08 at CTA; 3 of 5 persona runs scrolled past it",
            "severity": "high",
        }
    ]
    piece_2 = {
        "kind": "problem",
        "title": "UX/UI problem identified",
        "rendered": None,
        "code": None,
        "body": problems,
        "simulated": simulated,
    }

    # ---- Piece 3: solution (code + re-rendered design) ----------------------
    problem_text = str(problems[0])
    generated_code = await _call_screenshot_to_code(
        body.screenshot_b64, f"Fix this UX problem, preserve style: {problem_text}"
    )
    iteration = await _call_ux_mentor(
        "/generate_iteration/", {"figma_ref": body.figma_ref, "problem": problem_text}
    )
    piece_3 = {
        "kind": "solution",
        "title": "Solution: optimized code, re-rendered",
        "code": generated_code
        or "<!-- simulated: screenshot-to-code not configured -->\n"
        '<section class="min-h-[60vh] grid place-items-center">\n'
        '  <a class="rounded-xl bg-teal-500 px-8 py-4 text-lg font-bold">Primary CTA — now above the fold</a>\n'
        "</section>",
        "rendered": (iteration or {}).get("image") or "placeholder://optimized-render",
        "body": "Code regenerated from the screenshot, optimized against the identified problem, "
        "and re-rendered; the new screenshot resolves the issue.",
        "simulated": generated_code is None and iteration is None,
    }

    chain = {"mode": body.mode, "pieces": [piece_1, piece_2, piece_3]}
    record = save_artifact(
        user_id,
        "design_reviews",
        "ux_chain_run",
        chain,
        provenance={
            "mode": body.mode,
            "engines": {
                "ux_mentor": bool(get_settings().ux_mentor_base_url),
                "screenshot_to_code": bool(get_settings().screenshot_to_code_base_url),
            },
            "journey_run_id": body.journey_run_id,
        },
    )
    return envelope(
        data=chain,
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        warnings=warnings,
        next_actions=[{"action": "design_agent_context", "endpoint": "/api/analysis/decisions"}],
    )


@router.get("/runs/{run_id}", operation_id="uxchain_get_run")
def get_chain_run(run_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "design_reviews", run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="chain run not found")
    return envelope(data=record["data"], artifact_id=run_id, provenance=record["provenance"])
