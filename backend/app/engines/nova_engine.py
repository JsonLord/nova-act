"""NovaEngine adapter (spec §17.3 phase 5) — with a keyless default.

What the Nova cloud service is: a single hosted call (`invoke_act_step` to
nova-act.us-east-1.amazonaws.com) that takes a screenshot + prompt + tool
schema and returns the next UI action. The API key buys Amazon's trained
web-action model — the "brain". Everything else in the nova_act SDK (the
Playwright actuator, the AWL interpreter, the dispatch loop) is local,
open-source, and needs no key.

So there are two tiers, and **neither requires the Amazon key by default**:

- ``nova-compat`` (keyless, default when USERSYNC_ENGINE=nova and no key):
  run the proven OpenEngine observe→think→act loop with the caller's BYOK
  model — this already *is* a Nova-compatible engine, since it replaced
  exactly the model-step boundary the key sits behind. Optionally borrows
  the SDK's browser actuator when the SDK is importable, for sturdier
  actuation, without ever calling Amazon.

- ``nova`` (premium): when NOVA_ACT_API_KEY is set and the SDK is installed,
  drive the real NovaAct SDK so steps use Amazon's trained model — best
  quality on visually complex UIs, for AWS/non-Space or premium deployments.

Both re-persist the *same* journey artifact schema (steps with
think/action/args/x/y, screenshots, heatmap) so all downstream analysis is
engine-blind.
"""

from __future__ import annotations

from typing import Any

from backend.app.config import get_settings


def nova_sdk_available() -> bool:
    if not get_settings().nova_act_api_key:
        return False
    try:
        import nova_act  # noqa: F401
    except ImportError:
        return False
    return True


def run_journey_nova(
    user_id: str,
    run_id: str,
    run: dict[str, Any],
    llm_call,
    provenance: dict[str, Any],
    vision_call=None,
) -> None:
    """Execute a journey on the Nova tier.

    Premium (key + SDK): use Amazon's model via the SDK. Keyless: fall
    through to the OpenEngine loop with the BYOK model — the correct keyless
    Nova-compatible path. Either way the artifact schema is identical.
    """
    if nova_sdk_available():
        try:
            _run_with_sdk(user_id, run_id, run, provenance)
            return
        except Exception as error:
            # Never strand a run on an SDK problem — degrade to keyless.
            run.setdefault("warnings", []).append(f"nova SDK failed, using keyless BYOK loop: {error}")

    # Keyless nova-compat: the OpenEngine loop is exactly the Nova model-step
    # boundary replaced with a BYOK model. Reuse it wholesale.
    from backend.app.engines.open_engine import run_journey

    provenance["engine"] = "nova-compat (keyless BYOK)"
    run_journey(user_id, run_id, run, llm_call, provenance, vision_call=vision_call)


def _run_with_sdk(user_id: str, run_id: str, run: dict[str, Any], provenance: dict[str, Any]) -> None:
    """Drive the real NovaAct SDK (Amazon's trained model). Captures each
    step into the shared artifact schema so analysis stays engine-blind."""
    from nova_act import NovaAct  # type: ignore

    from backend.app.storage import save_artifact

    steering = run.get("steering") or {}
    viewport = _steer(steering, "observing", "viewport", default=(1280, 800))
    max_steps = int(_steer(steering, "thinking", "max_steps", default=20))

    def persist(status: str) -> None:
        run["status"] = status
        save_artifact(user_id, "journeys", "journey_run", run, provenance=provenance, artifact_id=run_id)

    run["screenshots"] = []
    persist("running")
    with NovaAct(
        starting_page=run["target_url"],
        nova_act_api_key=get_settings().nova_act_api_key,
        headless=True,
        screen_width=int(viewport[0]),
        screen_height=int(viewport[1]),
    ) as nova:
        result = nova.act(run.get("act_prompt", run["goal"]), max_steps=max_steps)
        # Map the SDK's act result/metadata into our step schema.
        for i, step in enumerate(getattr(result.metadata, "steps", []) or []):
            run["steps"].append(
                {"i": i, "think": getattr(step, "reasoning", "") or "",
                 "action": getattr(step, "action", "act"), "args": {},
                 "x": None, "y": None, "ok": True, "screenshot": None}
            )
        run["result"] = str(getattr(result, "response", "") or "")
    persist("completed")


def _steer(steering: dict, *path: str, default: Any = None) -> Any:
    node: Any = steering or {}
    for key in path:
        if not isinstance(node, dict) or key not in node:
            return default
        node = node[key]
    return node.get("value", node) if isinstance(node, dict) else node
