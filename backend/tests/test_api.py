from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app, cors_origins

client = TestClient(app)

URL = "/api/v1/calculate"


@pytest.mark.parametrize(
    ("operation", "operands", "expected"),
    [
        ("add", [2, 3], 5.0),
        ("subtract", [10, 4], 6.0),
        ("multiply", [6, 7], 42.0),
        ("divide", [9, 3], 3.0),
        ("power", [2, 10], 1024.0),
        ("sqrt", [16], 4.0),
        ("percentage", [50, 200], 100.0),
    ],
)
def test_happy_path_returns_200(
    operation: str, operands: list[float], expected: float
) -> None:
    response = client.post(URL, json={"operation": operation, "operands": operands})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == pytest.approx(expected)
    assert body["operation"] == operation
    assert body["operands"] == operands
    assert set(body) == {"result", "operation", "operands"}


@pytest.mark.parametrize(
    ("operands", "expected_error", "operation"),
    [
        ([1, 0], "division_by_zero", "divide"),
        ([0, -1], "division_by_zero", "power"),
        ([-1], "negative_sqrt", "sqrt"),
        ([10, 10000], "result_overflow", "power"),
    ],
)
def test_domain_errors_return_400(
    operands: list[float], expected_error: str, operation: str
) -> None:
    response = client.post(URL, json={"operation": operation, "operands": operands})
    assert response.status_code == 400
    body = response.json()
    assert set(body) == {"error", "detail"}
    assert body["error"] == expected_error
    assert isinstance(body["detail"], str) and body["detail"]


@pytest.mark.parametrize(
    "payload",
    [
        {"operation": "modulo", "operands": [1, 2]},
        {"operation": "sqrt", "operands": [4, 9]},
        {"operation": "add", "operands": [1]},
        {"operation": "add", "operands": ["abc", 2]},
        {"operation": "add", "operands": ["2", 3]},
        {"operation": "add", "operands": [True, 1]},
        {"operation": "add"},
        {"operands": [1, 2]},
        {},
    ],
)
def test_validation_errors_return_422_with_contract_shape(
    payload: dict[str, Any],
) -> None:
    response = client.post(URL, json=payload)
    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"error", "detail"}
    assert body["error"] == "validation_error"
    assert isinstance(body["detail"], str) and body["detail"]


@pytest.mark.parametrize(
    "payload",
    [
        '{"operation": "power", "operands": [NaN, 0]}',
        '{"operation": "divide", "operands": [1, Infinity]}',
        '{"operation": "add", "operands": [-Infinity, 1]}',
        '{"operation": "add", "operands": [1e400, 1]}',
    ],
)
def test_non_finite_operands_return_422(payload: str) -> None:
    response = client.post(
        URL, content=payload, headers={"content-type": "application/json"}
    )
    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"error", "detail"}
    assert body["error"] == "validation_error"
    assert "finite" in body["detail"]


def test_cors_allows_configured_origin() -> None:
    response = client.post(
        URL,
        json={"operation": "add", "operands": [1, 2]},
        headers={"origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"] == "http://localhost:5173"
    )


def test_cors_rejects_unknown_origin_preflight() -> None:
    response = client.options(
        URL,
        headers={
            "origin": "http://evil.example.com",
            "access-control-request-method": "POST",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_defaults_to_dev_ports() -> None:
    assert cors_origins() == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_cors_origins_reads_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "CORS_ALLOW_ORIGINS", "https://app.example.com, https://staging.example.com"
    )
    assert cors_origins() == [
        "https://app.example.com",
        "https://staging.example.com",
    ]
