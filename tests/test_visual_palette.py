"""Palette contrast guards for shared text and stage states, independent of Chromium."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def contrast(foreground, background):
    def luminance(value):
        channels = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
        linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels]
        return sum(c * weight for c, weight in zip(linear, (.2126, .7152, .0722)))
    a, b = sorted((luminance(foreground), luminance(background)))
    return (b + .05) / (a + .05)


def test_secondary_text_palette_is_readable_on_shared_surfaces():
    css = (ROOT / 'static/css/visual-refinement.css').read_text()
    light, dark = css.split('html[data-crm-theme="dark"]', 1)
    for palette, backgrounds in ((light, ('#ffffff', '#f4f7fb')), (dark.split('}', 1)[0], ('#192331', '#243247'))):
        colors = re.findall(r'--text-(?:faint|soft):\s*(#[0-9a-f]{6})', palette)
        assert colors
        for color in colors:
            for background in backgrounds:
                assert contrast(color, background) >= 4.5, (color, background)


def test_pipeline_uses_the_actual_theme_attribute_and_readable_states():
    css = (ROOT / 'static/css/modules.css').read_text()
    match = re.search(r'html\[data-crm-theme="dark"\] \.crm-deal-pipeline[^{}]*\{([^}]+)\}', css)
    assert match, 'Pipeline must respond to the application theme controller'
    for name in ('done', 'next', 'active'):
        bg = re.search(r'--pipeline-' + name + r'-bg:(#[0-9a-f]+)', match[1])[1]
        fg = re.search(r'--pipeline-' + name + r'-fg:(#[0-9a-f]+)', match[1])[1]
        if len(fg) == 4:
            fg = '#' + ''.join(c * 2 for c in fg[1:])
        assert contrast(fg, bg) >= 4.5, name


def test_company_light_surface_uses_theme_tokens_instead_of_dark_fallback():
    css = (ROOT / 'static/css/company-settings-tabs.css').read_text()
    assert 'background:var(--surface,#ffffff)' in css
    assert 'var(--surface-2,var(--surface-soft,#f5f6fa))' in css


def test_document_and_pdf_controls_use_paired_theme_tokens():
    quote = (ROOT / 'static/js/features/quote-layout.js').read_text().split('const css=', 1)[1].split('export function quoteDetail', 1)[0]
    assert 'background:#fff' not in quote
    assert 'color:#162747' not in quote
    assert 'background:var(--surface)' in quote
    chooser = (ROOT / 'static/js/features/pdf-template-selector.js').read_text().split('function launchPdfChooser', 1)[0]
    assert 'background:white' not in chooser
    assert 'color:var(--text,#172747)' in chooser


def test_company_fallback_pairs_are_readable_without_alias_stylesheet():
    css = (ROOT / 'static/css/company-settings-tabs.css').read_text()
    assert contrast('#171a26', '#ffffff') >= 4.5
    assert 'color:var(--text,#171a26)' in css
    assert '#191c22' not in css
    assert '#e8edf5' not in css
