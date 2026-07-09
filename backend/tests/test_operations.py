from collections.abc import Callable

import pytest

from app.core import operations
from app.core.operations import (
    DivisionByZeroError,
    InvalidPowerError,
    NegativeSqrtError,
    ResultOverflowError,
)


@pytest.mark.parametrize(
    ("func", "args", "expected"),
    [
        (operations.add, (2, 3), 5),
        (operations.add, (-1.5, 0.5), -1.0),
        (operations.subtract, (10, 4), 6),
        (operations.subtract, (3, 5), -2),
        (operations.multiply, (6, 7), 42),
        (operations.multiply, (-2, 0.5), -1.0),
        (operations.divide, (9, 3), 3),
        (operations.divide, (1, 4), 0.25),
        (operations.power, (2, 10), 1024),
        (operations.power, (9, 0.5), 3),
        (operations.sqrt, (16,), 4),
        (operations.sqrt, (0,), 0),
        (operations.percentage, (50, 200), 100),
        (operations.percentage, (12.5, 80), 10.0),
    ],
)
def test_happy_paths(
    func: Callable[..., float], args: tuple[float, ...], expected: float
) -> None:
    assert func(*args) == pytest.approx(expected)


def test_divide_by_zero_raises() -> None:
    with pytest.raises(DivisionByZeroError):
        operations.divide(1, 0)


def test_sqrt_of_negative_raises() -> None:
    with pytest.raises(NegativeSqrtError):
        operations.sqrt(-1)


def test_power_overflow_raises_not_inf() -> None:
    with pytest.raises(ResultOverflowError):
        operations.power(10, 10000)


def test_addition_overflow_to_inf_raises() -> None:
    with pytest.raises(ResultOverflowError):
        operations.add(1e308, 1e308)


def test_multiplication_overflow_to_inf_raises() -> None:
    with pytest.raises(ResultOverflowError):
        operations.multiply(1e308, 1e308)


def test_negative_base_fractional_exponent_raises() -> None:
    with pytest.raises(InvalidPowerError, match="negative base"):
        operations.power(-8, 0.5)


def test_zero_base_negative_exponent_raises_division_by_zero() -> None:
    with pytest.raises(DivisionByZeroError, match="negative exponent"):
        operations.power(0, -1)
