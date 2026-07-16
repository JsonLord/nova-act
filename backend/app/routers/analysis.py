"""Steering & Analysis API: action-trace similarity graphs, graph Q&A, and
decision outputs for downstream (design) agents — spec.md §12.2, §12.3, §17.
"""

from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.app.envelope import envelope
from backend.app.quota import charge, get_user_id
from backend.app.storage import load_artifact, save_artifact

router = APIRouter(prefix="/api/analysis", tags=["analysis"])
qa_router = APIRouter(prefix="/api/graph-research", tags=["graph-research"])

GRID = 12  # heatmap raster resolution (GRID x GRID over the viewport)


class TraceStep(BaseModel):
    action: str  # agentClick / agentType / agentScroll / ...
    x: float = 0.0  # 0..1 normalized viewport coordinates
    y: float = 0.0
    think: str = ""


class TraceRun(BaseModel):
    run_id: str
    persona_id: str = ""
    steps: list[TraceStep]


class ActionTraceRequest(BaseModel):
    runs: list[TraceRun] = Field(min_length=1)


def _heatmap(steps: list[TraceStep]) -> list[list[int]]:
    grid = [[0] * GRID for _ in range(GRID)]
    for step in steps:
        col = min(GRID - 1, max(0, int(step.x * GRID)))
        row = min(GRID - 1, max(0, int(step.y * GRID)))
        grid[row][col] += 1
    return grid


def heatmap_similarity(a: list[list[int]], b: list[list[int]]) -> float:
    """Spatial overlap of rasterized interaction heatmaps (soft IoU)."""
    intersection = sum(min(a[r][c], b[r][c]) for r in range(GRID) for c in range(GRID))
    union = sum(max(a[r][c], b[r][c]) for r in range(GRID) for c in range(GRID))
    return intersection / union if union else 1.0


def thinking_similarity(a: str, b: str) -> float:
    """Cosine over term frequencies of raw think() text.

    Stand-in for an embedding model; the metric is pluggable and the choice
    is recorded in the artifact provenance so analyses stay comparable.
    """
    ta, tb = a.lower().split(), b.lower().split()
    if not ta or not tb:
        return 0.0
    from collections import Counter

    ca, cb = Counter(ta), Counter(tb)
    dot = sum(ca[t] * cb[t] for t in ca)
    norm = math.sqrt(sum(v * v for v in ca.values())) * math.sqrt(sum(v * v for v in cb.values()))
    return dot / norm if norm else 0.0


@router.post("/action-trace", operation_id="analysis_action_trace")
def action_trace(
    body: ActionTraceRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("analysis_api_calls", cost=2)),
):
    """Build the Action Trace Graph: run steps as nodes, sequence edges, and
    pairwise run similarity on both channels (heatmap / thinking)."""
    nodes, edges = [], []
    heatmaps, thoughts = {}, {}
    for run in body.runs:
        heatmaps[run.run_id] = _heatmap(run.steps)
        thoughts[run.run_id] = " ".join(s.think for s in run.steps)
        for i, step in enumerate(run.steps):
            node_id = f"{run.run_id}:{i}"
            nodes.append(
                {
                    "id": node_id,
                    "run_id": run.run_id,
                    "persona_id": run.persona_id,
                    "action": step.action,
                    "x": step.x,
                    "y": step.y,
                    "think": step.think,
                }
            )
            if i > 0:
                edges.append({"source": f"{run.run_id}:{i-1}", "target": node_id, "relation": "next"})

    similarities = []
    run_ids = [r.run_id for r in body.runs]
    for i, a in enumerate(run_ids):
        for b in run_ids[i + 1 :]:
            similarities.append(
                {
                    "a": a,
                    "b": b,
                    "heatmap_similarity": round(heatmap_similarity(heatmaps[a], heatmaps[b]), 4),
                    "thinking_similarity": round(thinking_similarity(thoughts[a], thoughts[b]), 4),
                }
            )

    graph = {"nodes": nodes, "edges": edges, "similarities": similarities, "variant": "action-trace"}
    record = save_artifact(
        user_id,
        "analyses",
        "action_trace_graph",
        graph,
        provenance={
            "runs": run_ids,
            "heatmap_metric": f"soft-IoU {GRID}x{GRID}",
            "thinking_metric": "tf-cosine (embedding-pluggable)",
        },
    )
    return envelope(
        data=graph,
        artifact_id=record["artifact_id"],
        provenance=record["provenance"],
        quota=meter,
        next_actions=[
            {"action": "graph_qa", "endpoint": "/api/graph-research/qa"},
            {"action": "decisions", "endpoint": "/api/analysis/decisions"},
        ],
    )


class DecisionRequest(BaseModel):
    action_trace_graph_id: str


@router.post("/decisions", operation_id="analysis_decisions")
def decisions(
    body: DecisionRequest,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("analysis_api_calls", cost=2)),
):
    """Turn an action-trace analysis into decision candidates (spec.md §17):
    where personas diverged, what that implies, and what to change."""
    record = load_artifact(user_id, "analyses", body.action_trace_graph_id)
    if record is None:
        raise HTTPException(status_code=404, detail="action trace graph not found")
    graph = record["data"]
    findings = []
    for sim in graph.get("similarities", []):
        acted_alike = sim["heatmap_similarity"] >= 0.6
        thought_alike = sim["thinking_similarity"] >= 0.6
        if acted_alike and not thought_alike:
            findings.append(
                {
                    "kind": "same_path_different_experience",
                    "runs": [sim["a"], sim["b"]],
                    "signal": "Personas took similar paths but experienced them differently — "
                    "inspect think() streams for friction one group absorbs silently.",
                    "decision_candidate": "Targeted copy/affordance fix on the shared path",
                }
            )
        elif thought_alike and not acted_alike:
            findings.append(
                {
                    "kind": "same_goal_different_path",
                    "runs": [sim["a"], sim["b"]],
                    "signal": "Personas reasoned alike but navigated differently — "
                    "the UI offers competing routes to the same intent.",
                    "decision_candidate": "Consolidate navigation; promote the shorter route",
                }
            )
        elif not acted_alike and not thought_alike:
            findings.append(
                {
                    "kind": "diverged",
                    "runs": [sim["a"], sim["b"]],
                    "signal": "Full divergence — segment-specific experience.",
                    "decision_candidate": "Persona-conditional design variant or onboarding",
                }
            )
    result = {"findings": findings, "source_graph": body.action_trace_graph_id}
    saved = save_artifact(user_id, "analyses", "decision_set", result, provenance=record["provenance"])
    return envelope(data=result, artifact_id=saved["artifact_id"], quota=meter)


class GraphQaRequest(BaseModel):
    graph_id: str
    graph_version: int = 1
    variant: str = "action-trace"
    focus_node_ids: list[str] = Field(default_factory=list)
    previous_qa: list[dict[str, Any]] = Field(default_factory=list)


@qa_router.post("/qa", operation_id="graph_qa")
async def graph_qa(
    body: GraphQaRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
    meter: dict = Depends(charge("visualization_api_calls", cost=1)),
):
    """LLM Q&A over a graph (spec.md §12.3): questions AND answers generated
    from the graph context via the caller's BYOK text slot, regenerated on
    graph updates. Without an LLM this degrades to deterministic template
    Q&A, keeping the contract (grounded_node_ids, stale/kept) intact."""
    record = load_artifact(user_id, "analyses", body.graph_id)
    if record is None:
        raise HTTPException(status_code=404, detail="graph not found")
    graph = record["data"]

    from backend.app.llm_config import resolve_llm

    text_llm = resolve_llm(request, user_id, "text")
    if text_llm is not None:
        import json as jsonlib

        from backend.app.llm import LlmCallError, chat

        context = jsonlib.dumps(
            {k: graph.get(k) for k in ("variant", "nodes", "edges", "similarities")}
        )[:12000]
        previous = jsonlib.dumps(body.previous_qa)[:4000]
        try:
            raw = await chat(
                text_llm,
                "You explain analysis graphs. Given this graph JSON, generate 3-5 insightful "
                "question+answer pairs a UX researcher would ask. Ground every answer in node "
                "ids. Keep still-valid previous questions, regenerate stale ones.\n"
                f"Graph:\n{context}\nPrevious Q&A:\n{previous}\n\n"
                'Respond with ONLY a JSON array: [{"question": "...", "answer": "...", '
                '"grounded_node_ids": ["..."], "stale": false}]',
                temperature=0.3,
            )
            match = __import__("re").search(r"\[.*\]", raw, __import__("re").DOTALL)
            qa = jsonlib.loads(match.group(0)) if match else []
            if qa:
                return envelope(
                    data={
                        "qa": qa,
                        "regenerated": [item.get("question") for item in qa],
                        "kept": [item.get("question") for item in body.previous_qa],
                        "llm": f"{text_llm.provider}/{text_llm.model}",
                    },
                    artifact_id=f"{body.graph_id}:qa:v{body.graph_version}",
                    quota=meter,
                )
        except (LlmCallError, ValueError):
            pass  # fall through to deterministic Q&A
    nodes = graph.get("nodes", [])
    sims = graph.get("similarities", [])
    qa = [
        {
            "question": "How many steps and runs does this graph contain?",
            "answer": f"{len(nodes)} steps across {len({n.get('run_id') for n in nodes})} runs.",
            "grounded_node_ids": [n["id"] for n in nodes[:5]],
            "stale": False,
        }
    ]
    if sims:
        closest = max(sims, key=lambda s: s["heatmap_similarity"])
        qa.append(
            {
                "question": "Which runs behaved most alike on the page?",
                "answer": (
                    f"Runs {closest['a']} and {closest['b']} overlap most on heatmaps "
                    f"({closest['heatmap_similarity']:.0%}) with thinking similarity "
                    f"{closest['thinking_similarity']:.0%}."
                ),
                "grounded_node_ids": [f"{closest['a']}:0", f"{closest['b']}:0"],
                "stale": False,
            }
        )
    kept = [item.get("question") for item in body.previous_qa]
    return envelope(
        data={"qa": qa, "regenerated": [q["question"] for q in qa], "kept": kept},
        artifact_id=f"{body.graph_id}:qa:v{body.graph_version}",
        quota=meter,
    )
