"""FastAPI reference backend for the Nova Act Suite."""
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from fastapi import Cookie, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Nova Act Suite API", version="1.0.0", description="Shared auth, tab communication, Nova Act actions, and DataHub records.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class TabEventIn(BaseModel):
    source: str = Field(..., examples=["usersync"])
    target: str | None = Field(default="broadcast", examples=["graph"])
    action: str = Field(..., examples=["view.changed"])
    payload: dict[str, Any] = Field(default_factory=dict)

class TabEvent(TabEventIn):
    id: str
    timestamp: datetime

class NovaActSessionIn(BaseModel):
    target_url: str = "https://nova.amazon.com/"
    instruction: str = "Open the target and summarize the page state."

class LimitationInjectionIn(BaseModel):
    limitation_ids: list[str] = Field(default_factory=list)
    prompt: str | None = None

class OmniParserElementIn(BaseModel):
    id: str
    type: str = "panel"
    label: str
    bbox: list[float] = Field(default_factory=lambda: [0, 0, 100, 100])
    interactable: bool = False
    description: str = "current application viewport"

class OmniParserParseIn(BaseModel):
    screen_name: str = "Nova Act Suite"
    elements: list[OmniParserElementIn] = Field(default_factory=list)

_events: list[TabEvent] = []

_mindwalk_limitations = [
    {"id": "limit-safe-navigation", "label": "Safe navigation", "guardrail": "Only navigate, read, extract, and verify unless the active persona explicitly allows mutation.", "injectInto": ["nova-act", "graph"]},
    {"id": "limit-sensitive-fields", "label": "Sensitive-field pause", "guardrail": "Pause and request supervisor review before entering passwords, tokens, payment data, or private identifiers.", "injectInto": ["nova-act", "usersync", "datahub"]},
    {"id": "limit-evidence-first", "label": "Evidence-first output", "guardrail": "Return file, DOM, API, or screenshot evidence with every persona-facing recommendation.", "injectInto": ["dev", "graph", "oasis"]},
]

@app.get("/api/user")
def get_user(hf_user: str | None = Cookie(default=None)) -> dict[str, Any]:
    if not hf_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"shared_hf_cookie": True, "raw": hf_user}

@app.post("/api/tabs/events", status_code=201)
def publish_event(event: TabEventIn) -> TabEvent:
    saved = TabEvent(id=str(uuid4()), timestamp=datetime.now(timezone.utc), **event.model_dump())
    _events.insert(0, saved)
    del _events[100:]
    return saved

@app.get("/api/tabs/events")
def list_events() -> list[TabEvent]:
    return _events

@app.post("/api/nova-act/session", status_code=202)
def create_nova_act_session(session: NovaActSessionIn, hf_user: str | None = Cookie(default=None)) -> dict[str, Any]:
    return {"id": str(uuid4()), "status": "queued", "sharedAuth": bool(hf_user), **session.model_dump()}

@app.get("/api/datahub/records")
def list_datahub_records() -> list[dict[str, Any]]:
    return []

@app.get("/api/mindwalk/graph")
def get_mindwalk_graph_contract() -> dict[str, Any]:
    return {"source": "cosmtrek/mindwalk-inspired-adapter", "model": "tabs-subviews-personas-limitations", "touchStates": ["unvisited", "seen", "read", "edited", "limited"], "limitations": _mindwalk_limitations}

@app.post("/api/nova-act/limitations", status_code=202)
def inject_nova_act_limitations(injection: LimitationInjectionIn) -> dict[str, Any]:
    requested = set(injection.limitation_ids)
    selected = [item for item in _mindwalk_limitations if not requested or item["id"] in requested]
    return {"accepted": True, "selected": selected, "prompt": injection.prompt}

@app.post("/api/omniparser/parse")
def parse_ui_for_llm(payload: OmniParserParseIn) -> dict[str, Any]:
    elements = payload.elements or [OmniParserElementIn(id="viewport", label=payload.screen_name)]
    interactable = [element for element in elements if element.interactable]
    phrases = [f"Screen: {payload.screen_name}.", f"Detected {len(elements)} UI elements; {len(interactable)} are interactable."]
    phrases.extend([f"Use {element.type} \"{element.label}\" at bbox [{', '.join(map(str, element.bbox))}] to {element.description}." for element in interactable])
    return {"source": "microsoft/OmniParser-adapter", "screenshotId": f"{payload.screen_name.lower().replace(' ', '-')}-synthetic", "elements": [element.model_dump() for element in elements], "llmLanguage": " ".join(phrases)}
