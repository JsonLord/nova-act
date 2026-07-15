"""Persona Hub API: generation, enrichment, graphs, steering (wraps oasis/generator)."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import load_artifact, save_artifact
from oasis.generator.generation import Distribution, GenerationSpec, generate_personas
from oasis.generator.schema import CompanyContext
from oasis.generator.steering import build_act_prompt, derive_steering

router = APIRouter(prefix="/api/personas", tags=["personas"])


class GenerateRequest(BaseModel):
    company_name: str = ""
    product_name: str = ""
    product_description: str = ""
    business_case: Literal["usability_test", "u_test", "content_test", "branding_test"] = (
        "usability_test"
    )
    count: int = Field(default=12, ge=1, le=10000)
    seed: int = 42
    ties_per_persona: int = Field(default=2, ge=0, le=10)
    # Data unification (spec.md §16): distributions derived by /api/datahub/unify
    unified_traits_id: str | None = None
    datahub_snapshot_ids: list[str] = Field(default_factory=list)
    research_drop_ids: list[str] = Field(default_factory=list)


def _spec_from_request(body: GenerateRequest, user_id: str) -> GenerationSpec:
    spec = GenerationSpec(
        company=CompanyContext(
            company_name=body.company_name,
            product_name=body.product_name,
            product_description=body.product_description,
            business_case=body.business_case,
            datahub_snapshot_ids=body.datahub_snapshot_ids,
            research_drop_ids=body.research_drop_ids,
        ),
        count=body.count,
        seed=body.seed,
        ties_per_persona=body.ties_per_persona,
    )
    if body.unified_traits_id:
        unified = load_artifact(user_id, "connectors", body.unified_traits_id)
        if unified is None:
            raise HTTPException(status_code=404, detail="unified_traits_id not found")
        traits = unified["data"]
        if traits.get("age_range"):
            spec.age_range = tuple(traits["age_range"])  # type: ignore[assignment]
        for key, attr in (("genders", "genders"), ("countries", "countries")):
            if traits.get(key):
                setattr(
                    spec, attr,
                    Distribution(list(traits[key].keys()), list(traits[key].values())),
                )
        if traits.get("digital_literacy_mean"):
            spec.digital_literacy_mean = traits["digital_literacy_mean"]
        if traits.get("patience_mean"):
            spec.patience_mean = traits["patience_mean"]
        if traits.get("brand_affinity"):
            spec.brand_affinity = Distribution(
                [int(k) for k in traits["brand_affinity"].keys()],
                list(traits["brand_affinity"].values()),
            )
    return spec


@router.post("/generate", operation_id="personas_generate")
def generate(
    body: GenerateRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("persona_generation", cost=1)),
):
    spec = _spec_from_request(body, user_id)
    hub = generate_personas(spec)
    graph = hub.to_graph_payload()
    record = save_artifact(
        user_id,
        "personas",
        "persona_hub",
        {
            "graph": graph,
            "oasis_reddit": [p.to_oasis_reddit_profile() for p in hub.personas],
            "personas": [p.to_dict() for p in hub.personas],
        },
        provenance={
            "generator": "oasis.generator",
            "seed": body.seed,
            "unified_traits_id": body.unified_traits_id,
            "datahub_snapshot_ids": body.datahub_snapshot_ids,
        },
    )
    return envelope(
        data={"count": len(hub.personas), "edges": len(hub.edges), "graph": graph},
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        next_actions=[
            {"action": "derive_steering", "endpoint": f"/api/personas/{record['artifact_id']}/steering/0"},
            {"action": "simulate", "endpoint": "/api/social-mirror/simulations"},
        ],
    )


@router.get("/{hub_id}/graph", operation_id="personas_graph")
def get_graph(hub_id: str, user_id: str = Depends(get_user_id)):
    record = load_artifact(user_id, "personas", hub_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Persona hub not found")
    return envelope(data=record["data"]["graph"], artifact_id=hub_id, provenance=record["provenance"])


@router.get("/{hub_id}/steering/{index}", operation_id="personas_steering")
def get_steering(
    hub_id: str,
    index: int,
    goal: str = "",
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("steering_derivation", cost=1)),
):
    record = load_artifact(user_id, "personas", hub_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Persona hub not found")
    personas = record["data"]["personas"]
    if not 0 <= index < len(personas):
        raise HTTPException(status_code=404, detail="Persona index out of range")
    persona = _rebuild_persona(personas[index])
    config = derive_steering(persona, goal=goal)
    return envelope(
        data={
            "steering": config.to_dict(),
            "act_prompt": build_act_prompt(persona, goal or "Explore the product."),
        },
        artifact_id=f"{hub_id}:steering:{index}",
        provenance=config.provenance,
        quota=meter,
    )


def _rebuild_persona(raw: dict[str, Any]):
    from oasis.generator.schema import (
        EmotionalProfile,
        MentalProfile,
        Opinion,
        PhysicalProfile,
        UserSyncPersona,
    )

    return UserSyncPersona(
        **{
            **{k: raw[k] for k in (
                "realname", "username", "bio", "persona", "age", "gender", "mbti",
                "country", "profession", "interested_topics", "persona_id", "provenance",
            )},
            "physical": PhysicalProfile(**raw["physical"]),
            "mental": MentalProfile(**raw["mental"]),
            "emotional": EmotionalProfile(**raw["emotional"]),
            "opinions": [Opinion(**o) for o in raw["opinions"]],
            "company_context": CompanyContext(**raw["company_context"]),
        }
    )
