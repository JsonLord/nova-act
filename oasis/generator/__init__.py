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
# Modifications Copyright 2026 UserSync.
# This package is adapted from the OASIS project (camel-ai/oasis) agent
# generation pipeline (`oasis/social_agent/agents_generator.py` and
# `oasis/social_platform/config/user.py`, PyPI `camel-oasis` 0.2.5) and
# adjusted to the UserSync steering goal:
#
#   Generate a synthetic user group for a company — conditioned on its
#   product, its data, and the whole DataHub — to simulate user behaviour
#   in online usability tests, U-tests, content testing, and branding
#   testing. Personas express opinions, and their PHYSICAL, MENTAL, and
#   EMOTIONAL features steer the Nova Act agent that represents them in
#   its OBSERVING, THINKING, and ACTING.
#
# The output stays backward-compatible with OASIS: `to_oasis_reddit_profile`
# emits exactly the Reddit JSON contract consumed by
# `generate_reddit_agent_graph`, so the same personas can populate the
# Social Mirror simulation and drive Nova Act journeys.

"""UserSync persona generation, adapted from OASIS.

Modules
-------
schema
    Persona dataclasses: OASIS-compatible core plus physical / mental /
    emotional profiles, opinions, and company context.
user_info
    Dependency-free adaptation of OASIS ``UserInfo`` system-message
    composition, extended with the UserSync profile blocks.
generation
    ``generate_personas``: distribution-driven, seeded generation with an
    optional LLM enrichment hook and a scale-free social tie generator.
steering
    ``derive_steering``: persona -> NovaSteeringConfig with explicit
    observing / thinking / acting blocks and per-value provenance.
"""

from oasis.generator.generation import GenerationSpec, PersonaHub, generate_personas
from oasis.generator.schema import (
    CompanyContext,
    EmotionalProfile,
    MentalProfile,
    Opinion,
    PhysicalProfile,
    UserSyncPersona,
)
from oasis.generator.steering import NovaSteeringConfig, derive_steering
from oasis.generator.user_info import UserInfo

__all__ = [
    "CompanyContext",
    "EmotionalProfile",
    "GenerationSpec",
    "MentalProfile",
    "NovaSteeringConfig",
    "Opinion",
    "PersonaHub",
    "PhysicalProfile",
    "UserInfo",
    "UserSyncPersona",
    "derive_steering",
    "generate_personas",
]
