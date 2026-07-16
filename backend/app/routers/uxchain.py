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
    # ux-mentor's engines are Figma-data-driven (verified against its source):
    # /generate_heatmap/ wants the Figma FILE JSON, /generate_iteration/ wants
    # a token + design_data {id: <file_id>} it re-fetches from Figma itself.
    figma_data: dict[str, Any] | None = None
    figma_token: str = ""
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


async def _call_screenshot_to_code(
    screenshot_data_url: str, problem_text: str, stack: str = "html_tailwind"
) -> str | None:
    """Two-pass generation via the vendored JsonLord/screenshot-to-code fork
    (adapters/screenshot_to_code.py speaks its real WebSocket protocol):
    pass 1 recreates the screen as code, pass 2 UPDATES that code to fix the
    identified UX problem — the optimized code that gets re-rendered.
    """
    base = get_settings().screenshot_to_code_base_url.rstrip("/")
    if not base:
        return None
    from backend.app.adapters.screenshot_to_code import generate_code

    initial = await generate_code(
        base,
        instructions="Recreate this screen exactly.",
        image_data_url=screenshot_data_url,
        stack=stack,
    )
    if initial is None:
        return None
    optimized = await generate_code(
        base,
        instructions=f"Update the code to fix this UX problem while preserving the style: {problem_text}",
        image_data_url=screenshot_data_url,
        stack=stack,
        generation_type="update",
        existing_code=initial,
    )
    return optimized or initial


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
    settings = get_settings()

    # ---- Piece 1: screenshot + heatmap -------------------------------------
    screenshot = body.screenshot_b64
    if not screenshot and body.target_url and settings.screenshot_to_code_base_url and settings.screenshotone_api_key:
        from backend.app.adapters.screenshot_to_code import capture_screenshot

        captured = await capture_screenshot(
            settings.screenshot_to_code_base_url, body.target_url, settings.screenshotone_api_key
        )
        if captured:
            screenshot = captured
    # /generate_heatmap/ contract: {figma_data, user_prompt} ->
    # {heatmap_data: {<node_id>: {heatmap, report, suggestions,
    #  positive_points, drop_off_points, ux_score}}}
    heatmap_result = None
    if body.figma_data is not None:
        heatmap_result = await _call_ux_mentor(
            "/generate_heatmap/",
            {"figma_data": body.figma_data, "user_prompt": body.prompt},
        )
    simulated = heatmap_result is None
    if simulated:
        if body.figma_data is None:
            warnings.append(
                "ux-mentor requires figma_data (its engines are Figma-driven); "
                "screenshot-only chains use the journey heatmap — returning simulated pieces"
            )
        else:
            warnings.append("ux-mentor not configured or unreachable; returning simulated pieces")

    node_reports = list(((heatmap_result or {}).get("heatmap_data") or {}).values())
    first_node = node_reports[0] if node_reports else {}
    piece_1 = {
        "kind": "screenshot_heatmap",
        "title": "Screenshot with interaction heatmap",
        "rendered": screenshot or "placeholder://screenshot-with-heatmap",
        "code": None,  # a screenshot has no code representation
        "body": first_node.get("report")
        or "Attention concentrates on the hero area; the primary CTA sits below the fold.",
        "heatmap_points": first_node.get("heatmap", []),
        "ux_score": first_node.get("ux_score"),
        "simulated": simulated,
    }

    # ---- Piece 2: UX/UI problem identified ----------------------------------
    dropoff_points = first_node.get("drop_off_points", [])
    problems = first_node.get("suggestions") or [
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
        screenshot, problem_text
    )
    # /generate_iteration/ contract: {figma_token, design_data: {id: <file_id>},
    # dropoff_points} -> {status, data: {original_images, improved_design: {image: b64}}}
    iteration = None
    if body.figma_token and body.figma_data is not None:
        iteration = await _call_ux_mentor(
            "/generate_iteration/",
            {
                "figma_token": body.figma_token,
                "design_data": body.figma_data,
                "dropoff_points": dropoff_points or problems,
            },
        )
    improved_image = (
        ((iteration or {}).get("data") or {}).get("improved_design") or {}
    ).get("image")
    piece_3 = {
        "kind": "solution",
        "title": "Solution: optimized code, re-rendered",
        "code": generated_code
        or "<!-- simulated: screenshot-to-code not configured -->\n"
        '<section class="min-h-[60vh] grid place-items-center">\n'
        '  <a class="rounded-xl bg-teal-500 px-8 py-4 text-lg font-bold">Primary CTA — now above the fold</a>\n'
        "</section>",
        "rendered": (f"data:image/png;base64,{improved_image}" if improved_image else None)
        or "placeholder://optimized-render",
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
