"""Layer-1 write access: developer-authored derivation rulesets.

Layer 1 (discovered steering) stays *deterministic and reviewable*, but a
developer may now decide **how each parameter is computed** from persona
features — a versioned ruleset applied at derivation time to every persona.

Each writable field gets a rule:
- ``{"type": "formula", "expr": "..."}`` — a **safe expression** over the
  persona's feature variables (arithmetic + min/max/round/abs/clamp only;
  no attribute access, calls, or arbitrary code), or
- ``{"type": "const", "value": ...}`` — a fixed value (any type), or
- absent — keep the built-in deterministic default.

This is genuine write access to the compute rules while remaining
sandboxed: the evaluator rejects everything except numbers, the feature
variables, and a tiny math whitelist. Per-persona output is still read-only;
the *rules* are what became writable.
"""

from __future__ import annotations

import ast
import operator
from typing import Any

from oasis.generator.schema import UserSyncPersona
from backend.app.steering_apply import OVERRIDABLE_PATHS, OverrideError

# The feature namespace a formula may reference.
def feature_variables(persona: UserSyncPersona) -> dict[str, float]:
    p, m, e = persona.physical, persona.mental, persona.emotional
    return {
        "age": float(persona.age),
        # physical
        "vision_acuity": float(p.vision_acuity),
        "contrast_sensitivity": float(p.contrast_sensitivity),
        "motor_precision": float(p.motor_precision),
        "reaction_time_ms": float(p.reaction_time_ms),
        "typing_wpm": float(p.typing_wpm),
        "hearing": float(p.hearing),
        "fatigue": float(p.fatigue),
        # mental
        "digital_literacy": float(m.digital_literacy),
        "domain_knowledge": float(m.domain_knowledge),
        "attention_span": float(m.attention_span),
        "working_memory": float(m.working_memory),
        "reading_speed_wpm": float(m.reading_speed_wpm),
        "tech_confidence": float(m.tech_confidence),
        "language_proficiency": float(m.language_proficiency),
        # emotional
        "patience": float(e.patience),
        "trust_disposition": float(e.trust_disposition),
        "risk_aversion": float(e.risk_aversion),
        "brand_affinity": float(e.brand_affinity),
        "novelty_seeking": float(e.novelty_seeking),
        "expressiveness": float(e.expressiveness),
    }


_BIN_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod, ast.Pow: operator.pow,
}
_UNARY_OPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


_FUNCS = {"min": min, "max": max, "round": round, "abs": abs, "clamp": _clamp, "int": int, "float": float}


class FormulaError(ValueError):
    pass


def safe_eval(expr: str, variables: dict[str, float]) -> float:
    """Evaluate a numeric formula over `variables`. Rejects anything beyond
    numbers, those variables, arithmetic, and the math whitelist."""
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as error:
        raise FormulaError(f"syntax error: {error}")

    def ev(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return node.value
            raise FormulaError("only numeric constants allowed")
        if isinstance(node, ast.Name):
            if node.id not in variables:
                raise FormulaError(f"unknown variable: {node.id}")
            return variables[node.id]
        if isinstance(node, ast.BinOp) and type(node.op) in _BIN_OPS:
            return _BIN_OPS[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPS:
            return _UNARY_OPS[type(node.op)](ev(node.operand))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _FUNCS:
            if node.keywords:
                raise FormulaError("keyword args not allowed")
            return _FUNCS[node.func.id](*[ev(a) for a in node.args])
        if isinstance(node, ast.IfExp):  # conditional: a if cond else b
            return ev(node.body) if ev(node.test) else ev(node.orelse)
        if isinstance(node, ast.Compare) and len(node.ops) == 1:
            left, right = ev(node.left), ev(node.comparators[0])
            op = node.ops[0]
            cmp = {ast.Lt: operator.lt, ast.LtE: operator.le, ast.Gt: operator.gt,
                   ast.GtE: operator.ge, ast.Eq: operator.eq, ast.NotEq: operator.ne}
            if type(op) in cmp:
                return cmp[type(op)](left, right)
        raise FormulaError(f"disallowed expression: {ast.dump(node)[:60]}")

    return ev(tree)


def validate_ruleset(ruleset: dict[str, dict]) -> None:
    bad = set(ruleset) - OVERRIDABLE_PATHS
    if bad:
        raise OverrideError(f"unknown/forbidden rule paths: {sorted(bad)}")
    for path, rule in ruleset.items():
        rtype = rule.get("type")
        if rtype not in ("formula", "const"):
            raise OverrideError(f"rule for {path} must be type formula|const")
        if rtype == "formula" and not isinstance(rule.get("expr"), str):
            raise OverrideError(f"formula rule for {path} needs a string expr")


def apply_ruleset(config: dict[str, Any], persona: UserSyncPersona, ruleset: dict[str, dict]) -> dict[str, Any]:
    """Recompute writable fields per the dev ruleset, over this persona's
    features. Keeps the built-in value under `derived_from_default`."""
    validate_ruleset(ruleset)
    variables = feature_variables(persona)
    import copy

    merged = copy.deepcopy(config)
    applied = []
    for path, rule in ruleset.items():
        block, key = path.split(".", 1)
        node = merged.get(block, {})
        current = node.get(key)
        default_value = current.get("value") if isinstance(current, dict) else current
        if rule["type"] == "const":
            value, why = rule["value"], f"dev ruleset const: {rule['value']!r}"
        else:
            try:
                value = safe_eval(rule["expr"], variables)
            except FormulaError as error:
                raise OverrideError(f"formula error at {path}: {error}")
            why = f"dev ruleset formula: {rule['expr']}"
        node[key] = {
            "value": value, "source_fields": ["dev-derivation"], "rationale": why,
            "source": "dev-derivation", "derived_from_default": default_value,
        }
        merged[block] = node
        applied.append(path)
    merged.setdefault("provenance", {})["derivation_ruleset"] = applied
    return merged
