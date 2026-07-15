# Modifications Copyright 2026 UserSync. Demo entry point for the adapted
# OASIS generator (Apache-2.0; see package __init__ for provenance).
"""Demo: generate a synthetic user group and its steering configs.

Usage:
    python -m oasis.generator [count] [seed]

Writes three artifacts next to nothing (stdout summary only) unless an
output directory is given via --out DIR:
    personas.oasis.json   — upstream-compatible Reddit profile file
    persona_graph.json    — graph payload for the UI network animation
    steering/<id>.json    — one Nova steering config per persona
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from oasis.generator.generation import GenerationSpec, generate_personas
from oasis.generator.schema import CompanyContext
from oasis.generator.steering import build_act_prompt, derive_steering


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    out_dir: Path | None = None
    if "--out" in argv:
        out_dir = Path(argv[argv.index("--out") + 1])
    count = int(args[0]) if len(args) > 0 else 6
    seed = int(args[1]) if len(args) > 1 else 42

    spec = GenerationSpec(
        company=CompanyContext(
            company_name="Acme Web Shop",
            product_name="Acme Storefront",
            product_description="An online shop for outdoor gear.",
            business_case="usability_test",
            datahub_snapshot_ids=["datahub-snap-demo-001"],
        ),
        count=count,
        seed=seed,
    )
    hub = generate_personas(spec)

    print(f"Generated {len(hub.personas)} personas, {len(hub.edges)} social ties.\n")
    example = hub.personas[0]
    steering = derive_steering(example, goal="Find and buy a two-person tent.")
    print(f"Example persona: {example.realname} ({example.persona_id})")
    print(f"  {example.persona}\n")
    print("Derived steering (observe/think/act):")
    print(f"  observing.viewport            = {steering.observing.viewport.value}")
    print(f"  observing.observation_delay   = {steering.observing.observation_delay_ms.value} ms")
    print(f"  thinking.max_steps            = {steering.thinking.max_steps.value}")
    print(f"  thinking.options_considered   = {steering.thinking.options_considered.value}")
    print(f"  acting.allowed_actions        = {steering.acting.allowed_actions.value}")
    print(f"  acting.frustration_abort      = "
          f"{steering.acting.frustration_abort_after_failed_steps.value} failed steps")
    print(f"\nOpinions: {[f'{o.topic} {o.stance:+d}' for o in example.opinions]}")
    print(f"\nact() prompt preview:\n{build_act_prompt(example, 'Find and buy a two-person tent.')[:400]}…")

    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "personas.oasis.json").write_text(hub.to_oasis_reddit_json())
        (out_dir / "persona_graph.json").write_text(json.dumps(hub.to_graph_payload(), indent=2))
        steering_dir = out_dir / "steering"
        steering_dir.mkdir(exist_ok=True)
        for persona in hub.personas:
            config = derive_steering(persona)
            (steering_dir / f"{persona.persona_id}.json").write_text(
                json.dumps(config.to_dict(), indent=2)
            )
        print(f"\nArtifacts written to {out_dir}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
