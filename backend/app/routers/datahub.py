"""DataHub & Integration API: artifacts, connector imports, and unification.

Implements spec.md §16 (data unification): three source modes —
synthetic-only, company data (HubSpot/Salesforce-shaped CRM records), and
last30days social research — normalized into UnifiedTraits, which translate
into GenerationSpec distributions and finally into steering parameters.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import list_artifacts, save_artifact

router = APIRouter(prefix="/api/datahub", tags=["datahub"])
connectors_router = APIRouter(prefix="/api/connectors", tags=["connectors"])


class CrmRecord(BaseModel):
    """Normalized shape every CRM connector maps into (HubSpot contact,
    Salesforce lead/contact, generic CSV)."""

    age: int | None = None
    gender: str | None = None
    country: str | None = None
    job_title: str | None = None
    lifecycle_stage: str | None = None  # lead / customer / churned ...
    engagement_score: float | None = None  # 0..1 from email/deal activity
    support_tickets: int | None = None
    nps: int | None = None  # -100..100 or 0..10 scale, normalized below


class ResearchDropSummary(BaseModel):
    """Normalized last30days output for the customer profile under test."""

    sentiment: float = 0.0  # -1..1 toward the brand
    top_topics: list[str] = Field(default_factory=list)
    complaint_topics: list[str] = Field(default_factory=list)
    activity_level: float = 0.5  # 0..1 posting/commenting intensity
    sample_quotes: list[str] = Field(default_factory=list)


class UnifyRequest(BaseModel):
    mode: Literal["synthetic", "company", "company_social"] = "synthetic"
    crm_records: list[CrmRecord] = Field(default_factory=list)
    research_drop: ResearchDropSummary | None = None
    monitoring_avg_session_s: float | None = None


def _distribution(values: list[Any]) -> dict[str, float]:
    counts = Counter(v for v in values if v is not None)
    total = sum(counts.values()) or 1
    return {str(k): v / total for k, v in counts.items()}


@router.post("/unify", operation_id="datahub_unify")
def unify(
    body: UnifyRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("datahub_unify", cost=1)),
):
    """Unify data sources into UnifiedTraits -> GenerationSpec overrides.

    synthetic:       defaults only — personas mimic no one in particular.
    company:         CRM records shape demographics + literacy/patience means,
                     so the pool mimics the real customer base.
    company_social:  additionally, last30days research shapes brand affinity,
                     opinion topics, and activity levels from what customers
                     say and do online right now.
    """
    traits: dict[str, Any] = {"mode": body.mode}
    warnings: list[str] = []

    if body.mode in ("company", "company_social") and body.crm_records:
        ages = [r.age for r in body.crm_records if r.age]
        if ages:
            traits["age_range"] = [min(ages), max(ages)]
        traits["genders"] = _distribution([r.gender for r in body.crm_records])
        traits["countries"] = _distribution([r.country for r in body.crm_records])
        traits["professions"] = _distribution([r.job_title for r in body.crm_records])
        engagement = [r.engagement_score for r in body.crm_records if r.engagement_score is not None]
        if engagement:
            # Engaged customers correlate with digital literacy of the pool.
            traits["digital_literacy_mean"] = 2.0 + 3.0 * (sum(engagement) / len(engagement))
        tickets = [r.support_tickets or 0 for r in body.crm_records]
        if tickets:
            # Heavy support usage signals lower tolerance -> lower patience mean.
            avg_tickets = sum(tickets) / len(tickets)
            traits["patience_mean"] = max(1.5, 3.5 - 0.3 * avg_tickets)
        nps = [r.nps for r in body.crm_records if r.nps is not None]
        if nps:
            avg_nps = sum(nps) / len(nps)
            center = max(-2, min(2, round(avg_nps / 30)))  # -100..100 -> -2..2
            traits["brand_affinity"] = _affinity_distribution(center)
    elif body.mode in ("company", "company_social"):
        warnings.append("mode requires crm_records; falling back to synthetic defaults")

    if body.mode == "company_social" and body.research_drop is not None:
        drop = body.research_drop
        center = max(-2, min(2, round(drop.sentiment * 2)))
        traits["brand_affinity"] = _affinity_distribution(center)
        traits["opinion_topics"] = drop.top_topics[:3] or None
        traits["complaint_topics"] = drop.complaint_topics
        traits["activity_level"] = drop.activity_level
        traits["sample_quotes"] = drop.sample_quotes[:5]

    if body.monitoring_avg_session_s is not None:
        # Short real sessions -> impatient pool (validated against telemetry).
        traits["patience_mean"] = max(
            1.5, min(4.5, body.monitoring_avg_session_s / 120)
        )

    record = save_artifact(
        user_id,
        "connectors",
        "unified_traits",
        traits,
        provenance={
            "mode": body.mode,
            "crm_records": len(body.crm_records),
            "research_drop": body.research_drop is not None,
        },
    )
    return envelope(
        data=traits,
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        warnings=warnings,
        next_actions=[
            {"action": "generate_personas", "endpoint": "/api/personas/generate"},
        ],
    )


def _affinity_distribution(center: int) -> dict[str, float]:
    """A peaked distribution over -2..2 centered on the observed affinity."""
    weights = {}
    for value in range(-2, 3):
        distance = abs(value - center)
        weights[str(value)] = {0: 0.4, 1: 0.2, 2: 0.08, 3: 0.03, 4: 0.01}[distance]
    total = sum(weights.values())
    return {k: v / total for k, v in weights.items()}


@router.get("/records", operation_id="datahub_records")
def records(folder: str = "connectors", user_id: str = Depends(get_user_id)):
    return envelope(data=list_artifacts(user_id, folder))


@connectors_router.post("/{connector}/import", operation_id="connector_import")
def connector_import(
    connector: Literal["hubspot", "salesforce", "figma", "csv"],
    payload: dict[str, Any],
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("connector_import", cost=5)),
):
    """Paid connector import (stub): stores the raw payload as a snapshot.

    Real connectors will authenticate against the vendor API and map fields
    to CrmRecord; the snapshot id feeds /api/datahub/unify.
    """
    record = save_artifact(
        user_id,
        "graph_snapshots",
        f"{connector}_snapshot",
        payload,
        provenance={"connector": connector, "paid_service": True},
    )
    return envelope(
        data={"connector": connector, "records": len(payload.get("records", []))},
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        next_actions=[{"action": "unify", "endpoint": "/api/datahub/unify"}],
    )
