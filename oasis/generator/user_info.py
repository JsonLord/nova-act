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
# Modifications Copyright 2026 UserSync. Adapted from
# oasis/social_platform/config/user.py (camel-oasis 0.2.5):
#   * removed the `camel.prompts.TextPrompt` dependency (plain
#     string.Formatter slot handling instead), so the module runs without
#     the CAMEL stack;
#   * extended the system-message composition with the UserSync physical /
#     mental / emotional blocks and opinions when present in
#     profile["other_info"];
#   * removed a stray debug print from the Reddit template path.

"""Dependency-free adaptation of OASIS ``UserInfo`` with UserSync blocks."""

from __future__ import annotations

import string
import warnings
from dataclasses import dataclass
from typing import Any


def _template_keys(template: str) -> set[str]:
    return {name for _, name, _, _ in string.Formatter().parse(template) if name}


@dataclass
class UserInfo:
    user_name: str | None = None
    name: str | None = None
    description: str | None = None
    profile: dict[str, Any] | None = None
    recsys_type: str = "twitter"
    is_controllable: bool = False

    def to_custom_system_message(self, user_info_template: str) -> str:
        """OASIS's templated system message, with plain-str templates.

        The template's ``{slot}`` keys must exactly match profile keys —
        same contract as upstream's TextPrompt version.
        """
        required_keys = _template_keys(user_info_template)
        info_keys = set((self.profile or {}).keys())
        missing = required_keys - info_keys
        extra = info_keys - required_keys
        if missing:
            raise ValueError(f"Missing required keys in UserInfo.profile: {missing}")
        if extra:
            warnings.warn(f"Extra keys not used in UserInfo.profile: {extra}")
        return user_info_template.format(**(self.profile or {}))

    def to_system_message(self) -> str:
        if self.recsys_type != "reddit":
            return self.to_twitter_system_message()
        return self.to_reddit_system_message()

    def _base_description(self) -> str:
        name_string = f"Your name is {self.name}." if self.name is not None else ""
        other_info = (self.profile or {}).get("other_info", {})
        user_profile = other_info.get("user_profile")
        if user_profile:
            return f"{name_string}\nYour have profile: {user_profile}."
        return name_string

    def _demographic_sentence(self) -> str:
        other_info = (self.profile or {}).get("other_info", {})
        if all(k in other_info for k in ("gender", "age", "mbti", "country")):
            return (
                f"You are a {other_info['gender']}, "
                f"{other_info['age']} years old, with an MBTI "
                f"personality type of {other_info['mbti']} from "
                f"{other_info['country']}."
            )
        return ""

    def _usersync_blocks(self) -> str:
        """UserSync extension: render physical / mental / emotional features
        and opinions into the system message so the persona's constraints
        shape observing, thinking, and acting."""
        other_info = (self.profile or {}).get("other_info", {})
        sections: list[str] = []

        physical = other_info.get("physical")
        if physical:
            sections.append(
                "# PHYSICAL FEATURES (shape what you can observe and how fast you act)\n"
                f"{_render_features(physical)}"
            )
        mental = other_info.get("mental")
        if mental:
            sections.append(
                "# MENTAL FEATURES (shape how you think, scan, and decide)\n"
                f"{_render_features(mental)}"
            )
        emotional = other_info.get("emotional")
        if emotional:
            sections.append(
                "# EMOTIONAL FEATURES (shape your persistence, reactions, and tone)\n"
                f"{_render_features(emotional)}"
            )
        opinions = other_info.get("opinions")
        if opinions:
            lines = [
                f"- {o.get('topic')}: stance {o.get('stance'):+d}/2, "
                f"intensity {o.get('intensity')}/5"
                + (f' — "{o["statement"]}"' if o.get("statement") else "")
                for o in opinions
            ]
            sections.append(
                "# YOUR OPINIONS (express them when content, brands, or products "
                "are involved — consistently with stance and intensity)\n" + "\n".join(lines)
            )
        return "\n\n".join(sections)

    def to_twitter_system_message(self) -> str:
        description = self._base_description()
        extension = self._usersync_blocks()
        system_content = f"""
# OBJECTIVE
You're a Twitter user, and I'll present you with some posts. After you see the posts, choose some actions from the following functions.

# SELF-DESCRIPTION
Your actions should be consistent with your self-description and personality.
{description}

{extension}

# RESPONSE METHOD
Please perform actions by tool calling.
"""
        return system_content

    def to_web_journey_system_message(self) -> str:
        """UserSync extension: the same SELF-DESCRIPTION composition, framed
        for a Nova Act web journey instead of a social platform."""
        description = self._base_description()
        demographic = self._demographic_sentence()
        if demographic:
            description = f"{description}\n{demographic}"
        extension = self._usersync_blocks()
        system_content = f"""
# OBJECTIVE
You're a real person browsing the web. You will work toward a goal on a website, one step at a time.

# SELF-DESCRIPTION
Your actions should be consistent with your self-description and personality.
{description}

{extension}

# RESPONSE METHOD
Observe within your physical limits, decide within your mental style, persist within your emotional limits.
"""
        return system_content

    def to_reddit_system_message(self) -> str:
        description = self._base_description()
        demographic = self._demographic_sentence()
        if demographic:
            description = f"{description}\n{demographic}"
        extension = self._usersync_blocks()
        system_content = f"""
# OBJECTIVE
You're a Reddit user, and I'll present you with some posts. After you see the posts, choose some actions from the following functions.

# SELF-DESCRIPTION
Your actions should be consistent with your self-description and personality.
{description}

{extension}

# RESPONSE METHOD
Please perform actions by tool calling.
"""
        return system_content


def _render_features(features: dict[str, Any]) -> str:
    return "\n".join(f"- {key.replace('_', ' ')}: {value}" for key, value in features.items())
