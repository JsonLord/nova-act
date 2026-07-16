"""Pack registry: each entry is an independently deployable API service package.

Deploy all packs (`USERSYNC_PACKS=all`) for the full app, or a subset
(`USERSYNC_PACKS=personas,steering`) for a standalone station — the
standalone products of spec.md §14.
"""

from backend.app.routers import (
    account,
    analysis,
    auth,
    datahub,
    journeys,
    personas,
    social,
    steering,
    uxchain,
)

PACKS = {
    "auth": [auth.router],
    "personas": [personas.router],
    "steering": [steering.router],
    "datahub": [datahub.router, datahub.connectors_router],
    "journeys": [journeys.router],
    "analysis": [analysis.router, analysis.qa_router],
    "social": [social.router],
    "uxchain": [uxchain.router],
    "account": [account.router],
}
