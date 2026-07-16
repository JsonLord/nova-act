"""DataHub & Integration API: artifacts, connector imports, and unification.

Implements spec.md §16 (data unification): three source modes —
synthetic-only, company data (HubSpot/Salesforce-shaped CRM records), and
last30days social research — normalized into UnifiedTraits, which translate
into GenerationSpec distributions and finally into steering parameters.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import list_artifacts, load_artifact, save_artifact

router = APIRouter(prefix="/api/datahub", tags=["datahub"])
connectors_router = APIRouter(prefix="/api/connectors", tags=["connectors"])
graph_store_router = APIRouter(prefix="/api/graph-store", tags=["graph-store"])


@graph_store_router.get("/status", operation_id="graph_store_status")
def graph_store_status():
    """Neo4j/Neptune connection status (spec §10). Reports configured +
    live connectivity; safe to call whether or not secrets are set."""
    from backend.app.graph_store import status

    return envelope(data=status())


class GraphExportRequest(BaseModel):
    persona_hub_id: str


@graph_store_router.post("/export", operation_id="graph_store_export")
def graph_store_export(body: GraphExportRequest, user_id: str = Depends(get_user_id)):
    """Export a persona hub's graph to Neo4j (placeholder — dry-run summary
    until a real DB is attached in-Space)."""
    from backend.app.graph_store import export_graph

    hub = load_artifact(user_id, "personas", body.persona_hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="persona hub not found")
    return envelope(data=export_graph(body.persona_hub_id, hub["data"]["graph"]))


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
    research_drop_id: str | None = None  # reference a stored last30days drop
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

    # Resolve a stored research drop (from /api/connectors/last30days/import).
    research_drop = body.research_drop
    if research_drop is None and body.research_drop_id:
        drop_record = load_artifact(user_id, "research_drops", body.research_drop_id)
        if drop_record is None:
            raise HTTPException(status_code=404, detail="research_drop_id not found")
        research_drop = ResearchDropSummary(**{
            k: v for k, v in drop_record["data"].items()
            if k in ResearchDropSummary.model_fields
        })

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

    if body.mode == "company_social" and research_drop is not None:
        drop = research_drop
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
            "research_drop": research_drop is not None,
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


class FigmaImportRequest(BaseModel):
    file_key: str
    token: str  # Figma PAT or OAuth token; used per-request, kept only in the snapshot provenance-free
    render_frames: bool = False


@connectors_router.post("/figma/import", operation_id="connector_figma_import")
def figma_import(
    body: FigmaImportRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("connector_import", cost=5)),
):
    """Real Figma import: fetch the file's frame inventory (and optional
    render URLs) and store a normalized design snapshot for the ux-chain and
    DataHub. The token is used for the live call only, never persisted."""
    from backend.app.connectors.figma import (
        FigmaError,
        fetch_file,
        fetch_frame_images,
        normalize_design_snapshot,
    )

    try:
        file_json = fetch_file(body.file_key, body.token)
        snapshot = normalize_design_snapshot(body.file_key, file_json)
        if body.render_frames and snapshot["frames"]:
            node_ids = [f["id"] for f in snapshot["frames"][:20] if f["id"]]
            images = fetch_frame_images(body.file_key, node_ids, body.token)
            for frame in snapshot["frames"]:
                frame["render_url"] = images.get(frame["id"])
    except FigmaError as error:
        raise HTTPException(status_code=502, detail=str(error))

    record = save_artifact(
        user_id, "graph_snapshots", "figma_snapshot", snapshot,
        provenance={"connector": "figma", "file_key": body.file_key, "paid_service": True},
    )
    return envelope(
        data={"connector": "figma", "file": snapshot["name"], "frames": snapshot["frame_count"]},
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        next_actions=[
            {"action": "ux_chain", "endpoint": "/api/ux-chain/runs"},
            {"action": "journey", "endpoint": "/api/journeys"},
        ],
    )


class ResearchDropRequest(BaseModel):
    topic: str  # the customer profile / brand to research
    platforms: list[str] = Field(default_factory=lambda: ["reddit", "x"])


@connectors_router.post("/last30days/import", operation_id="connector_last30days_import")
def last30days_import(
    body: ResearchDropRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("research_drop", cost=8)),
):
    """Paid research-drops service: run last30days across the requested
    platforms and store a normalized ResearchDropSummary that feeds
    /api/datahub/unify. Platforms are the skill's own coverage (reddit, x,
    tiktok, instagram, youtube, bluesky, hackernews, truthsocial, web)."""
    from backend.app.connectors.last30days import SUPPORTED_PLATFORMS, research

    summary = research(body.topic, body.platforms)
    record = save_artifact(
        user_id, "research_drops", "research_drop", summary,
        provenance={"connector": "last30days", "topic": body.topic,
                    "platforms": summary["platforms"], "simulated": summary["simulated"]},
    )
    return envelope(
        data={"topic": body.topic, "summary": summary, "supported_platforms": SUPPORTED_PLATFORMS},
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        warnings=["last30days skill not runnable here; returned a simulated drop"]
        if summary["simulated"] else [],
        next_actions=[{"action": "unify", "endpoint": "/api/datahub/unify"}],
    )


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
