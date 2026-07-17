"""Pack registry: each entry is an independently deployable API service package.

Deploy all packs (`USERSYNC_PACKS=all`) for the full app, or a subset
(`USERSYNC_PACKS=personas,steering`) for a standalone station — the
standalone products of spec.md §14.
"""

from backend.app.routers import (
    account,
    analysis,
    auth,
    corrections,
    datahub,
    jobs,
    journeys,
    personas,
    social,
    steering,
    usersync_compat,
    uxchain,
)

PACKS = {
    "auth": [auth.router],
    "personas": [personas.router],
    "steering": [steering.router],
    "corrections": [corrections.router],
    "datahub": [datahub.router, datahub.connectors_router, datahub.graph_store_router],
    "journeys": [journeys.router],
    "analysis": [analysis.router, analysis.qa_router],
    "social": [social.router],
    "uxchain": [uxchain.router],
    "account": [account.router],
    "jobs": [jobs.router],
    # Same-origin surface for the Leon4gr45/UserSync Space frontend
    # (/api/v1/*, /api/tabs/*, /api/user, /api/craft, save/list-data).
    "usersync": [usersync_compat.router],
}
