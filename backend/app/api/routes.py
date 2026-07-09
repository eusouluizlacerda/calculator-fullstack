from collections.abc import Callable

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core import operations
from app.core.operations import CalculationError
from app.schemas import (
    CalculationRequest,
    CalculationResponse,
    ErrorResponse,
    Operation,
)

router = APIRouter(prefix="/api/v1", tags=["calculator"])

OPERATION_HANDLERS: dict[Operation, Callable[..., float]] = {
    Operation.ADD: operations.add,
    Operation.SUBTRACT: operations.subtract,
    Operation.MULTIPLY: operations.multiply,
    Operation.DIVIDE: operations.divide,
    Operation.POWER: operations.power,
    Operation.SQRT: operations.sqrt,
    Operation.PERCENTAGE: operations.percentage,
}


@router.post(
    "/calculate",
    response_model=CalculationResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def calculate(request: CalculationRequest) -> CalculationResponse | JSONResponse:
    handler = OPERATION_HANDLERS[request.operation]
    try:
        result = handler(*request.operands)
    except CalculationError as exc:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(error=exc.code, detail=exc.detail).model_dump(),
        )
    return CalculationResponse(
        result=result,
        operation=request.operation,
        operands=request.operands,
    )
