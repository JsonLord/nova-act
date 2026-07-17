# Drop-in module for the ux-mentor Space (Leon4gr45/ux-mentor).
# Adds SCREENSHOT analysis next to the existing Figma-data analysis, so the
# same screenshot UserSync feeds to screenshot-to-code also drives the UX
# heatmap/problem analysis. Mirrors views.py conventions (csrf_exempt Django
# views, genai client with model fallback, extract_json_from_model_response).
#
# Install (2 steps, see README.md next to this file):
#   1. copy this file to ux_tester/screenshot_analysis.py
#   2. add to ux_tester/urls.py:
#        from . import screenshot_analysis
#        path('generate_heatmap_screenshot/',
#             screenshot_analysis.generate_heatmap_screenshot,
#             name='generate_heatmap_screenshot'),

import base64
import json
import os

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from google import genai

from .views import extract_json_from_model_response

GLOBAL_SEARCH_API_KEY = os.environ.get('GLOBAL_SEARCH_API_KEY')

# Same analysis contract as BASE_PROMPT_TEMPLATE in views.py, adapted to one
# screenshot: the response is keyed by the pseudo-frame id "screenshot" and
# every coordinate is a percentage over the image itself.
SCREENSHOT_PROMPT_TEMPLATE = """
You are a world-class UX/UI design expert. Analyze the provided SCREENSHOT of a user interface.

{user_prompt_section}

The final output must be a single, valid JSON object with the key "analysis_data",
whose single entry key is "screenshot". Its value must be a JSON object with five keys:
"heatmap", "report", "suggestions", "positive_points", and "ux_score",
plus an array "drop_off_points".

- "heatmap": at least 6 items [{{"x": 0-100, "y": 0-100, "intensity": 0.0-1.0}}]
  representing predicted user attention over the screenshot.
- "report": an HTML report with <h2>Overall Assessment</h2>, <h2>Key Strengths</h2>,
  <h2>Areas for Improvement</h2>, and <h2>Recommendations</h2> sections (2-3 bullet points each).
- "suggestions": at least 6 items [{{"x": 0-100, "y": 0-100, "suggestion": "..."}}].
- "drop_off_points": 2-3 items [{{"x": 0-100, "y": 0-100, "reason": "..."}}] where users
  might get confused, stuck, or abandon the task.
- "positive_points": 2-3 items [{{"x": 0-100, "y": 0-100, "reason": "..."}}].
- "ux_score": 0-100 following this rubric: Visual Hierarchy and Layout (25),
  Usability and Navigation (25), Content and Readability (25), Interaction Design (25);
  deduct -5 to -15 per drop-off point and -3 to -10 per suggestion; add +5 to +15 per
  positive point.

IMPORTANT: all x/y coordinates are percentages (0-100) over the screenshot:
x 0 = left edge, x 100 = right edge, y 0 = top edge, y 100 = bottom edge.
Respond with ONLY the JSON object.
"""

MODEL_NAMES = [
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]


def _decode_screenshot(screenshot):
    """Accept a raw base64 string or a data URL; return (bytes, mime_type)."""
    mime_type = 'image/png'
    if screenshot.startswith('data:'):
        header, _, payload = screenshot.partition(',')
        mime_type = header.split(':', 1)[1].split(';', 1)[0] or mime_type
        screenshot = payload
    return base64.b64decode(screenshot), mime_type


@csrf_exempt
def call_gemini_heatmap_screenshot(screenshot, user_prompt=''):
    """UX analysis of a screenshot via Gemini's multimodal input."""
    image_bytes, mime_type = _decode_screenshot(screenshot)

    user_prompt_section = f"""
    Additional User Instructions:
    {user_prompt}

    Please incorporate these instructions while maintaining the required output structure.
    """ if user_prompt else ""

    prompt = SCREENSHOT_PROMPT_TEMPLATE.format(user_prompt_section=user_prompt_section)

    last_error = None
    client = genai.Client(api_key=GLOBAL_SEARCH_API_KEY)

    for model_name in MODEL_NAMES:
        try:
            print(f"Attempting screenshot analysis with model: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=[{
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(image_bytes).decode(),
                        }},
                    ],
                }],
            )

            if response.candidates:
                content_data = response.candidates[0].content
                if not content_data or not content_data.parts:
                    continue
                parts = content_data.parts
                if not parts[0].text:
                    continue

                heatmap_report = extract_json_from_model_response(parts[0].text)
                if "analysis_data" in heatmap_report:
                    # Normalize to the single "screenshot" pseudo-frame.
                    entries = heatmap_report["analysis_data"]
                    if entries and "screenshot" not in entries:
                        first_key = next(iter(entries))
                        entries = {"screenshot": entries[first_key]}
                    heatmap_report["analysis_data"] = entries
                return heatmap_report

        except Exception as e:
            last_error = e
            print(f"Error with model {model_name}: {str(e)}")
            continue

    if last_error:
        raise Exception(f"All Gemini models failed. Last error: {str(last_error)}")
    raise Exception("All Gemini models failed without specific error information")


@csrf_exempt
def generate_heatmap_screenshot(request):
    """POST {screenshot: <base64 or data URL>, user_prompt} ->
    {heatmap_data: {analysis_data: {screenshot: {...}}}} — the same response
    envelope as /generate_heatmap/, so clients parse both identically."""
    if request.method == 'POST':
        data = json.loads(request.body)
        screenshot = data.get('screenshot')
        user_prompt = data.get('user_prompt', '')

        if not screenshot:
            return JsonResponse({'error': 'screenshot (base64 or data URL) is required.'}, status=400)

        try:
            heatmap_data = call_gemini_heatmap_screenshot(screenshot, user_prompt)
        except Exception as e:
            return JsonResponse({'error': f'Model call failed: {str(e)}'}, status=500)

        return JsonResponse({'heatmap_data': heatmap_data})

    return JsonResponse({'error': 'Invalid request method.'}, status=405)
