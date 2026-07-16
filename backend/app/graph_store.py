"""Neo4j / Neptune graph store (spec §5/§10) — placeholder connection.

Pulls connection parameters from HF Secrets via config (NEO4J_URI,
NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE). The connection is **wired but
not yet validated in a real Space** — `status()` reports whether it's
configured and, when the `neo4j` driver is installed, whether a live
`RETURN 1` round-trips. Persona/social graphs still ship on file-based
snapshots under /data; this is the export/import target to switch on once a
Neo4j AuraDB (or Neptune via the bolt protocol) is attached.

Design: never hard-fail. Missing driver or missing secrets => a clear
"not configured / not connected" status, never a 500 on the rest of the app.
"""

from __future__ import annotations

from typing import Any

from backend.app.config import get_settings


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.neo4j_uri and settings.neo4j_password)


def _driver():
    """Return a neo4j driver or raise a clear error. Caller handles failure."""
    from neo4j import GraphDatabase  # imported lazily; optional dependency

    settings = get_settings()
    return GraphDatabase.driver(
        settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
    )


def status() -> dict[str, Any]:
    """Report configuration + live connectivity without ever raising."""
    settings = get_settings()
    if not is_configured():
        return {
            "configured": False,
            "connected": False,
            "detail": "NEO4J_URI/NEO4J_PASSWORD not set (add them as HF Space Secrets)",
            "uri": settings.neo4j_uri or None,
        }
    try:
        import neo4j  # noqa: F401
    except ImportError:
        return {
            "configured": True,
            "connected": False,
            "detail": "neo4j driver not installed (add `neo4j` to requirements to enable)",
            "uri": settings.neo4j_uri,
        }
    try:
        driver = _driver()
        with driver.session(database=settings.neo4j_database) as session:
            value = session.run("RETURN 1 AS ok").single()["ok"]
        driver.close()
        return {"configured": True, "connected": value == 1, "detail": "RETURN 1 round-trip ok",
                "uri": settings.neo4j_uri, "database": settings.neo4j_database}
    except Exception as error:  # bad creds, network, TLS — report, don't crash
        return {"configured": True, "connected": False,
                "detail": f"connection failed: {str(error)[:200]}", "uri": settings.neo4j_uri}


def export_graph(graph_id: str, graph: dict[str, Any]) -> dict[str, Any]:
    """Placeholder export: writes persona/social nodes+edges to Neo4j when
    connected. Cypher is written but only exercised once a real DB is
    attached — returns a dry-run summary otherwise."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    check = status()
    if not check["connected"]:
        return {"exported": False, "reason": check["detail"],
                "would_write": {"nodes": len(nodes), "edges": len(edges)}}
    try:
        driver = _driver()
        with driver.session(database=get_settings().neo4j_database) as session:
            session.run("UNWIND $rows AS r "
                        "MERGE (p:Persona {graph_id:$gid, node_id:r.id}) "
                        "SET p.label = r.label",
                        rows=[{"id": str(n.get("id", i)), "label": n.get("label", "")}
                              for i, n in enumerate(nodes)], gid=graph_id)
            session.run("UNWIND $rows AS r "
                        "MATCH (a:Persona {graph_id:$gid, node_id:r.src}) "
                        "MATCH (b:Persona {graph_id:$gid, node_id:r.dst}) "
                        "MERGE (a)-[:FOLLOWS]->(b)",
                        rows=[{"src": str(e.get("source")), "dst": str(e.get("target"))}
                              for e in edges], gid=graph_id)
        driver.close()
        return {"exported": True, "nodes": len(nodes), "edges": len(edges), "graph_id": graph_id}
    except Exception as error:
        return {"exported": False, "reason": f"export failed: {str(error)[:200]}"}
