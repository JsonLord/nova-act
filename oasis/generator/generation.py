# =========== Copyright 2023 @ CAMEL-AI.org. All Rights Reserved. ===========
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# =========== Copyright 2023 @ CAMEL-AI.org. All Rights Reserved. ===========
#
# Modifications Copyright 2026 UserSync. Adapted from the OASIS agent
# generation pipeline (oasis/social_agent/agents_generator.py): where
# upstream loads ready-made profile files and instantiates SocialAgents,
# this module GENERATES the profiles themselves — conditioned on a company,
# its product, and DataHub artifacts — plus scale-free social ties, and
# emits both the upstream-compatible Reddit JSON and a graph payload for
# the UI's social network animation.

"""Distribution-driven persona generation for a company's synthetic user group."""

from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Sequence

from oasis.generator.schema import (
    CompanyContext,
    EmotionalProfile,
    MentalProfile,
    Opinion,
    PhysicalProfile,
    UserSyncPersona,
)

# An enrichment hook: takes an instruction prompt, returns generated text.
# Wire an actual LLM here (Steering Auto-Fill service); the generator itself
# stays deterministic without one.
LlmHook = Callable[[str], str]

_MBTI_TYPES = [
    "ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP",
    "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ",
]

_FIRST_NAMES = [
    "Alex", "Sam", "Jordan", "Robin", "Casey", "Maria", "Elena", "Yusuf",
    "Priya", "Chen", "Aiko", "Lars", "Fatima", "Diego", "Ingrid", "Tunde",
]
_LAST_NAMES = [
    "Miller", "Hayes", "Schmidt", "Rossi", "Tanaka", "Okafor", "Novak",
    "Silva", "Kaur", "Larsen", "Dubois", "Ivanov", "Garcia", "Kim",
]

_PROFESSIONS = [
    "Retail", "Healthcare", "Education", "Software", "Logistics",
    "Hospitality & Tourism", "Finance", "Construction", "Design", "Retired",
]
_INTEREST_POOL = [
    "technology", "travel", "cooking", "sports", "gaming", "gardening",
    "fashion", "music", "finance", "outdoors", "photography", "family",
]

_OPINION_TOPICS = {
    "usability_test": ["ease of use", "navigation clarity", "signup effort"],
    "u_test": ["task success", "error tolerance", "help availability"],
    "content_test": ["content relevance", "tone of voice", "information depth"],
    "branding_test": ["brand trust", "visual identity", "price fairness"],
}


@dataclass
class Distribution:
    """A categorical distribution: values with weights."""

    values: Sequence[Any]
    weights: Sequence[float] | None = None

    def sample(self, rng: random.Random) -> Any:
        return rng.choices(list(self.values), weights=self.weights, k=1)[0]


@dataclass
class GenerationSpec:
    """Everything the Persona Generation tab collects."""

    company: CompanyContext
    count: int = 12
    seed: int = 42

    # Demographic distributions (not single values)
    age_range: tuple[int, int] = (18, 78)
    genders: Distribution = field(
        default_factory=lambda: Distribution(["female", "male", "non-binary"], [0.48, 0.48, 0.04])
    )
    countries: Distribution = field(
        default_factory=lambda: Distribution(["UK", "US", "Germany", "India", "Brazil", "Japan"])
    )
    mbti: Distribution = field(default_factory=lambda: Distribution(_MBTI_TYPES))

    # Steering-feature distributions (1..5 levels sampled around these means)
    digital_literacy_mean: float = 3.0
    patience_mean: float = 3.0
    brand_affinity: Distribution = field(
        default_factory=lambda: Distribution([-2, -1, 0, 1, 2], [0.1, 0.2, 0.4, 0.2, 0.1])
    )

    # Social-tie generation (Barabási–Albert style preferential attachment)
    ties_per_persona: int = 2

    # Optional LLM enrichment for persona text and opinion statements
    llm: LlmHook | None = None


@dataclass
class PersonaHub:
    """The generated synthetic user group + its social graph."""

    personas: list[UserSyncPersona]
    edges: list[tuple[int, int]]  # (follower_index, followee_index)
    spec_summary: dict[str, Any]

    def to_oasis_reddit_json(self) -> str:
        """Upstream-compatible: feed this file to generate_reddit_agent_graph."""
        return json.dumps([p.to_oasis_reddit_profile() for p in self.personas], indent=2)

    def to_oasis_twitter_rows(self) -> list[dict[str, Any]]:
        """Upstream-compatible rows for the Twitter CSV contract, including
        the following list used by generate_agents."""
        following: dict[int, list[int]] = {i: [] for i in range(len(self.personas))}
        for follower, followee in self.edges:
            following[follower].append(followee)
        return [
            {
                "name": p.realname,
                "username": p.username,
                "user_char": p.persona,
                "description": p.bio,
                "following_agentid_list": str(following[i]),
                "previous_tweets": "[]",
            }
            for i, p in enumerate(self.personas)
        ]

    def to_graph_payload(self) -> dict[str, Any]:
        """Graph JSON for the UI: nodes with full profiles + steering summary,
        edges as social ties. This is the artifact the persona-graph view and
        the social network animation tab render and time-capture."""
        return {
            "nodes": [
                {
                    "id": p.persona_id,
                    "index": i,
                    "label": p.realname,
                    "profile": p.to_dict(),
                }
                for i, p in enumerate(self.personas)
            ],
            "edges": [
                {"source": follower, "target": followee, "relation": "follows"}
                for follower, followee in self.edges
            ],
            "spec": self.spec_summary,
        }


def _level(rng: random.Random, mean: float) -> int:
    """Sample a 1..5 level around a mean."""
    return max(1, min(5, round(rng.gauss(mean, 1.0))))


def _sample_physical(rng: random.Random, age: int) -> PhysicalProfile:
    # Age conditions the physical baseline: older personas skew toward
    # reduced acuity, slower reactions, and lower motor precision.
    age_penalty = max(0, (age - 40)) / 40  # 0.0 at <=40 .. ~1.0 at 80
    return PhysicalProfile(
        vision_acuity=_level(rng, 4.2 - 1.8 * age_penalty),
        color_vision=rng.choices(
            ["normal", "deuteranopia", "protanopia", "tritanopia"],
            weights=[0.92, 0.05, 0.02, 0.01],
        )[0],
        contrast_sensitivity=_level(rng, 4.0 - 1.5 * age_penalty),
        motor_precision=_level(rng, 4.2 - 1.6 * age_penalty),
        reaction_time_ms=int(rng.gauss(300 + 250 * age_penalty, 50)),
        typing_wpm=max(8, int(rng.gauss(45 - 25 * age_penalty, 8))),
        hearing=_level(rng, 4.2 - 1.5 * age_penalty),
        fatigue=_level(rng, 2.0 + age_penalty),
        primary_device=rng.choices(
            ["desktop", "smartphone", "tablet"], weights=[0.45, 0.45, 0.10]
        )[0],
        input_method=rng.choices(["mouse", "touch", "keyboard"], weights=[0.5, 0.45, 0.05])[0],
    )


def _sample_mental(rng: random.Random, spec: GenerationSpec, age: int) -> MentalProfile:
    age_penalty = max(0, (age - 50)) / 30
    literacy = _level(rng, spec.digital_literacy_mean - 0.8 * age_penalty)
    return MentalProfile(
        digital_literacy=literacy,
        domain_knowledge=_level(rng, 3.0),
        attention_span=_level(rng, 3.0),
        working_memory=_level(rng, 3.2 - 0.6 * age_penalty),
        reading_speed_wpm=max(80, int(rng.gauss(230 - 60 * age_penalty, 30))),
        exploration_style=rng.choices(
            ["satisficer", "comparer", "exhaustive"], weights=[0.5, 0.35, 0.15]
        )[0],
        planning_style=rng.choices(["plan_first", "opportunistic"], weights=[0.4, 0.6])[0],
        tech_confidence=_level(rng, 0.5 + 0.9 * literacy),
        language_proficiency=_level(rng, 4.0),
    )


def _sample_emotional(rng: random.Random, spec: GenerationSpec) -> EmotionalProfile:
    return EmotionalProfile(
        baseline_mood=rng.choices(["negative", "neutral", "positive"], weights=[0.2, 0.5, 0.3])[0],
        patience=_level(rng, spec.patience_mean),
        trust_disposition=_level(rng, 3.0),
        risk_aversion=_level(rng, 3.0),
        brand_affinity=spec.brand_affinity.sample(rng),
        novelty_seeking=_level(rng, 3.0),
        expressiveness=_level(rng, 3.0),
    )


def _compose_persona_text(
    persona: UserSyncPersona, spec: GenerationSpec
) -> str:
    """Deterministic persona description; the LLM hook can replace it."""
    company = spec.company
    affinity = {
        -2: f"is openly critical of {company.company_name or 'the brand'}",
        -1: f"is skeptical about {company.company_name or 'the brand'}",
        0: f"has no strong prior view of {company.company_name or 'the brand'}",
        1: f"is friendly toward {company.company_name or 'the brand'}",
        2: f"actively recommends {company.company_name or 'the brand'}",
    }[persona.emotional.brand_affinity]
    text = (
        f"{persona.realname} is {persona.age} years old ({persona.mbti}, "
        f"{persona.country}), browses mostly on a {persona.physical.primary_device}, "
        f"has digital literacy {persona.mental.digital_literacy}/5 and patience "
        f"{persona.emotional.patience}/5, {affinity}. As a potential user of "
        f"{company.product_name or 'the product'}, they decide as a "
        f"{persona.mental.exploration_style} and voice opinions at intensity "
        f"{persona.emotional.expressiveness}/5."
    )
    if spec.llm is not None:
        text = spec.llm(
            "Rewrite this usability-test persona as one vivid paragraph, keeping "
            f"every fact: {text}"
        )
    return text


def _generate_opinions(
    rng: random.Random, persona: UserSyncPersona, spec: GenerationSpec
) -> list[Opinion]:
    topics = _OPINION_TOPICS[spec.company.business_case]
    opinions = []
    for topic in topics:
        # Stance is anchored on brand affinity with per-topic variation.
        stance = max(-2, min(2, persona.emotional.brand_affinity + rng.choice([-1, 0, 0, 1])))
        statement = ""
        if spec.llm is not None:
            statement = spec.llm(
                f"As {persona.realname} ({persona.persona}), state your opinion on "
                f"'{topic}' of {spec.company.product_name} in one first-person "
                f"sentence, stance {stance:+d} on a -2..+2 scale."
            )
        opinions.append(
            Opinion(
                topic=topic,
                stance=stance,
                intensity=persona.emotional.expressiveness,
                statement=statement,
                source_refs=list(spec.company.datahub_snapshot_ids),
            )
        )
    return opinions


def _scale_free_edges(rng: random.Random, count: int, ties: int) -> list[tuple[int, int]]:
    """Preferential attachment: later personas follow earlier ones with
    probability proportional to current degree (Barabási–Albert flavor)."""
    edges: list[tuple[int, int]] = []
    degree = [1] * count  # smoothing so isolated nodes stay reachable
    for follower in range(1, count):
        candidates = list(range(follower))
        k = min(ties, len(candidates))
        weights = [degree[c] for c in candidates]
        followees: set[int] = set()
        while len(followees) < k:
            followees.add(rng.choices(candidates, weights=weights, k=1)[0])
        for followee in followees:
            edges.append((follower, followee))
            degree[followee] += 1
            degree[follower] += 1
    return edges


def generate_personas(spec: GenerationSpec) -> PersonaHub:
    """Generate the synthetic user group for the company in the spec.

    Deterministic for a given seed; pass ``spec.llm`` to enrich persona text
    and opinion statements with an LLM.
    """
    rng = random.Random(spec.seed)
    personas: list[UserSyncPersona] = []

    for index in range(spec.count):
        age = rng.randint(*spec.age_range)
        first = rng.choice(_FIRST_NAMES)
        last = rng.choice(_LAST_NAMES)
        username = f"{first.lower()}_{last.lower()}_{index}"

        persona = UserSyncPersona(
            realname=f"{first} {last}",
            username=username,
            bio="",
            persona="",
            age=age,
            gender=spec.genders.sample(rng),
            mbti=spec.mbti.sample(rng),
            country=spec.countries.sample(rng),
            profession="Retired" if age >= 67 else rng.choice(_PROFESSIONS[:-1]),
            interested_topics=rng.sample(_INTEREST_POOL, k=3),
            persona_id=f"persona-{spec.seed}-{index}",
            physical=_sample_physical(rng, age),
            mental=_sample_mental(rng, spec, age),
            emotional=_sample_emotional(rng, spec),
            company_context=spec.company,
            provenance={
                "generator": "oasis.generator (UserSync adaptation of camel-ai/oasis)",
                "seed": spec.seed,
                "index": index,
                "datahub_snapshot_ids": spec.company.datahub_snapshot_ids,
                "research_drop_ids": spec.company.research_drop_ids,
            },
        )
        persona.persona = _compose_persona_text(persona, spec)
        persona.bio = (
            f"{persona.mental.exploration_style.title()} {persona.physical.primary_device} "
            f"user from {persona.country}."
        )
        persona.opinions = _generate_opinions(rng, persona, spec)
        personas.append(persona)

    edges = _scale_free_edges(rng, spec.count, spec.ties_per_persona)
    spec_summary = {
        "company": asdict(spec.company),
        "count": spec.count,
        "seed": spec.seed,
        "ties_per_persona": spec.ties_per_persona,
    }
    return PersonaHub(personas=personas, edges=edges, spec_summary=spec_summary)
