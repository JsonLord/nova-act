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

MAX_ELEMENTS = 60
MAX_CONSECUTIVE_FAILURES_DEFAULT = 3

# Single-pass in-page serializer (v2): broad interactive detection
# (elements + ARIA roles + cursor:pointer + contenteditable + tabindex),
# viewport awareness, color-dependence heuristic, saliency-ranked cap, and a
# readable page excerpt. Tags chosen elements with data-us-idx so actuation
# re-finds them by attribute instead of holding per-element RPC handles.
_SERIALIZE_JS = """(maxElements) => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const roles = ['button','link','tab','checkbox','radio','combobox','menuitem',
                 'switch','option','searchbox','slider','textbox'];
  const selector = 'a,button,input,select,textarea,[contenteditable],[onclick],' +
                   roles.map(r => `[role="${r}"]`).join(',') + ',[tabindex]';
  const seen = new Set();
  const candidates = [];
  // Recursive query piercing open shadow roots (in-page querySelectorAll
  // does not descend into them on its own).
  const collect = (root) => {
    for (const el of root.querySelectorAll(selector)) candidates.push(el);
    for (const el of root.querySelectorAll('div,span,li,img,svg')) {
      if (getComputedStyle(el).cursor === 'pointer') candidates.push(el);
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) collect(el.shadowRoot);
    }
  };
  collect(document);
  document.querySelectorAll('[data-us-idx]').forEach(el => el.removeAttribute('data-us-idx'));

  const items = [];
  for (const el of candidates) {
    if (seen.has(el)) continue;
    seen.add(el);
    // Skip if an already-collected ancestor is the real interactive target.
    if (el.closest('[data-us-cand]') && el.closest('[data-us-cand]') !== el) continue;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (rect.width < 2 || rect.height < 2) continue;
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    if (el.getAttribute('tabindex') === '-1' && !el.matches(selector.split(',[tabindex]')[0])) continue;
    el.setAttribute('data-us-cand', '1');
    let text = (el.innerText || '').trim().slice(0, 80);
    if (!text) text = (el.getAttribute('placeholder') || el.getAttribute('aria-label') ||
                       el.getAttribute('title') || el.getAttribute('alt') ||
                       el.getAttribute('value') || el.getAttribute('name') || '').slice(0, 80);
    const inViewport = rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0;
    // Color-dependence heuristic: colored background/text with little or no
    // label — the signal is carried by color (CVD personas miss it).
    const bg = style.backgroundColor, fg = style.color;
    const colored = (bg && bg !== 'rgba(0, 0, 0, 0)' && !/rgb\\((\\d+), \\1, \\1\\)/.test(bg));
    const colorDependent = colored && text.length <= 2;
    items.push({
      el,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      text,
      x: (rect.left + rect.width / 2) / vw,
      y: (rect.top + rect.height / 2) / vh,
      w: rect.width / vw,
      h: rect.height / vh,
      in_viewport: inViewport,
      color_dependent: colorDependent,
      saliency: (rect.width * rect.height) / (vw * vh),
    });
  }
  document.querySelectorAll('[data-us-cand]').forEach(el => el.removeAttribute('data-us-cand'));
  // In-viewport first, then visual prominence — the cap can no longer be
  // eaten by a nav bar in DOM order.
  items.sort((a, b) => (b.in_viewport - a.in_viewport) || (b.saliency - a.saliency));
  const kept = items.slice(0, maxElements);
  kept.forEach((item, i) => { item.el.setAttribute('data-us-idx', String(i)); });

  // Readable context: headings + leading body text, so the model can READ
  // the page (content testing), not just see control labels.
  const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 6)
    .map(h => h.innerText.trim()).filter(Boolean);
  const bodyText = (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 600);

  return {
    elements: kept.map((item, i) => ({
      index: i, tag: item.tag, role: item.role, text: item.text,
      x: Math.round(item.x * 1e4) / 1e4, y: Math.round(item.y * 1e4) / 1e4,
      w: Math.round(item.w * 1e4) / 1e4, h: Math.round(item.h * 1e4) / 1e4,
      in_viewport: item.in_viewport, color_dependent: item.color_dependent,
    })),
    headings, text_excerpt: bodyText,
  };
}"""

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


def _try_omniparser(page: Any) -> list[dict[str, Any]] | None:
    """Escalate to the OmniParser station (JsonLord/OmniParser deployed as a
    GPU Space running omnitool/omniparserserver): POST /parse/ with the
    screenshot, returns parsed_content_list. None when unconfigured/failed."""
    from backend.app.config import get_settings

    settings = get_settings()
    # CPU/ZeroGPU deployment toggle (spec §4.5): CPU tier never reaches for GPU.
    if not settings.visual_perception_enabled:
        return None
    base = settings.omniparser_base_url.rstrip("/")
    if not base:
        return None
    try:
        import base64

        import httpx

        screenshot_b64 = base64.b64encode(page.screenshot()).decode()
        response = httpx.post(f"{base}/parse/", json={"base64_image": screenshot_b64}, timeout=120)
        response.raise_for_status()
        return response.json().get("parsed_content_list") or None
    except Exception:
        return None


def serialize_page(page: Any, max_elements: int = MAX_ELEMENTS) -> dict[str, Any]:
    """Single-pass DOM serialization (v2): broad interactive detection,
    viewport-ranked cap, color-dependence flags, and a readable excerpt.
    Chosen elements are tagged with data-us-idx for later actuation."""
    result = page.evaluate(_SERIALIZE_JS, max_elements)
    return {
        "url": page.url,
        "title": page.title(),
        "elements": result["elements"],
        "headings": result["headings"],
        "text_excerpt": result["text_excerpt"],
    }


def observation_text(observation: dict[str, Any]) -> str:
    lines = [f"URL: {observation['url']}", f"Title: {observation['title']}"]
    if observation.get("headings"):
        lines.append("Headings: " + " | ".join(observation["headings"]))
    if observation.get("text_excerpt"):
        lines.append(f"Page text: {observation['text_excerpt']}")
    lines.append("Interactive elements:")
    for element in observation["elements"]:
        marker = "" if element.get("in_viewport", True) else " (below fold)"
        lines.append(f"  [{element['index']}] <{element['tag']}> {element['text']}{marker}")
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

    from backend.app.perception import apply_perception, omniparser_to_elements, profile_from_steering

    perception_profile = profile_from_steering(steering)
    look_counts: dict[str, int] = {}  # per-URL looks -> vision-latency widening

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
                coordinate_mode = False

                # Visual-surface escalation: a content-rich page with almost
                # no DOM interactables (canvas apps, Figma embeds) goes to
                # the OmniParser station when configured (spec §4.4).
                if len(observation["elements"]) < 3:
                    parsed = _try_omniparser(page)
                    if parsed:
                        observation["elements"] = omniparser_to_elements(parsed)
                        coordinate_mode = True

                # The steerable retina: filter what this persona perceives.
                look_index = look_counts.get(observation["url"], 0)
                look_counts[observation["url"]] = look_index + 1
                perception = apply_perception(observation["elements"], perception_profile, look_index)
                filtered = dict(observation, elements=perception.perceived)

                try:
                    raw = llm_call(system, observation_text(filtered) + f"\n\nGoal: {run['goal']}")
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

                target = next(
                    (e for e in perception.perceived if e["index"] == step["args"].get("index")),
                    None,
                ) if "index" in step["args"] else None
                coords = {"x": target["x"], "y": target["y"]} if target else {"x": None, "y": None}
                ok, error = True, None
                try:
                    time.sleep(hesitation_s)
                    action, args = step["action"], step["args"]
                    needs_element = action in ("agentClick", "agentType", "agentHover")
                    if needs_element and target is None:
                        # Persona-real failure: the model can only act on what
                        # the persona perceived.
                        ok, error = False, f"element index {args.get('index')} not perceived"
                    elif needs_element and coordinate_mode:
                        # OmniParser elements carry coordinates, not handles.
                        vw, vh = page.viewport_size["width"], page.viewport_size["height"]
                        if action == "agentType":
                            page.mouse.click(target["x"] * vw, target["y"] * vh)
                            page.keyboard.type(str(args.get("text", "")))
                        else:
                            page.mouse.click(target["x"] * vw, target["y"] * vh)
                    elif needs_element:
                        element = page.query_selector(f'[data-us-idx="{target["index"]}"]')
                        if element is None:
                            ok, error = False, "element vanished before actuation"
                        elif action == "agentClick":
                            element.click(timeout=10000)
                        elif action == "agentType":
                            element.fill(str(args.get("text", "")), timeout=10000)
                        else:
                            element.hover(timeout=10000)
                    elif action == "agentScroll":
                        delta = 600 if args.get("direction", "down") == "down" else -600
                        page.mouse.wheel(0, delta)
                    elif action == "goToUrl":
                        page.goto(str(args.get("url", "")), wait_until="domcontentloaded", timeout=30000)
                    elif action == "wait":
                        time.sleep(min(float(args.get("seconds", 1)), 5))
                except Exception as caught:
                    ok, error = False, str(caught)[:200]

                run["steps"].append(
                    {"i": step_index, "think": step["think"], "action": step["action"],
                     "args": step["args"], "url": observation["url"], **coords,
                     "ok": ok,
                     "perceived": len(perception.perceived),
                     "missed": len(perception.missed),
                     "missed_elements": [
                         {"text": m.get("text", ""), "x": m.get("x"), "y": m.get("y"),
                          "reason": m.get("missed_because", "")}
                         for m in perception.missed[:10]
                     ],
                     **({"error": error} if error else {})}
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
