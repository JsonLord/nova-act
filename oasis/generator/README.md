# UserSync Persona Generator (adapted from OASIS)

Pulled from the OASIS generation pipeline (camel-ai/oasis, PyPI `camel-oasis` 0.2.5:
`oasis/social_agent/agents_generator.py`, `oasis/social_platform/config/user.py`; Apache-2.0,
headers and modification notes preserved) and **adjusted to the UserSync steering goal**:

> Create a synthetic user group for a company — based on its product, its data, and the whole
> DataHub — to simulate user behaviour in online usability tests, U-tests, content testing, and
> branding testing. Personas express opinions, and their **physical, mental, and emotional**
> features steer the Nova Act agent representing them in its **observing, thinking, and acting**.

## What changed vs. upstream

Upstream loads ready-made profile files and instantiates `SocialAgent`s. This package *generates
the profiles themselves* and derives Nova steering from them:

| Module | Role |
| --- | --- |
| `schema.py` | OASIS Reddit persona contract (incl. `profession`, `interested_topics`) **+** `PhysicalProfile`, `MentalProfile`, `EmotionalProfile`, `Opinion`, `CompanyContext` |
| `user_info.py` | Upstream `UserInfo` without the CAMEL dependency; system messages extended with the feature blocks and opinions; new `to_web_journey_system_message()` for Nova runs |
| `generation.py` | `generate_personas(GenerationSpec)`: seeded, distribution-driven, company/DataHub-conditioned; optional LLM hook for persona text and opinion statements; scale-free social ties |
| `steering.py` | `derive_steering(persona)`: **physical → OBSERVING** (viewport, zoom, color-vision CDP, observation delay), **mental → THINKING** (prompt blocks, max_steps, exploration), **emotional → ACTING** (hesitation, timeout, frustration abort, opinion expression). Every value carries `source_fields` + `rationale` provenance |

## Compatibility

- `PersonaHub.to_oasis_reddit_json()` emits exactly the file `generate_reddit_agent_graph`
  consumes (validated against `oasis/data/reddit/user_data_36.json` keys) — the same personas
  populate the Social Mirror simulation.
- `PersonaHub.to_oasis_twitter_rows()` covers the Twitter CSV contract incl.
  `following_agentid_list`.
- `PersonaHub.to_graph_payload()` is the node/edge JSON the persona-graph view and the social
  network animation tab render and time-capture.

## Try it

```bash
python -m oasis.generator 12 42 --out ./hub_demo
# hub_demo/personas.oasis.json, persona_graph.json, steering/<persona_id>.json
```

Numeric steering is deterministic math (reviewable curves), LLM output is used only for language
(persona text, opinion statements) — see spec.md §4.2/§4.3.
