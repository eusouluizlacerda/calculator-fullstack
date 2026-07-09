import math


class CalculationError(Exception):
    code: str = "calculation_error"

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class DivisionByZeroError(CalculationError):
    code = "division_by_zero"


class NegativeSqrtError(CalculationError):
    code = "negative_sqrt"


class ResultOverflowError(CalculationError):
    code = "result_overflow"


class InvalidPowerError(CalculationError):
    code = "invalid_power"


def _ensure_finite(value: float) -> float:
    if not math.isfinite(value):
        raise ResultOverflowError("result is not a finite number")
    return value


def add(a: float, b: float) -> float:
    return _ensure_finite(a + b)


def subtract(a: float, b: float) -> float:
    return _ensure_finite(a - b)


def multiply(a: float, b: float) -> float:
    return _ensure_finite(a * b)


def divide(a: float, b: float) -> float:
    if b == 0:
        raise DivisionByZeroError("cannot divide by zero")
    return _ensure_finite(a / b)


def power(a: float, b: float) -> float:
    if a == 0 and b < 0:
        raise DivisionByZeroError("zero cannot be raised to a negative exponent")
    try:
        result = math.pow(a, b)
    except OverflowError as exc:
        raise ResultOverflowError("result is too large to represent") from exc
    except ValueError as exc:
        raise InvalidPowerError(
            "negative base with fractional exponent has no real result"
        ) from exc
    return _ensure_finite(result)


def sqrt(a: float) -> float:
    if a < 0:
        raise NegativeSqrtError("cannot take the square root of a negative number")
    return _ensure_finite(math.sqrt(a))


def percentage(a: float, b: float) -> float:
    return _ensure_finite((a / 100) * b)
