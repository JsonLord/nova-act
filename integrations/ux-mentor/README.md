# ux-mentor screenshot-analysis extension

Adds raw-screenshot UX analysis to the ux-mentor Space
(`https://huggingface.co/spaces/Leon4gr45/ux-mentor`), so the **same screenshot** UserSync sends
to screenshot-to-code also drives the heatmap/problem analysis — no Figma file required.

Today ux-mentor's `/generate_heatmap/` serializes Figma node JSON into a text-only Gemini prompt.
Gemini is multimodal, so this extension sends the screenshot as an `inline_data` image part with
the same analysis contract (heatmap points, HTML report, suggestions, drop-off points,
positive points, ux_score — all coordinates as percentages over the image).

## Install on the Space (owner push; this environment has no HF write access)

```bash
git clone https://huggingface.co/spaces/Leon4gr45/ux-mentor
cp integrations/ux-mentor/screenshot_analysis.py ux-mentor/ux_tester/screenshot_analysis.py
```

Then add two lines to `ux-mentor/ux_tester/urls.py`:

```python
from . import screenshot_analysis   # with the other imports

    # inside urlpatterns:
    path('generate_heatmap_screenshot/', screenshot_analysis.generate_heatmap_screenshot,
         name='generate_heatmap_screenshot'),
```

Commit + push to the Space. Requires the `GLOBAL_SEARCH_API_KEY` (Gemini) secret, same as the
existing heatmap endpoint.

## Contract

```
POST /generate_heatmap_screenshot/
{ "screenshot": "<base64 or data:image/png;base64,...>", "user_prompt": "optional" }
->
{ "heatmap_data": { "analysis_data": { "screenshot": {
    "heatmap": [{"x": 0-100, "y": 0-100, "intensity": 0..1}, ...],
    "report": "<h2>...</h2>",
    "suggestions": [{"x", "y", "suggestion"}, ...],
    "drop_off_points": [{"x", "y", "reason"}, ...],
    "positive_points": [{"x", "y", "reason"}, ...],
    "ux_score": 0-100 } } } }
```

Same response envelope as `/generate_heatmap/` (keyed by the pseudo-frame `"screenshot"` instead
of Figma node ids), so UserSync's ux-chain parses both paths identically
(`backend/app/routers/uxchain.py`).
