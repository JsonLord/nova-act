"""Steering API: auto-fill (§4.2) plus the developer steering surface.

Two layers, both API-accessible to developers:
- **Layer 1 (unauthored / discovered)** — `derive_steering(persona)`,
  deterministic and read-only. Devs read/compute it via `POST /api/steering/
  derive` (inline persona or hub ref) and `GET /api/personas/{hub}/steering/i`.
- **Layer 2 (authored)** — company/test-case overrides devs *may* set:
  steering profiles (CRUD) and `POST /api/steering/apply` (declarative
  override merge — the safe programmatic "runner").
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import list_artifacts, load_artifact, save_artifact

router = APIRouter(prefix="/api/steering", tags=["steering"])


def _persona_from_request(user_id: str, hub_id: str | None, index: int, inline: dict | None):
    """Resolve a persona from a stored hub or an inline to_dict() payload."""
    from backend.app.routers.personas import _rebuild_persona

    if inline is not None:
        return _rebuild_persona(inline)
    if hub_id is None:
        raise HTTPException(status_code=422, detail="provide persona_hub_id or an inline persona")
    hub = load_artifact(user_id, "personas", hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="persona hub not found")
    personas = hub["data"]["personas"]
    if not 0 <= index < len(personas):
        raise HTTPException(status_code=404, detail="persona index out of range")
    return _rebuild_persona(personas[index])


# --- Layer 1 (unauthored / discovered) developer access ----------------------

class DeriveRequest(BaseModel):
    persona_hub_id: str | None = None
    persona_index: int = 0
    persona: dict[str, Any] | None = None  # inline persona (to_dict shape)
    goal: str = ""


@router.post("/derive", operation_id="steering_derive")
def derive(body: DeriveRequest, user_id: str = Depends(get_user_id)):
    """Compute the read-only discovered steering for a persona (layer 1).

    Deterministic — a programmatic 'runner' over derive_steering for
    developers, accepting a stored hub reference or an inline persona."""
    from oasis.generator.steering import build_act_prompt, derive_steering

    persona = _persona_from_request(user_id, body.persona_hub_id, body.persona_index, body.persona)
    config = derive_steering(persona, goal=body.goal)
    return envelope(
        data={
            "steering": config.to_dict(),
            "act_prompt": build_act_prompt(persona, body.goal or "Explore the product."),
            "layer": "discovered (read-only)",
        },
        provenance=config.provenance,
    )


# --- Layer 2 (authored) developer access: profiles + apply -------------------

class SteeringProfile(BaseModel):
    name: str = "test-case"
    company_name: str = ""
    product_name: str = ""
    business_case: str = "usability_test"
    overrides: dict[str, Any] = Field(default_factory=dict)  # dotted-path -> value


@router.post("/profiles", operation_id="steering_profile_create")
def create_profile(body: SteeringProfile, user_id: str = Depends(get_user_id)):
    from backend.app.steering_apply import OverrideError, validate_overrides

    try:
        validate_overrides(body.overrides)
    except OverrideError as error:
        raise HTTPException(status_code=422, detail=str(error))
    record = save_artifact(user_id, "steering", "steering_profile", body.model_dump(),
                           provenance={"layer": "authored"})
    return envelope(data={**body.model_dump(), "id": record["artifact_id"]},
                    artifact_id=record["artifact_id"])


@router.get("/profiles", operation_id="steering_profile_list")
def list_profiles(user_id: str = Depends(get_user_id)):
    entries = [e for e in list_artifacts(user_id, "steering") if e["kind"] == "steering_profile"]
    return envelope(data=entries)


@router.get("/profiles/{profile_id}", operation_id="steering_profile_get")
def get_profile(profile_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "steering", profile_id)
    if record is None or record["kind"] != "steering_profile":
        raise HTTPException(status_code=404, detail="steering profile not found")
    return envelope(data={**record["data"], "id": profile_id}, artifact_id=profile_id)


@router.put("/profiles/{profile_id}", operation_id="steering_profile_update")
def update_profile(profile_id: str, body: SteeringProfile, user_id: str = Depends(get_user_id)):
    from backend.app.steering_apply import OverrideError, validate_overrides

    if load_artifact(user_id, "steering", profile_id) is None:
        raise HTTPException(status_code=404, detail="steering profile not found")
    try:
        validate_overrides(body.overrides)
    except OverrideError as error:
        raise HTTPException(status_code=422, detail=str(error))
    save_artifact(user_id, "steering", "steering_profile", body.model_dump(),
                  provenance={"layer": "authored"}, artifact_id=profile_id)
    return envelope(data={**body.model_dump(), "id": profile_id}, artifact_id=profile_id)


@router.delete("/profiles/{profile_id}", operation_id="steering_profile_delete")
def delete_profile(profile_id: str, user_id: str = Depends(get_user_id)):
    save_artifact(user_id, "steering", "steering_profile", {"deleted": True},
                  provenance={"layer": "authored", "deleted": True}, artifact_id=profile_id)
    return envelope(data={"id": profile_id, "deleted": True})


class ApplyOverridesRequest(BaseModel):
    persona_hub_id: str | None = None
    persona_index: int = 0
    persona: dict[str, Any] | None = None
    goal: str = ""
    overrides: dict[str, Any] = Field(default_factory=dict)
    steering_profile_id: str | None = None


@router.post("/apply", operation_id="steering_apply")
def apply(body: ApplyOverridesRequest, user_id: str = Depends(get_user_id)):
    """Merge authored (layer-2) overrides onto the discovered steering and
    return the effective config — the safe programmatic runner. Overridden
    values flip to source 'authored' and keep the discovered value."""
    from oasis.generator.steering import derive_steering
    from backend.app.steering_apply import OverrideError, apply_overrides

    overrides = dict(body.overrides)
    if body.steering_profile_id:
        profile = load_artifact(user_id, "steering", body.steering_profile_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="steering profile not found")
        overrides = {**profile["data"].get("overrides", {}), **overrides}

    persona = _persona_from_request(user_id, body.persona_hub_id, body.persona_index, body.persona)
    config = derive_steering(persona, goal=body.goal).to_dict()
    try:
        effective = apply_overrides(config, overrides)
    except OverrideError as error:
        raise HTTPException(status_code=422, detail=str(error))
    return envelope(
        data={"effective_steering": effective, "applied_overrides": list(overrides)},
        provenance={"layer": "discovered + authored"},
    )


class AutofillRequest(BaseModel):
    persona_hub_id: str
    persona_index: int = 0
    goal: str = ""


@router.post("/autofill", operation_id="steering_autofill")
async def autofill(
    body: AutofillRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("steering_autofill", cost=2)),
):
    from backend.app.llm_config import resolve_llm
    from backend.app.routers.personas import _rebuild_persona
    from oasis.generator.steering import derive_steering

    hub = load_artifact(user_id, "personas", body.persona_hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="persona hub not found")
    personas = hub["data"]["personas"]
    if not 0 <= body.persona_index < len(personas):
        raise HTTPException(status_code=404, detail="persona index out of range")
    persona = _rebuild_persona(personas[body.persona_index])

    config = derive_steering(persona, goal=body.goal).to_dict()
    llm_used = None
    warnings: list[str] = []

    text_llm = resolve_llm(request, user_id, "text")
    if text_llm is not None:
        from backend.app.llm import LlmCallError, chat

        try:
            restyle = await chat(
                text_llm,
                "Improve this instruction for restyling an agent's reasoning into a persona's "
                f"inner voice. Keep it one paragraph, imperative, faithful to every fact:\n\n"
                f"{config['thinking']['think_restyle_instruction']['value']}",
                temperature=0.4,
            )
            config["thinking"]["think_restyle_instruction"] = {
                "value": restyle.strip(),
                "source_fields": config["thinking"]["think_restyle_instruction"]["source_fields"],
                "rationale": f"LLM-composed ({text_llm.provider}/{text_llm.model}); deterministic draft kept in provenance",
            }
            if body.goal:
                goal_phrase = await chat(
                    text_llm,
                    f"Rephrase this journey goal in the voice and vocabulary of this persona "
                    f"(one sentence, first person):\nPersona: {persona.persona}\nGoal: {body.goal}",
                    temperature=0.6,
                )
                config["thinking"]["goal_phrasing"] = {
                    "value": goal_phrase.strip(),
                    "source_fields": ["persona", "goal"],
                    "rationale": f"LLM-composed ({text_llm.provider}/{text_llm.model})",
                }
            llm_used = f"{text_llm.provider}/{text_llm.model}"
        except LlmCallError as error:
            warnings.append(f"LLM composition failed, deterministic values kept: {error}")
    else:
        warnings.append("no BYOK text model — auto-fill returned deterministic values only")

    record = save_artifact(
        user_id,
        "steering",
        "steering_config",
        config,
        provenance={
            "persona_hub_id": body.persona_hub_id,
            "persona_index": body.persona_index,
            "goal": body.goal,
            "llm": llm_used,
            "numeric_rows": "deterministic (oasis.generator.steering)",
        },
    )
    return envelope(
        data=config,
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        warnings=warnings,
        next_actions=[{"action": "run_journey", "endpoint": "/api/journeys"}],
    )
