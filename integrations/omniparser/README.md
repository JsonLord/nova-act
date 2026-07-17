# OmniParser station (`JsonLord/OmniParser` fork)

The parser station feeding the **steerable observation pipeline** (spec.md §4.4) for visual
surfaces the DOM cannot describe: canvas apps, **Figma prototype embeds**, image-heavy UIs.

## Good news: the fork already ships the server

`omnitool/omniparserserver/omniparserserver.py` in the fork is a ready FastAPI service:

```
POST /parse/   { "base64_image": "<png b64>" }
->             { "som_image_base64": "<labeled img>",
                 "parsed_content_list": [
                   { "type": "icon"|"text", "bbox": [x1,y1,x2,y2],   # ratio coords
                     "interactivity": true, "content": "<caption>" } ],
                 "latency": 0.6 }
GET /probe/    liveness
```

UserSync consumes it via `OMNIPARSER_BASE_URL`:
`backend/app/engines/open_engine.py::_try_omniparser` escalates automatically when a
content-rich page yields <3 DOM interactables, maps `parsed_content_list` through
`perception.omniparser_to_elements()` into the **same perceptual filter** as DOM elements
(scan patterns, fixation budgets, CVD drops), and actuates by coordinates
(`page.mouse.click(x·vw, y·vh)`).

## Deploy as a GPU Space

1. Create a Space from the fork (Docker or Gradio SDK; **GPU or ZeroGPU hardware** — V2 runs
   ~0.6 s/frame on GPU, CPU is many seconds/frame and not recommended).
2. Download the model weights per the fork README (`weights/icon_detect`,
   `weights/icon_caption_florence`) into the image or at startup.
3. Start: `python -m omnitool.omniparserserver.omniparserserver --som_model_path ...
   --caption_model_path ...` on port 7860 (add `app_port: 7860` to the Space README).
4. Set `OMNIPARSER_BASE_URL=https://<space>.hf.space` on the UserSync Space.

## License note (check before commercial hosting)

The two model weights carry **different licenses** per their model cards: the icon-detection
(YOLO-based) model is **AGPL**-licensed, the Florence-2 captioner is MIT. Running it as this
isolated station keeps the AGPL component contained to one service, but review obligations
before selling access.
