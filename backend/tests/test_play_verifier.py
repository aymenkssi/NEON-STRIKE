import asyncio

import httpx
import pytest

import play_verifier
from play_verifier import PlayVerifier


def run_with_response(monkeypatch, status, body=None):
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("Authorization")
        return httpx.Response(status, json=body or {})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(play_verifier.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    v = PlayVerifier("com.aymenkssi.neonstrike", "/nonexistent.json")

    async def fake_token():
        return "ya29.test"

    monkeypatch.setattr(v, "_access_token", fake_token)
    return asyncio.run(v.verify_product("coins_500", "tok")), seen


def test_purchased(monkeypatch):
    res, seen = run_with_response(monkeypatch, 200, {"purchaseState": 0, "orderId": "GPA.9", "purchaseType": 0, "consumptionState": 1})
    assert (res.state, res.order_id, res.is_test, res.consumed) == ("purchased", "GPA.9", True, True)
    assert seen["url"].endswith("/applications/com.aymenkssi.neonstrike/purchases/products/coins_500/tokens/tok")
    assert seen["auth"] == "Bearer ya29.test"


@pytest.mark.parametrize("state,expected", [(1, "cancelled"), (2, "pending"), (7, "invalid")])
def test_states(monkeypatch, state, expected):
    res, _ = run_with_response(monkeypatch, 200, {"purchaseState": state})
    assert res.state == expected and res.is_test is False


@pytest.mark.parametrize("status", [400, 404, 410])
def test_unknown_token(monkeypatch, status):
    res, _ = run_with_response(monkeypatch, status)
    assert res.state == "invalid"


def test_server_error_raises(monkeypatch):
    with pytest.raises(httpx.HTTPStatusError):
        run_with_response(monkeypatch, 503)


def test_not_configured_without_file():
    assert PlayVerifier("x", None).configured is False
    assert PlayVerifier("x", "/nonexistent.json").configured is False
