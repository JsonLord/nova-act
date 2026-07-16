"""last30days connector (spec §5, paid research-drops service).

Wraps the vendored `last30days-skill` to research a company's current
customers online and normalize the result into a `ResearchDropSummary`
(sentiment, top/complaint topics, activity level, sample quotes) that feeds
`POST /api/datahub/unify`.

Supported platforms are exactly what the skill already covers (its test
suite: reddit, x/twitter, tiktok, instagram, youtube, bluesky, hackernews,
truthsocial, plus grounded web / github / market sources). No new site
integrations are declared here — this is a thin adapter over the skill's own
source coverage. Each platform's auth/keys are the skill's concern (its
keychain / env), documented in `last30days-skill/HERMES_SETUP.md`.

Execution modes:
- If the skill's `last30days` CLI is importable/runnable it is invoked and
  its output summarized (real mode).
- Otherwise a structured summary is returned flagged `simulated: true`, so
  the connector + unify pipeline stay testable without the skill's API keys.
"""

from __future__ import annotations

import json
import subprocess
import sys
from typing import Any

# The platforms the vendored skill supports (from its source coverage).
SUPPORTED_PLATFORMS = [
    "reddit", "x", "twitter", "tiktok", "instagram", "youtube",
    "bluesky", "hackernews", "truthsocial", "web", "github",
]


def _summarize(raw_items: list[dict[str, Any]], topic: str) -> dict[str, Any]:
    """Reduce raw research items to a ResearchDropSummary-shaped dict."""
    if not raw_items:
        return {"sentiment": 0.0, "top_topics": [topic], "complaint_topics": [],
                "activity_level": 0.3, "sample_quotes": []}
    sentiments = [float(i.get("sentiment", 0.0)) for i in raw_items if "sentiment" in i]
    quotes = [str(i.get("text") or i.get("title") or "")[:200] for i in raw_items[:5]]
    # Topic extraction: most frequent tags/keywords present on items.
    from collections import Counter

    tags = Counter()
    for item in raw_items:
        for tag in item.get("tags", []) or []:
            tags[str(tag).lower()] += 1
    top = [t for t, _ in tags.most_common(3)] or [topic]
    complaints = [str(i.get("text", ""))[:80] for i in raw_items if float(i.get("sentiment", 0)) < -0.3][:3]
    return {
        "sentiment": round(sum(sentiments) / len(sentiments), 3) if sentiments else 0.0,
        "top_topics": top,
        "complaint_topics": complaints,
        "activity_level": min(1.0, len(raw_items) / 50),
        "sample_quotes": [q for q in quotes if q],
    }


def research(topic: str, platforms: list[str] | None = None, timeout_s: float = 180.0) -> dict[str, Any]:
    """Run last30days research for a topic; return (summary, simulated flag)."""
    platforms = [p for p in (platforms or ["reddit", "x"]) if p in SUPPORTED_PLATFORMS]

    try:
        # The skill exposes a CLI; invoke it in JSON mode if available.
        result = subprocess.run(
            [sys.executable, "-m", "last30days", "--json", "--topic", topic,
             "--platforms", ",".join(platforms)],
            capture_output=True, text=True, timeout=timeout_s,
        )
        if result.returncode == 0 and result.stdout.strip():
            payload = json.loads(result.stdout)
            items = payload.get("items") or payload.get("results") or []
            summary = _summarize(items, topic)
            summary["simulated"] = False
            summary["platforms"] = platforms
            return summary
    except (subprocess.SubprocessError, json.JSONDecodeError, FileNotFoundError, OSError):
        pass

    # Fallback: structured simulated drop (keeps unify pipeline testable).
    summary = _summarize([], topic)
    summary["simulated"] = True
    summary["platforms"] = platforms
    return summary
