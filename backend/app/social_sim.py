"""Social Mirror runtime — a dependency-light OASIS-compatible simulator.

Runs the persona hub as a living social network (Reddit/X-style) over N
timesteps, producing per-timestep frames for the network animation and
network metrics for the real-vs-synthetic comparison (spec.md Tab 6).

Faithful to the OASIS model without requiring the full camel-oasis + LLM
stack: agents carry the generated persona features, each timestep activates
a fraction of them (by activity level — the OASIS activation schedule),
activated agents choose an action from the platform vocabulary via a
deterministic persona-driven policy (post / comment / like / repost /
follow), and a preferential-attachment recsys surfaces content. Optional
LLM hook composes post text; without it, content is templated so the whole
simulation is seeded-deterministic and runs on CPU.
"""

from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Callable

ACTIONS = ["post", "comment", "like", "repost", "follow"]
LlmHook = Callable[[str], str]


@dataclass
class Frame:
    t: int
    active: list[int]
    new_posts: list[dict[str, Any]]
    new_edges: list[list[int]]
    engagement: dict[str, int]  # {likes, comments, reposts} this step


@dataclass
class SimulationResult:
    frames: list[Frame] = field(default_factory=list)
    posts: list[dict[str, Any]] = field(default_factory=list)
    edges: list[list[int]] = field(default_factory=list)  # follower -> followee
    llm_calls: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "frames": [
                {
                    "t": f.t, "active": f.active, "new_posts": f.new_posts,
                    "new_edges": f.new_edges, "engagement": f.engagement,
                }
                for f in self.frames
            ],
            "posts": self.posts,
            "edges": self.edges,
            "llm_calls": self.llm_calls,
        }


def _activity_weight(profile: dict[str, Any]) -> float:
    """How likely this persona is to be active/posting per step (0..1),
    from emotional expressiveness and novelty-seeking."""
    emotional = profile.get("emotional", {})
    return min(
        1.0,
        0.15
        + 0.12 * emotional.get("expressiveness", 3)
        + 0.05 * emotional.get("novelty_seeking", 3),
    ) / 1.0


def _choose_action(profile: dict[str, Any], rng: random.Random, has_feed: bool) -> str:
    """Persona-driven action policy. Expressive personas post/comment more;
    low-expressiveness personas lurk (like/repost)."""
    emotional = profile.get("emotional", {})
    expressiveness = emotional.get("expressiveness", 3)
    weights = {
        "post": 1 + expressiveness,
        "comment": (1 + expressiveness) if has_feed else 0,
        "like": 3 if has_feed else 0,
        "repost": (emotional.get("novelty_seeking", 3)) if has_feed else 0,
        "follow": 2 if has_feed else 1,
    }
    actions = [a for a, w in weights.items() if w > 0]
    return rng.choices(actions, weights=[weights[a] for a in actions])[0]


def _post_text(profile: dict[str, Any], llm: LlmHook | None) -> tuple[str, float]:
    """Return (text, sentiment). Sentiment is anchored on brand affinity."""
    opinions = profile.get("opinions", [])
    emotional = profile.get("emotional", {})
    affinity = emotional.get("brand_affinity", 0)
    sentiment = max(-1.0, min(1.0, affinity / 2 + (0.1 if emotional.get("baseline_mood") == "positive" else 0)))
    topic = opinions[0]["topic"] if opinions else "the product"
    if llm is not None:
        text = llm(
            f"As {profile.get('realname', 'a user')} ({profile.get('persona', '')[:200]}), "
            f"write a one-sentence social post about '{topic}', sentiment {sentiment:+.1f}."
        )
        return text.strip(), sentiment
    stance = "loving" if sentiment > 0.2 else "frustrated with" if sentiment < -0.2 else "trying out"
    return f"{stance} {topic}.", sentiment


def simulate(
    graph: dict[str, Any],
    timesteps: int = 10,
    activate_fraction: float = 0.25,
    seed: int = 42,
    platform: str = "reddit",
    llm: LlmHook | None = None,
) -> SimulationResult:
    """Run the social simulation over a persona graph payload."""
    rng = random.Random(seed)
    nodes = graph["nodes"]
    n = len(nodes)
    profiles = [node["profile"] for node in nodes]
    result = SimulationResult()

    # Seed edges from the generated social ties.
    edge_set = {(e["source"], e["target"]) for e in graph.get("edges", [])}
    result.edges = [list(e) for e in edge_set]
    activity = [_activity_weight(p) for p in profiles]

    for t in range(timesteps):
        # Activation schedule: weighted by persona activity (OASIS pattern).
        k = max(1, int(n * activate_fraction))
        active = rng.choices(range(n), weights=activity, k=k)
        active = sorted(set(active))
        frame = Frame(t=t, active=active, new_posts=[], new_edges=[], engagement={"likes": 0, "comments": 0, "reposts": 0})
        has_feed = len(result.posts) > 0

        for agent in active:
            action = _choose_action(profiles[agent], rng, has_feed)
            if action == "post":
                text, sentiment = _post_text(profiles[agent], llm)
                if llm is not None:
                    result.llm_calls += 1
                post = {"id": len(result.posts), "author": agent, "t": t, "text": text,
                        "sentiment": round(sentiment, 3), "likes": 0, "comments": 0, "reposts": 0}
                result.posts.append(post)
                frame.new_posts.append(post)
            elif result.posts:
                # Preferential-attachment recsys: surface a popular recent post.
                target = max(
                    rng.sample(result.posts, min(5, len(result.posts))),
                    key=lambda p: p["likes"] + p["reposts"] + 1,
                )
                if action == "like":
                    target["likes"] += 1
                    frame.engagement["likes"] += 1
                elif action == "comment":
                    target["comments"] += 1
                    frame.engagement["comments"] += 1
                elif action == "repost":
                    target["reposts"] += 1
                    frame.engagement["reposts"] += 1
                elif action == "follow" and target["author"] != agent:
                    edge = (agent, target["author"])
                    if edge not in edge_set:
                        edge_set.add(edge)
                        result.edges.append(list(edge))
                        frame.new_edges.append(list(edge))
        result.frames.append(frame)

    return result


# --- Item 2: network metrics + real-vs-synthetic comparison ------------------

def network_metrics(node_count: int, edges: list[list[int]], posts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Degree distribution, density, components/communities, and (if posts
    given) sentiment/topic signals — dependency-free."""
    out_deg = Counter()
    in_deg = Counter()
    adj: dict[int, set[int]] = {i: set() for i in range(node_count)}
    for src, dst in edges:
        out_deg[src] += 1
        in_deg[dst] += 1
        adj[src].add(dst)
        adj[dst].add(src)

    degrees = [len(adj[i]) for i in range(node_count)]
    max_edges = node_count * (node_count - 1) or 1
    density = len(edges) / max_edges

    # Connected components via union-find on the undirected projection.
    parent = list(range(node_count))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for src, dst in edges:
        parent[find(src)] = find(dst)
    components = len({find(i) for i in range(node_count)})

    metrics = {
        "nodes": node_count,
        "edges": len(edges),
        "density": round(density, 4),
        "avg_degree": round(sum(degrees) / node_count, 3) if node_count else 0,
        "max_degree": max(degrees) if degrees else 0,
        "components": components,
        "degree_histogram": _histogram(degrees),
        "top_hubs": [node for node, _ in in_deg.most_common(5)],
    }
    if posts:
        sentiments = [p["sentiment"] for p in posts]
        metrics["post_count"] = len(posts)
        metrics["mean_sentiment"] = round(sum(sentiments) / len(sentiments), 3) if sentiments else 0.0
        metrics["total_engagement"] = sum(p["likes"] + p["comments"] + p["reposts"] for p in posts)
    return metrics


def _histogram(degrees: list[int], bins: int = 6) -> list[int]:
    if not degrees:
        return [0] * bins
    hi = max(degrees) or 1
    hist = [0] * bins
    for d in degrees:
        hist[min(bins - 1, int(d / (hi + 1) * bins))] += 1
    return hist


def compare_graphs(synthetic: dict[str, Any], real: dict[str, Any]) -> dict[str, Any]:
    """Real-vs-synthetic comparison (spec Tab 6): per-metric deltas and a
    similarity score, so the synthetic mirror can be validated against the
    real social-analysis graph."""
    keys = ["density", "avg_degree", "max_degree", "components", "mean_sentiment"]
    deltas = {}
    scores = []
    for key in keys:
        s, r = synthetic.get(key), real.get(key)
        if s is None or r is None:
            continue
        deltas[key] = round(s - r, 4)
        denom = max(abs(r), abs(s), 1e-6)
        scores.append(1 - min(1.0, abs(s - r) / denom))
    return {
        "deltas": deltas,
        "similarity": round(sum(scores) / len(scores), 3) if scores else 0.0,
        "synthetic": synthetic,
        "real": real,
    }
