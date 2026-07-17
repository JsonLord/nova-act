# Modifications Copyright 2026 UserSync. New module (Apache-2.0; see package
# __init__ for provenance): parallel, batched LLM enrichment so large focus
# groups (2,000+ personas) finish in minutes instead of hours.

"""Parallel batched LLM enrichment for generated personas.

The deterministic generator (`generation.py`) produces a complete, usable
skeleton in under a second even for thousands of personas. This module adds
the language layer on top — persona paragraphs and opinion statements — with
a call budget that scales as ``ceil(count / batch_size)`` instead of
``4 * count``:

    count=2000, batch_size=10  ->  200 LLM calls
    concurrency=16, ~30s/call  ->  ~13 waves ≈ 6-7 minutes end to end

Personas remain valid throughout: enrichment mutates text fields only, so a
UI can render the skeleton immediately and let enriched text stream in
(progressive enrichment, spec.md §11).
"""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Callable

from oasis.generator.schema import UserSyncPersona

# Same shape as generation.LlmHook: one prompt in, generated text out.
# The hook must be thread-safe (it is called from a thread pool).
BatchLlmHook = Callable[[str], str]

_BATCH_PROMPT = """You are enriching synthetic usability-test personas.
For EACH persona below, write:
- "persona": one vivid first-person-free paragraph keeping every given fact;
- "opinions": for each listed topic, one first-person sentence in the
  persona's voice matching the given stance (-2 strongly against .. +2
  strongly for).

Respond with ONLY a JSON array, one object per persona:
[{{"index": <int>, "persona": "<paragraph>",
   "opinions": [{{"topic": "<topic>", "statement": "<sentence>"}}]}}]

Personas:
{personas_block}
"""


@dataclass
class EnrichmentReport:
    """What happened: calls made, personas enriched, batches that fell back."""

    llm_calls: int = 0
    enriched: int = 0
    failed_batches: list[int] = field(default_factory=list)


def _persona_block(index: int, persona: UserSyncPersona) -> str:
    topics = ", ".join(f"{o.topic} (stance {o.stance:+d})" for o in persona.opinions)
    return (
        f"- index {index}: {persona.realname}, {persona.age}, {persona.gender}, "
        f"{persona.mbti}, {persona.country}, {persona.profession}; facts: "
        f"{persona.persona} Opinion topics: {topics}"
    )


def _extract_json_array(text: str) -> list[dict]:
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        raise ValueError("no JSON array in LLM response")
    return json.loads(match.group(0))


def _apply_batch(personas: list[UserSyncPersona], indices: list[int], items: list[dict]) -> int:
    applied = 0
    valid = set(indices)
    for item in items:
        index = item.get("index")
        if index not in valid:
            continue
        persona = personas[index]
        if isinstance(item.get("persona"), str) and item["persona"].strip():
            persona.persona = item["persona"].strip()
        statements = {
            o.get("topic"): o.get("statement", "")
            for o in item.get("opinions", [])
            if isinstance(o, dict)
        }
        for opinion in persona.opinions:
            statement = statements.get(opinion.topic)
            if isinstance(statement, str) and statement.strip():
                opinion.statement = statement.strip()
        persona.provenance["enriched"] = True
        applied += 1
    return applied


def enrich_personas(
    personas: list[UserSyncPersona],
    llm: BatchLlmHook,
    batch_size: int = 10,
    concurrency: int = 16,
) -> EnrichmentReport:
    """Enrich persona text and opinion statements in parallel batches.

    Failures degrade gracefully: a batch whose response cannot be parsed
    keeps its deterministic text and is listed in ``failed_batches`` for
    selective retry.
    """
    report = EnrichmentReport()
    batches = [
        list(range(start, min(start + batch_size, len(personas))))
        for start in range(0, len(personas), batch_size)
    ]

    def run_batch(batch_no: int, indices: list[int]) -> tuple[int, list[int], list[dict] | None]:
        block = "\n".join(_persona_block(i, personas[i]) for i in indices)
        try:
            response = llm(_BATCH_PROMPT.format(personas_block=block))
            return batch_no, indices, _extract_json_array(response)
        except Exception:
            return batch_no, indices, None

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(run_batch, n, idx) for n, idx in enumerate(batches)]
        for future in as_completed(futures):
            batch_no, indices, items = future.result()
            report.llm_calls += 1
            if items is None:
                report.failed_batches.append(batch_no)
            else:
                report.enriched += _apply_batch(personas, indices, items)
    return report
