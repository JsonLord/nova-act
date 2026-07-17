"""Serializer v2 regression: the exact blind spots measured in the audit."""

import os
import tempfile

os.environ.setdefault("USERSYNC_DATA_DIR", tempfile.mkdtemp(prefix="usersync-test-"))

import pytest

from backend.app.engines.open_engine import find_chromium, serialize_page

MODERN = """<h1>Product page</h1>
<p>The UltraTent 2000 costs $299 and ships free.</p>
<div id='buy' style='cursor:pointer;background:teal;width:120px;padding:8px'>Buy now</div>
<span role='tab'>Reviews</span>
<div role='checkbox' aria-label='Accept terms'>Accept</div>
<div id='shadow-host'></div>
<button style='display:none'>hidden</button>
<div style='height:2000px'></div>
<button id='deep'>Below-fold CTA</button>
<script>
  document.getElementById('buy').addEventListener('click', ()=>alert('bought'));
  const sh=document.getElementById('shadow-host').attachShadow({mode:'open'});
  sh.innerHTML="<button>Shadow button</button>";
</script>"""

NAV_HEAVY = (
    "<nav>" + "".join(f"<a href='#{i}' style='font-size:9px'>Nav {i}</a>" for i in range(70))
    + "</nav><main><button id='cta' style='width:200px;height:60px'>The only real CTA</button></main>"
)


@pytest.fixture(scope="module")
def browser():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        instance = p.chromium.launch(headless=True, executable_path=find_chromium())
        yield instance
        instance.close()


@pytest.mark.skipif(find_chromium() is None, reason="no chromium available")
def test_modern_patterns_are_detected(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.set_content(MODERN)
    obs = serialize_page(page)
    texts = {e["text"] for e in obs["elements"]}

    assert any("Buy now" in t for t in texts), "addEventListener div (cursor:pointer)"
    assert any("Reviews" in t for t in texts), "role=tab"
    assert any("Accept" in t for t in texts), "role=checkbox"
    assert any("Shadow" in t for t in texts), "shadow DOM"
    assert not any("hidden" in t for t in texts), "display:none excluded"

    below = next(e for e in obs["elements"] if "Below-fold" in e["text"])
    assert below["in_viewport"] is False  # included but marked — scroll is meaningful

    # The model can now READ the page.
    assert "$299" in obs["text_excerpt"]
    assert "Product page" in obs["headings"]
    page.close()


@pytest.mark.skipif(find_chromium() is None, reason="no chromium available")
def test_cap_no_longer_eats_the_real_cta(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.set_content(NAV_HEAVY)
    obs = serialize_page(page)
    assert any("real CTA" in e["text"] for e in obs["elements"]), "saliency ranking beats DOM order"
    # Actuation attribute is set for re-finding elements.
    cta = next(e for e in obs["elements"] if "real CTA" in e["text"])
    assert page.query_selector(f'[data-us-idx="{cta["index"]}"]') is not None
    page.close()
