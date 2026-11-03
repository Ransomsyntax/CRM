"""Exercise the actual JavaScript matcher and HTTP error normalizer."""
import shutil
import subprocess
from pathlib import Path

import pytest


def test_numeric_profile_routes_and_structured_access_errors():
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node is required for JavaScript unit checks")
    result = subprocess.run([node, "--input-type=module", "-"], cwd=Path(__file__).resolve().parents[1],
        input=r"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync('static/js/app.js', 'utf8');
const block = source.slice(source.indexOf('// Security profiles are configuration editors'));
const matcher = eval(block.match(/&& (\/.*?\/[a-z]*)\.test\(parts\[1\]\)/)[1]);
assert.equal(matcher.test('191'), true);
assert.equal(matcher.test('Administrator'), false);
const http = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync('static/js/core/http.js', 'utf8')));
const usability = await import('./static/js/features/usability.js');
globalThis.fetch = async () => ({ok:false,status:403,text:async()=>JSON.stringify({detail:{code:'SETUP_PERMISSION_DENIED',capability:'manage_profiles'}})});
await assert.rejects(http.requestJson('/api/test'), error => {
    assert.equal(error.status, 403);
    assert.equal(error.message.includes('[object Object]'), false);
    assert.equal(usability.viewError(error).title, 'Access restricted');
    return true;
});
""", text=True, capture_output=True)
    assert result.returncode == 0, result.stderr

