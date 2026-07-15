# Nova Act Suite Delivery Spec

## Navigation
Main tabs are merged to six top-level workspaces: UserSync, Nova Act, DataHub, Oasis, Graph, and Dev. Each tab owns sorted subviews exposed through a reusable `< >` slider.

## Backend contract
All tabs communicate through `/api/tabs/events`; API discovery is exposed at `/api/openapi.json` and rendered from the Dev tab. `fastapi_app.py` is the FastAPI reference implementation, while `server.cjs` mirrors the same contract for the current Vite/Express deployment.

## Shared authentication
One Hugging Face OAuth login writes the `hf_user` cookie at `/`, so UserSync, Nova Act, DataHub, Oasis, Graph, and Dev resolve the same identity with `/api/user`.


## Mindwalk and OmniParser adaptation
Mindwalk provides the graph memory layer: suite tabs, subviews, personas, and limitation functions become touch-state nodes. Microsoft OmniParser is the UI-to-LLM language transitioner: screen elements are normalized into grounded element descriptions, bounding boxes, interactability, and action phrases. The implementation is an in-app adapter, not a vendored copy of either project, and is wired to `/api/mindwalk/graph`, `/api/omniparser/parse`, and `/api/nova-act/limitations` for later steering of persona-specific Nova Act runs.
