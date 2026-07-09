from typing import Any

import pytest
from pydantic import ValidationError

from app.schemas import CalculationRequest, Operation


def test_valid_two_operand_request_parses() -> None:
    request = CalculationRequest.model_validate(
        {"operation": "add", "operands": [1, 2]}
    )
    assert request.operation is Operation.ADD
    assert request.operands == [1.0, 2.0]


def test_valid_sqrt_request_parses() -> None:
    request = CalculationRequest.model_validate({"operation": "sqrt", "operands": [9]})
    assert request.operation is Operation.SQRT
    assert request.operands == [9.0]


def test_unknown_operation_rejected() -> None:
    with pytest.raises(ValidationError):
        CalculationRequest.model_validate({"operation": "modulo", "operands": [1, 2]})


@pytest.mark.parametrize(
    ("operation", "operands"),
    [
        ("sqrt", [4, 9]),
        ("sqrt", []),
        ("add", [1]),
        ("add", [1, 2, 3]),
        ("subtract", [1]),
        ("multiply", [1]),
        ("divide", [1]),
        ("power", [2]),
        ("percentage", [50]),
    ],
)
def test_wrong_arity_rejected(operation: str, operands: list[float]) -> None:
    with pytest.raises(ValidationError):
        CalculationRequest.model_validate(
            {"operation": operation, "operands": operands}
        )


@pytest.mark.parametrize(
    "operands",
    [
        ["abc", 2],
        [1, None],
        [{"value": 1}, 2],
        [[1], 2],
        ["2", 3],
        [True, 1],
        [False, 1],
    ],
)
def test_non_numeric_operands_rejected(operands: list[Any]) -> None:
    with pytest.raises(ValidationError):
        CalculationRequest.model_validate({"operation": "add", "operands": operands})


@pytest.mark.parametrize(
    "operands",
    [
        [float("inf"), 1],
        [float("-inf"), 1],
        [float("nan"), 1],
    ],
)
def test_non_finite_operands_rejected(operands: list[float]) -> None:
    with pytest.raises(ValidationError):
        CalculationRequest.model_validate({"operation": "add", "operands": operands})


@pytest.mark.parametrize(
    "payload",
    [
        '{"operation": "power", "operands": [NaN, 0]}',
        '{"operation": "divide", "operands": [1, Infinity]}',
        '{"operation": "add", "operands": [-Infinity, 1]}',
        '{"operation": "add", "operands": [1e400, 1]}',
    ],
)
def test_non_finite_json_literals_rejected(payload: str) -> None:
    with pytest.raises(ValidationError):
        CalculationRequest.model_validate_json(payload)


def test_missing_fields_rejected() -> None:
    with pytest.raises(ValidationError):
        CalculationRequest.model_validate({})
