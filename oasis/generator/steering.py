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
# Modifications Copyright 2026 UserSync. New module: derives a Nova Act
# steering configuration from a generated persona. The mapping follows the
# UserSync steering triad — physical features steer OBSERVING, mental
# features steer THINKING, emotional features steer ACTING — with every
# derived value carrying provenance (source fields + rationale), matching
# the Steering Auto-Fill contract in spec.md §4.2/§4.3.

"""Persona -> Nova Act steering derivation (observe / think / act)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from oasis.generator.schema import UserSyncPersona
from oasis.generator.user_info import UserInfo

# Nova Act's closed action vocabulary (src/nova_act/impl/interpreter.py).
NOVA_ACTIONS = ["agentClick", "agentHover", "agentType", "agentScroll", "goToUrl", "wait"]

_DEVICE_VIEWPORTS = {
    "desktop": (1600, 900),
    "smartphone": (390, 844),
    "tablet": (820, 1180),
}


@dataclass
class SteeredValue:
    """A derived steering value with its provenance — renders as a chip."""

    value: Any
    source_fields: list[str]
    rationale: str


@dataclass
class ObservingConfig:
    """Physical -> what the Nova agent perceives, and how fast.

    Maps onto: NovaAct(screen_width/screen_height/user_agent), CDP emulation
    (vision deficiency, zoom), and act(observation_delay_ms)."""

    viewport: SteeredValue
    zoom_factor: SteeredValue
    color_vision_deficiency: SteeredValue
    observation_delay_ms: SteeredValue
    reread_observations: SteeredValue
    # Perceptual-filter inputs (spec.md §4.4 steerable observation pipeline):
    scan_pattern: SteeredValue  # F | T | Z | full — reading/scanning habit
    fixation_budget: SteeredValue  # elements perceived per look
    vision_acuity: SteeredValue  # 1..5, degrades small-element recognition
    digital_literacy: SteeredValue  # 1..5, gates icon/idiom recognition points


@dataclass
class ThinkingConfig:
    """Mental -> how the agent reasons: prompt blocks + budgets.

    Maps onto: act() prompt composition, think()-restyle instruction,
    max_steps, and exploration behavior requested in the prompt."""

    self_description_block: SteeredValue
    think_restyle_instruction: SteeredValue
    max_steps: SteeredValue
    options_considered: SteeredValue
    scroll_depth_screens: SteeredValue
    plan_first: SteeredValue


@dataclass
class ActingConfig:
    """Emotional (+ motor) -> persistence, hesitation, expression.

    Maps onto: actuator overrides (cadence, jitter), inserted wait steps,
    timeout, frustration abort, and opinion expression in results."""

    allowed_actions: SteeredValue
    typing_wpm: SteeredValue
    pointer_jitter_px: SteeredValue
    hesitation_wait_s: SteeredValue
    timeout_s: SteeredValue
    frustration_abort_after_failed_steps: SteeredValue
    express_opinions: SteeredValue


@dataclass
class NovaSteeringConfig:
    """The full observe/think/act steering set for one persona."""

    persona_id: str
    observing: ObservingConfig
    thinking: ThinkingConfig
    acting: ActingConfig
    provenance: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_self_description_block(persona: UserSyncPersona) -> str:
    """The SELF-DESCRIPTION prompt block, reusing the (adapted) OASIS
    UserInfo system-message pattern, including the UserSync feature blocks
    and opinions."""
    info = UserInfo(
        name=persona.realname,
        description=persona.bio,
        profile={"other_info": persona.to_other_info()},
        recsys_type="reddit",
    )
    return info.to_web_journey_system_message()


def build_think_restyle_instruction(persona: UserSyncPersona) -> str:
    """Instruction for restyling raw think() output in the persona's voice.

    Stored alongside — never instead of — the raw reasoning (spec.md §4)."""
    mood = persona.emotional.baseline_mood
    return (
        f"Rewrite the agent's reasoning as the inner monologue of "
        f"{persona.realname} ({persona.age}, {persona.mbti}, {persona.country}): "
        f"digital literacy {persona.mental.digital_literacy}/5, patience "
        f"{persona.emotional.patience}/5, {mood} baseline mood, browsing on a "
        f"{persona.physical.primary_device}. Keep every factual step; change only "
        f"voice, vocabulary, and emotional coloring. Mention perception struggles "
        f"consistent with vision acuity {persona.physical.vision_acuity}/5 when "
        f"relevant. Express held opinions when the content touches them."
    )


def derive_steering(persona: UserSyncPersona, goal: str = "") -> NovaSteeringConfig:
    """Derive the Nova steering configuration from a persona.

    All numeric mappings are deterministic, reviewable functions (spec.md
    §4.3: math for numbers, LLM only for language)."""
    physical, mental, emotional = persona.physical, persona.mental, persona.emotional

    # --- OBSERVING (physical) ---
    viewport = _DEVICE_VIEWPORTS[physical.primary_device]
    zoom = 1.0 + max(0, 4 - physical.vision_acuity) * 0.25  # acuity 4+ -> 1.0, 1 -> 1.75
    observation_delay = int(
        physical.reaction_time_ms
        + (5 - mental.attention_span) * 150
        + physical.fatigue * 100
    )
    observing = ObservingConfig(
        viewport=SteeredValue(
            viewport,
            ["physical.primary_device"],
            f"{physical.primary_device} viewport preset",
        ),
        zoom_factor=SteeredValue(
            round(zoom, 2),
            ["physical.vision_acuity"],
            f"vision acuity {physical.vision_acuity}/5 -> zoom compensation",
        ),
        color_vision_deficiency=SteeredValue(
            physical.color_vision,
            ["physical.color_vision"],
            "forwarded to CDP Emulation.setEmulatedVisionDeficiency",
        ),
        observation_delay_ms=SteeredValue(
            observation_delay,
            ["physical.reaction_time_ms", "mental.attention_span", "physical.fatigue"],
            "reaction time + attention and fatigue penalties",
        ),
        reread_observations=SteeredValue(
            1 if mental.working_memory >= 3 else 2,
            ["mental.working_memory"],
            "low working memory re-reads the page before acting",
        ),
        scan_pattern=SteeredValue(
            {"satisficer": "F", "comparer": "T", "exhaustive": "full"}[mental.exploration_style],
            ["mental.exploration_style"],
            "satisficers F-scan, comparers T-scan, exhaustive explorers see the full page",
        ),
        fixation_budget=SteeredValue(
            2 + 2 * mental.attention_span - physical.fatigue,
            ["mental.attention_span", "physical.fatigue"],
            "elements perceived per look; fatigue narrows the attentional window",
        ),
        vision_acuity=SteeredValue(
            physical.vision_acuity,
            ["physical.vision_acuity"],
            "low acuity blurs small-element labels in the perceptual filter",
        ),
        digital_literacy=SteeredValue(
            mental.digital_literacy,
            ["mental.digital_literacy"],
            "high literacy recognizes unlabeled icons/idioms; low literacy misses them",
        ),
    )

    # --- THINKING (mental) ---
    max_steps = 10 + mental.digital_literacy * 4 + (5 if mental.attention_span >= 4 else 0)
    options = {"satisficer": 1, "comparer": 3, "exhaustive": 6}[mental.exploration_style]
    scroll_depth = {"satisficer": 1, "comparer": 3, "exhaustive": 6}[mental.exploration_style]
    thinking = ThinkingConfig(
        self_description_block=SteeredValue(
            build_self_description_block(persona),
            ["persona", "physical", "mental", "emotional", "opinions"],
            "OASIS UserInfo system-message pattern with UserSync blocks",
        ),
        think_restyle_instruction=SteeredValue(
            build_think_restyle_instruction(persona),
            ["emotional.baseline_mood", "mental.digital_literacy", "physical.vision_acuity"],
            "persona-voiced restyling of raw think() output",
        ),
        max_steps=SteeredValue(
            max_steps,
            ["mental.digital_literacy", "mental.attention_span"],
            "higher literacy and attention afford longer journeys",
        ),
        options_considered=SteeredValue(
            options,
            ["mental.exploration_style"],
            f"{mental.exploration_style} compares {options} option(s) before choosing",
        ),
        scroll_depth_screens=SteeredValue(
            scroll_depth,
            ["mental.exploration_style"],
            "exploration style bounds how far the persona scans a page",
        ),
        plan_first=SteeredValue(
            mental.planning_style == "plan_first",
            ["mental.planning_style"],
            "plan-first personas think before the first action",
        ),
    )

    # --- ACTING (emotional + motor) ---
    allowed = list(NOVA_ACTIONS)
    if emotional.risk_aversion >= 4:
        # Highly risk-averse personas avoid free-typing into unknown fields;
        # journeys must route them through clicks and selections.
        allowed.remove("agentType")
    jitter = max(0, 4 - physical.motor_precision) * 3
    hesitation = round((5 - emotional.patience) * 0.8 + physical.fatigue * 0.3, 1)
    timeout_s = 120 + emotional.patience * 60
    frustration_abort = max(1, emotional.patience)
    acting = ActingConfig(
        allowed_actions=SteeredValue(
            allowed,
            ["emotional.risk_aversion"],
            "risk aversion >= 4 removes free-form typing",
        ),
        typing_wpm=SteeredValue(
            physical.typing_wpm,
            ["physical.typing_wpm"],
            "actuator typing cadence",
        ),
        pointer_jitter_px=SteeredValue(
            jitter,
            ["physical.motor_precision"],
            "lower motor precision -> larger click scatter",
        ),
        hesitation_wait_s=SteeredValue(
            hesitation,
            ["emotional.patience", "physical.fatigue"],
            "impatient personas act fast; fatigue adds pauses",
        ),
        timeout_s=SteeredValue(
            timeout_s,
            ["emotional.patience"],
            "patience scales how long the persona keeps trying",
        ),
        frustration_abort_after_failed_steps=SteeredValue(
            frustration_abort,
            ["emotional.patience"],
            "consecutive failed steps tolerated before giving up",
        ),
        express_opinions=SteeredValue(
            emotional.expressiveness >= 3,
            ["emotional.expressiveness"],
            "expressive personas voice opinions in results and interviews",
        ),
    )

    return NovaSteeringConfig(
        persona_id=persona.persona_id,
        observing=observing,
        thinking=thinking,
        acting=acting,
        provenance={
            "derived_from": persona.persona_id,
            "goal": goal,
            "mapping": "oasis.generator.steering.derive_steering (deterministic)",
        },
    )


def build_act_prompt(persona: UserSyncPersona, goal: str) -> str:
    """Compose the act() prompt: persona self-description + journey goal,
    phrased so the agent observes, thinks, and acts as the persona."""
    block = build_self_description_block(persona)
    return (
        f"{block}\n"
        f"# JOURNEY GOAL\n"
        f"{goal}\n\n"
        f"Behave exactly as this person would: perceive within your physical "
        f"limits, decide within your mental style, persist within your "
        f"emotional limits, and use think() to voice your experience — "
        f"including opinions — at every step."
    )
