"""Steering API: the auto-fill endpoint (spec.md §4.2).

Numbers stay deterministic (derive_steering's reviewable mapping functions);
the caller's BYOK text LLM composes only the language rows — a persona-voiced
think-restyle instruction and a goal phrasing in the persona's vocabulary.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import load_artifact, save_artifact

router = APIRouter(prefix="/api/steering", tags=["steering"])


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
