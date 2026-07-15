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
# Modifications Copyright 2026 UserSync: extended the OASIS Reddit persona
# contract (realname/username/bio/persona/age/gender/mbti/country) with
# physical, mental, and emotional steering profiles, opinions, and company
# context. See package __init__ for the adaptation statement.

"""Persona schema: OASIS-compatible core + UserSync steering extensions."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

# --- Steering feature blocks -------------------------------------------------
# Each block steers one axis of the Nova Act agent loop:
#   PhysicalProfile  -> OBSERVING (what the agent can perceive, and how fast)
#   MentalProfile    -> THINKING  (how the agent reasons, scans, and decides)
#   EmotionalProfile -> ACTING    (how the agent persists, reacts, and expresses)
# The split is a steering model, not a clinical one: e.g. reaction time is
# kept physical because it gates actuation, while patience is emotional
# because it gates persistence and tone.

ColorVision = Literal["normal", "deuteranopia", "protanopia", "tritanopia", "achromatopsia"]
Level = Literal[1, 2, 3, 4, 5]  # 1 = very low .. 5 = very high


@dataclass
class PhysicalProfile:
    """Physical features. Primary steering target: the agent's OBSERVING."""

    vision_acuity: Level = 4  # 1 = low vision .. 5 = sharp
    color_vision: ColorVision = "normal"
    contrast_sensitivity: Level = 4
    motor_precision: Level = 4  # 1 = strong tremor .. 5 = steady
    reaction_time_ms: int = 350
    typing_wpm: int = 40
    hearing: Level = 4
    fatigue: Level = 2  # 1 = fresh .. 5 = exhausted
    primary_device: Literal["desktop", "smartphone", "tablet"] = "desktop"
    input_method: Literal["mouse", "touch", "keyboard"] = "mouse"


@dataclass
class MentalProfile:
    """Mental/cognitive features. Primary steering target: the agent's THINKING."""

    digital_literacy: Level = 3
    domain_knowledge: Level = 3  # knowledge of the product's domain
    attention_span: Level = 3
    working_memory: Level = 3  # tolerance for multi-step flows
    reading_speed_wpm: int = 220
    exploration_style: Literal["satisficer", "comparer", "exhaustive"] = "satisficer"
    planning_style: Literal["plan_first", "opportunistic"] = "opportunistic"
    tech_confidence: Level = 3
    language_proficiency: Level = 4  # proficiency in the site's language


@dataclass
class EmotionalProfile:
    """Emotional features. Primary steering target: the agent's ACTING
    (persistence, hesitation, tone) and the voice of its reflections."""

    baseline_mood: Literal["negative", "neutral", "positive"] = "neutral"
    patience: Level = 3  # low patience -> early frustration abort
    trust_disposition: Level = 3  # willingness to share data / click on prompts
    risk_aversion: Level = 3
    brand_affinity: int = 0  # -2 hostile .. +2 advocate, toward the company under test
    novelty_seeking: Level = 3
    expressiveness: Level = 3  # how strongly opinions are voiced


@dataclass
class Opinion:
    """An expressible opinion — the unit of content/branding test feedback."""

    topic: str  # e.g. "product pricing", "brand tone", "checkout flow"
    stance: int  # -2 strongly against .. +2 strongly for
    intensity: Level = 3  # how readily it is voiced
    statement: str = ""  # the opinion in the persona's own voice
    source_refs: list[str] = field(default_factory=list)  # DataHub artifact ids


@dataclass
class CompanyContext:
    """What the persona was generated FOR: the company, product, and data."""

    company_name: str = ""
    product_name: str = ""
    product_description: str = ""
    business_case: Literal[
        "usability_test", "u_test", "content_test", "branding_test"
    ] = "usability_test"
    datahub_snapshot_ids: list[str] = field(default_factory=list)
    research_drop_ids: list[str] = field(default_factory=list)
    monitoring_ref_ids: list[str] = field(default_factory=list)


@dataclass
class UserSyncPersona:
    """A persona: OASIS Reddit core fields + UserSync steering extensions."""

    # --- OASIS Reddit contract (docs/user_generation/generation.mdx) ---
    realname: str
    username: str
    bio: str
    persona: str
    age: int
    gender: str
    mbti: str
    country: str
    profession: str = ""
    interested_topics: list[str] = field(default_factory=list)

    # --- UserSync extensions ---
    persona_id: str = ""
    physical: PhysicalProfile = field(default_factory=PhysicalProfile)
    mental: MentalProfile = field(default_factory=MentalProfile)
    emotional: EmotionalProfile = field(default_factory=EmotionalProfile)
    opinions: list[Opinion] = field(default_factory=list)
    company_context: CompanyContext = field(default_factory=CompanyContext)
    provenance: dict[str, Any] = field(default_factory=dict)

    def to_oasis_reddit_profile(self) -> dict[str, Any]:
        """Exactly the Reddit JSON object OASIS's generate_reddit_agent_graph
        consumes — extensions are omitted so upstream stays unmodified."""
        return {
            "realname": self.realname,
            "username": self.username,
            "bio": self.bio,
            "persona": self.persona,
            "age": self.age,
            "gender": self.gender,
            "mbti": self.mbti,
            "country": self.country,
            "profession": self.profession,
            "interested_topics": self.interested_topics,
        }

    def to_other_info(self) -> dict[str, Any]:
        """The OASIS ``UserInfo.profile['other_info']`` dict, carrying the
        UserSync blocks alongside the fields upstream templates read."""
        return {
            "user_profile": self.persona,
            "mbti": self.mbti,
            "gender": self.gender,
            "age": self.age,
            "country": self.country,
            # UserSync extensions (ignored by upstream templates, used by
            # oasis.generator.user_info and oasis.generator.steering):
            "physical": asdict(self.physical),
            "mental": asdict(self.mental),
            "emotional": asdict(self.emotional),
            "opinions": [asdict(o) for o in self.opinions],
            "company_context": asdict(self.company_context),
        }

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
