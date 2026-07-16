"""The steerable observation pipeline: scan patterns, fixation budgets,
colorless vision, recognition points, progressive disclosure, OmniParser
mapping — spec.md §4.4."""

from backend.app.perception import (
    PerceptionProfile,
    apply_perception,
    omniparser_to_elements,
    profile_from_steering,
    scan_weight,
)


def element(index, x, y, text="label", w=0.1, h=0.05, **extra):
    return {"index": index, "tag": "button", "text": text, "x": x, "y": y, "w": w, "h": h, **extra}


def test_default_profile_perceives_everything():
    elements = [element(i, 0.5, 0.9) for i in range(30)]
    result = apply_perception(elements, PerceptionProfile())
    assert len(result.perceived) == 30 and not result.missed


def test_f_pattern_gives_top_left_better_recognition_than_bottom_right():
    assert scan_weight(0.1, 0.05, "F") > scan_weight(0.9, 0.9, "F")
    top_left = element(0, 0.1, 0.05)
    bottom_right = element(1, 0.9, 0.9, w=0.02, h=0.02)
    profile = PerceptionProfile(scan_pattern="F", fixation_budget=1)
    result = apply_perception([bottom_right, top_left], profile)
    assert result.perceived[0]["index"] == 0  # on-path element wins the single fixation
    assert result.missed[0]["index"] == 1
    assert "fixation budget" in result.missed[0]["missed_because"]


def test_vision_latency_progressive_disclosure_across_looks():
    elements = [element(i, 0.05 + i * 0.1, 0.05) for i in range(8)]
    profile = PerceptionProfile(scan_pattern="F", fixation_budget=3)
    first_look = apply_perception(elements, profile, look_index=0)
    second_look = apply_perception(elements, profile, look_index=1)
    assert len(first_look.perceived) == 3
    assert len(second_look.perceived) == 6  # re-looking widens the window
    assert {e["index"] for e in first_look.perceived} <= {e["index"] for e in second_look.perceived}


def test_colorless_vision_drops_color_dependent_elements():
    color_button = element(0, 0.5, 0.1, text="", color_dependent=True)
    labeled = element(1, 0.5, 0.2, text="Checkout")
    normal = apply_perception([color_button, labeled], PerceptionProfile(digital_literacy=5))
    assert len(normal.perceived) == 2
    cvd = apply_perception([color_button, labeled], PerceptionProfile(color_vision="deuteranopia"))
    assert [e["index"] for e in cvd.perceived] == [1]
    assert "color-only" in cvd.missed[0]["missed_because"]


def test_recognition_points_gate_unlabeled_icons_by_literacy():
    icon = element(0, 0.5, 0.1, text="")
    expert = apply_perception([icon], PerceptionProfile(digital_literacy=5))
    novice = apply_perception([icon], PerceptionProfile(digital_literacy=2))
    assert expert.perceived[0]["text"] == ""  # expert recognizes context
    assert novice.perceived[0]["text"] == "(unidentified control)"
    assert novice.perceived[0]["degraded"] == "literacy"


def test_low_acuity_blurs_small_labels():
    tiny = element(0, 0.5, 0.1, text="Fine print", w=0.01, h=0.01)
    result = apply_perception([tiny], PerceptionProfile(vision_acuity=1))
    assert result.perceived[0]["text"] == "(too small to read)"


def test_profile_from_steering_reads_derive_steering_payload():
    steering = {
        "observing": {
            "scan_pattern": {"value": "F"},
            "fixation_budget": {"value": 5},
            "vision_acuity": {"value": 2},
            "color_vision_deficiency": {"value": "protanopia"},
            "digital_literacy": {"value": 2},
        }
    }
    profile = profile_from_steering(steering)
    assert (profile.scan_pattern, profile.fixation_budget) == ("F", 5)
    assert (profile.vision_acuity, profile.color_vision) == (2, "protanopia")
    # Missing fields stay permissive.
    permissive = profile_from_steering(None)
    assert permissive.fixation_budget > 100 and permissive.scan_pattern == "full"


def test_omniparser_list_maps_onto_the_same_filter():
    parsed = [
        {"type": "icon", "bbox": [0.1, 0.05, 0.3, 0.15], "interactivity": True, "content": "search icon"},
        {"type": "text", "bbox": [0.4, 0.8, 0.9, 0.95], "interactivity": False, "content": "footer legal text"},
    ]
    elements = omniparser_to_elements(parsed)
    assert elements[0]["source"] == "omniparser"
    assert abs(elements[0]["x"] - 0.2) < 1e-6
    result = apply_perception(elements, PerceptionProfile(scan_pattern="F", fixation_budget=1))
    assert result.perceived[0]["text"] == "search icon"  # top-left wins the fixation


def test_derive_steering_exposes_perception_fields():
    from oasis.generator.generation import GenerationSpec, generate_personas
    from oasis.generator.schema import CompanyContext
    from oasis.generator.steering import derive_steering

    hub = generate_personas(GenerationSpec(company=CompanyContext(), count=3, seed=5))
    config = derive_steering(hub.personas[0]).to_dict()
    observing = config["observing"]
    assert observing["scan_pattern"]["value"] in ("F", "T", "full")
    assert observing["fixation_budget"]["value"] >= 1
    profile = profile_from_steering(config)
    assert profile.scan_pattern == observing["scan_pattern"]["value"]
