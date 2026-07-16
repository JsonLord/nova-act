"""OpenEngine v1 — text-mode journey execution on CPU (spec.md §17.3 phase 2).

The observe→think→act loop mirroring the frozen Nova contract (§17.2):
each step the model returns ``{"think": ..., "action": ..., "args": ...}``
with exactly one action from the vocabulary. Observation is a serialized
DOM (numbered visible interactive elements) — no GPU, no vision required;
the model is the caller's BYOK text slot.

Steering (derive_steering output) binds natively:
  observing: viewport, observation_delay_ms, re-reads
  thinking:  self-description system prompt, max_steps
  acting:    allowed-action filtering, hesitation waits, frustration abort

Runs execute in a worker thread (Playwright sync API); the journey artifact
is re-saved after every step so GET /api/journeys/{id} streams progress.
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Callable

from backend.app.engines import ACTION_VOCABULARY
from backend.app.storage import save_artifact

# One prompt in, model text out — injected so tests can script the model.
LlmCall = Callable[[str, str], str]  # (system, user) -> text

CHROMIUM_CANDIDATES = [
    "/opt/pw-browsers/chromium/chrome",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
]

MAX_ELEMENTS = 40
MAX_CONSECUTIVE_FAILURES_DEFAULT = 3

STEP_SYSTEM_TEMPLATE = """{self_description}

You are operating a web browser one step at a time to reach a goal.
Each turn you receive the page state: URL, title, and a numbered list of
visible interactive elements.

Respond with ONLY a JSON object:
{{"think": "<one sentence of reasoning, in character>",
  "action": "<one of: {actions}>",
  "args": {{...}}}}

Action arguments:
  agentClick:  {{"index": <element number>}}
  agentType:   {{"index": <element number>, "text": "..."}}
  agentScroll: {{"direction": "down" | "up"}}
  agentHover:  {{"index": <element number>}}
  goToUrl:     {{"url": "https://..."}}
  wait:        {{"seconds": <float <= 5>}}
  return:      {{"value": "<what you accomplished / found>"}}
  throw:       {{"message": "<why the goal is impossible>"}}

Rules: one action per turn. Use return as soon as the goal is met.
Use throw when you are stuck or the goal cannot be achieved."""


def find_chromium() -> str | None:
    return next((path for path in CHROMIUM_CANDIDATES if os.path.exists(path)), None)


def serialize_page(page: Any, max_elements: int = MAX_ELEMENTS) -> dict[str, Any]:
    """Numbered, visible interactive elements with normalized coordinates."""
    elements = []
    handles = page.query_selector_all(
        "a, button, input, select, textarea, [role='button'], [role='link'], [onclick]"
    )
    viewport = page.viewport_size or {"width": 1280, "height": 800}
    for handle in handles:
        if len(elements) >= max_elements:
            break
        try:
            if not handle.is_visible():
                continue
            box = handle.bounding_box()
            if not box:
                continue
            text = (handle.inner_text() or "").strip()[:80]
            if not text:
                text = (
                    handle.get_attribute("placeholder")
                    or handle.get_attribute("aria-label")
                    or handle.get_attribute("value")
                    or handle.get_attribute("name")
                    or ""
                )[:80]
            elements.append(
                {
                    "index": len(elements),
                    "tag": handle.evaluate("el => el.tagName.toLowerCase()"),
                    "text": text,
                    "x": round((box["x"] + box["width"] / 2) / viewport["width"], 4),
                    "y": round((box["y"] + box["height"] / 2) / viewport["height"], 4),
                    "_handle": handle,
                }
            )
        except Exception:
            continue
    return {"url": page.url, "title": page.title(), "elements": elements}


def observation_text(observation: dict[str, Any]) -> str:
    lines = [f"URL: {observation['url']}", f"Title: {observation['title']}", "Interactive elements:"]
    for element in observation["elements"]:
        lines.append(f"  [{element['index']}] <{element['tag']}> {element['text']}")
    if not observation["elements"]:
        lines.append("  (none visible)")
    return "\n".join(lines)


def parse_action(text: str) -> dict[str, Any]:
    """Extract {think, action, args} from model output; raises on garbage."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("no JSON object in model output")
    parsed = json.loads(match.group(0))
    action = parsed.get("action")
    if action not in ACTION_VOCABULARY:
        raise ValueError(f"unknown action: {action}")
    return {
        "think": str(parsed.get("think", "")),
        "action": action,
        "args": parsed.get("args") or {},
    }


def _steer(steering: dict | None, *path: str, default: Any = None) -> Any:
    node: Any = steering or {}
    for key in path:
        if not isinstance(node, dict) or key not in node:
            return default
        node = node[key]
    # SteeredValue dicts carry the actual value under "value".
    if isinstance(node, dict) and "value" in node:
        return node["value"]
    return node


def run_journey(
    user_id: str,
    run_id: str,
    run: dict[str, Any],
    llm_call: LlmCall,
    provenance: dict[str, Any],
) -> None:
    """Execute the journey in-place, re-persisting the artifact per step."""
    steering = run.get("steering")
    max_steps = int(_steer(steering, "thinking", "max_steps", default=20))
    observation_delay_s = float(_steer(steering, "observing", "observation_delay_ms", default=300)) / 1000
    hesitation_s = float(_steer(steering, "acting", "hesitation_wait_s", default=0))
    frustration_abort = int(
        _steer(steering, "acting", "frustration_abort_after_failed_steps",
               default=MAX_CONSECUTIVE_FAILURES_DEFAULT)
    )
    allowed = _steer(steering, "acting", "allowed_actions", default=None) or ACTION_VOCABULARY
    allowed = list(set(allowed) | {"return", "throw", "wait"})  # terminals always available
    viewport = _steer(steering, "observing", "viewport", default=(1280, 800))
    system = STEP_SYSTEM_TEMPLATE.format(
        self_description=run.get("act_prompt", run.get("goal", "")),
        actions=", ".join(a for a in ACTION_VOCABULARY if a in allowed),
    )

    def persist(status: str) -> None:
        run["status"] = status
        save_artifact(user_id, "journeys", "journey_run", run, provenance=provenance, artifact_id=run_id)

    from playwright.sync_api import sync_playwright

    consecutive_failures = 0
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=find_chromium())
            page = browser.new_page(viewport={"width": int(viewport[0]), "height": int(viewport[1])})
            page.goto(run["target_url"], wait_until="domcontentloaded", timeout=30000)
            persist("running")

            for step_index in range(max_steps):
                time.sleep(observation_delay_s)
                observation = serialize_page(page)
                handles = {e["index"]: e.pop("_handle") for e in observation["elements"]}

                try:
                    raw = llm_call(system, observation_text(observation) + f"\n\nGoal: {run['goal']}")
                    step = parse_action(raw)
                except Exception as error:  # model garbage counts as a failed step
                    run["steps"].append({"i": step_index, "think": "", "action": "invalid",
                                         "args": {}, "ok": False, "error": str(error)[:200]})
                    consecutive_failures += 1
                    if consecutive_failures >= frustration_abort:
                        run["result"] = f"aborted: frustration threshold after {consecutive_failures} failures"
                        persist("failed")
                        break
                    persist("running")
                    continue

                if step["action"] not in allowed:
                    step["ok"] = False
                    step["error"] = f"action {step['action']} not allowed for this persona"
                    run["steps"].append({"i": step_index, **step})
                    consecutive_failures += 1
                    persist("running")
                    continue

                element = handles.get(step["args"].get("index")) if "index" in step["args"] else None
                coords = next(
                    (
                        {"x": e["x"], "y": e["y"]}
                        for e in observation["elements"]
                        if e["index"] == step["args"].get("index")
                    ),
                    {"x": None, "y": None},
                )
                ok, error = True, None
                try:
                    time.sleep(hesitation_s)
                    action, args = step["action"], step["args"]
                    if action == "agentClick" and element is not None:
                        element.click(timeout=10000)
                    elif action == "agentType" and element is not None:
                        element.fill(str(args.get("text", "")), timeout=10000)
                    elif action == "agentHover" and element is not None:
                        element.hover(timeout=10000)
                    elif action == "agentScroll":
                        delta = 600 if args.get("direction", "down") == "down" else -600
                        page.mouse.wheel(0, delta)
                    elif action == "goToUrl":
                        page.goto(str(args.get("url", "")), wait_until="domcontentloaded", timeout=30000)
                    elif action == "wait":
                        time.sleep(min(float(args.get("seconds", 1)), 5))
                    elif action in ("agentClick", "agentType", "agentHover"):
                        ok, error = False, f"element index {args.get('index')} not found"
                except Exception as caught:
                    ok, error = False, str(caught)[:200]

                run["steps"].append(
                    {"i": step_index, "think": step["think"], "action": step["action"],
                     "args": step["args"], "url": observation["url"], **coords,
                     "ok": ok, **({"error": error} if error else {})}
                )

                if step["action"] == "return":
                    run["result"] = str(step["args"].get("value", ""))
                    persist("completed")
                    break
                if step["action"] == "throw":
                    run["result"] = str(step["args"].get("message", ""))
                    persist("failed")
                    break

                consecutive_failures = 0 if ok else consecutive_failures + 1
                if consecutive_failures >= frustration_abort:
                    run["result"] = f"aborted: frustration threshold after {consecutive_failures} failures"
                    persist("failed")
                    break
                persist("running")
            else:
                run["result"] = f"exceeded max steps ({max_steps})"
                persist("failed")
            browser.close()
    except Exception as fatal:
        run["result"] = f"engine error: {str(fatal)[:300]}"
        persist("failed")
