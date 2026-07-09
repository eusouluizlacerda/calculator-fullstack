import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(title="Calculator API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    if errors:
        detail = "; ".join(
            f"{'.'.join(str(part) for part in err.get('loc', ()))}: {err.get('msg', 'invalid')}"
            for err in errors
        )
    else:
        detail = "invalid request"
    return JSONResponse(
        status_code=422,
        content={"error": "validation_error", "detail": detail},
    )


app.include_router(router)
