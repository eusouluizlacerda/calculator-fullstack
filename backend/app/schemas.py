import math
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator


class Operation(str, Enum):
    ADD = "add"
    SUBTRACT = "subtract"
    MULTIPLY = "multiply"
    DIVIDE = "divide"
    POWER = "power"
    SQRT = "sqrt"
    PERCENTAGE = "percentage"


OPERATION_ARITY: dict[Operation, int] = {
    Operation.ADD: 2,
    Operation.SUBTRACT: 2,
    Operation.MULTIPLY: 2,
    Operation.DIVIDE: 2,
    Operation.POWER: 2,
    Operation.SQRT: 1,
    Operation.PERCENTAGE: 2,
}


class CalculationRequest(BaseModel):
    operation: Operation
    operands: list[Annotated[float, Field(strict=True)]]

    @field_validator("operands")
    @classmethod
    def check_finite(cls, value: list[float]) -> list[float]:
        if not all(math.isfinite(operand) for operand in value):
            raise ValueError("operands must be finite numbers")
        return value

    @model_validator(mode="after")
    def check_arity(self) -> "CalculationRequest":
        expected = OPERATION_ARITY[self.operation]
        actual = len(self.operands)
        if actual != expected:
            raise ValueError(
                f"operation '{self.operation.value}' requires exactly "
                f"{expected} operand(s), got {actual}"
            )
        return self


class CalculationResponse(BaseModel):
    result: float
    operation: Operation
    operands: list[float]


class ErrorResponse(BaseModel):
    error: str
    detail: str
