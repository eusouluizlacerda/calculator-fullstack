# Calculator Fullstack

A full-stack calculator: **FastAPI** backend exposing a calculation REST API and a **React + TypeScript** frontend consuming it. Supports basic operations (add, subtract, multiply, divide) and advanced ones (power, square root, percentage), with strict input validation and explicit error handling on both layers.

```
calculator-fullstack/
├── backend/    # FastAPI + Pydantic v2, uv-managed
├── frontend/   # React 19 + TypeScript (strict) + Vite
└── docker-compose.yml
```

## Stack & rationale

| Choice | Why |
|---|---|
| **FastAPI** | Async-ready, Pydantic-native validation, free OpenAPI docs at `/docs`. |
| **Pydantic v2** | Request validation (operation enum, arity, finite numbers) declared once in schemas, enforced before any logic runs. |
| **uv + pyproject.toml** | Fast, lockfile-based (`uv.lock`), reproducible installs in dev and Docker. |
| **Vite + React + TS (strict)** | Instant dev server, `tsc -b` type-checks app *and* test code on every build; `strict: true`, zero `any`. |
| **Vitest + React Testing Library** | Native Vite integration; component tests assert user-visible behavior, fetch is mocked. |
| **nginx (unprivileged)** | Serves the built SPA and proxies `/api/` to the backend, so the Docker deployment needs no CORS and no baked-in API URL. |

## Architecture

**Backend — three layers:**

- `app/core/operations.py` — pure functions, one per operation. Domain errors are typed exceptions (`DivisionByZeroError`, `NegativeSqrtError`, `ResultOverflowError`, `InvalidPowerError`); every result passes a `math.isfinite` guard so `inf`/`NaN` can never reach a response.
- `app/schemas.py` — Pydantic models. Operands are strict floats (booleans and numeric strings rejected), must be finite, and arity is validated per operation (`sqrt` takes 1 operand, everything else 2).
- `app/api/routes.py` — the route maps domain exceptions to HTTP 400 with a stable `{"error", "detail"}` body. Validation failures return 422 with the same shape (FastAPI's default 422 body is overridden).

**Frontend:**

- `src/services/calculatorApi.ts` — the only module that talks to the network. Typed request/response, runtime shape-check of the 200 body, `ApiError` (carries the backend's `error`/`detail`) vs `NetworkError` (fetch failure) as distinct failure modes.
- `src/components/Calculator.tsx` — presentation only: operand inputs (second one removed for `sqrt`), operation select, inline client-side validation (required, finite numbers), API errors rendered in a `role="alert"` region, submit disabled while a request is in flight.
- Plain CSS, single-column card, usable at 360 px width.

## API

Single endpoint (chosen over per-operation endpoints so the operation set can grow without route churn, and validation lives in one schema):

```
POST /api/v1/calculate
{ "operation": "add" | "subtract" | "multiply" | "divide" | "power" | "sqrt" | "percentage",
  "operands": [number, ...] }
```

Interactive docs: **http://localhost:8000/docs** (Swagger UI).

### Examples

Success:

```bash
curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation": "add", "operands": [2, 3]}'
# {"result": 5.0, "operation": "add", "operands": [2.0, 3.0]}

curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation": "sqrt", "operands": [9]}'
# {"result": 3.0, "operation": "sqrt", "operands": [9.0]}

curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation": "percentage", "operands": [10, 50]}'
# {"result": 5.0, "operation": "percentage", "operands": [10.0, 50.0]}
# percentage(a, b) = a% of b
```

Domain errors → **400**:

```bash
curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation": "divide", "operands": [5, 0]}'
# {"error": "division_by_zero", "detail": "cannot divide by zero"}

curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation": "sqrt", "operands": [-4]}'
# {"error": "negative_sqrt", "detail": "cannot take the square root of a negative number"}

curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation": "power", "operands": [10, 10000]}'
# {"error": "result_overflow", "detail": "result is too large to represent"}
```

Validation errors → **422** (same body shape):

```bash
curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation": "modulo", "operands": [5, 2]}'
# {"error": "validation_error", "detail": "body.operation: Input should be 'add', 'subtract', ..."}

curl -s -X POST http://localhost:8000/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation": "sqrt", "operands": [4, 2]}'
# {"error": "validation_error", "detail": "body: Value error, operation 'sqrt' requires exactly 1 operand(s), got 2"}
```

## Running locally

### Backend

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync                                  # creates .venv, installs deps + dev deps
uv run uvicorn app.main:app --reload     # serves on http://localhost:8000
```

CORS allows `http://localhost:5173` by default; override with a comma-separated `CORS_ALLOW_ORIGINS` env var.

### Frontend

Requires Node 20+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

`frontend/.env.development` (committed) points the dev app at `http://localhost:8000` via `VITE_API_URL`. Run both servers for the full flow.

## Running with Docker Compose

```bash
docker-compose up --build
# frontend: http://localhost         (nginx, port 80)
# backend:  http://localhost:8000    (direct; /docs available)
```

The frontend image is built **without** `VITE_API_URL`, so the app calls a relative `/api/v1/calculate` and nginx proxies `/api/` to the backend container — no CORS involved. Compose waits for the backend healthcheck before starting the frontend. Works with legacy `docker-compose` 1.29 (compose file 3.8) as well as the v2 plugin.

## Tests & coverage

Backend (76 tests — operations, schema validation, API contract):

```bash
cd backend
uv run pytest --cov=app --cov-report=term-missing
# 99% total, 100% on app/core (logic layer)
```

Frontend (16 tests — service layer with mocked fetch, component behavior):

```bash
cd frontend
npm test            # vitest run
npm run coverage    # vitest run --coverage (v8)
```

## Design decisions & trade-offs

- **Single `POST /api/v1/calculate` endpoint** instead of one route per operation: validation and error mapping live in one place; adding an operation touches the enum, one pure function, and an arity entry.
- **`percentage(a, b)` = a% of b** — the binary form fits the uniform `operands` array; documented in the UI labels.
- **Strict operand validation**: non-finite JSON literals (`NaN`, `Infinity`, `1e400`), booleans, and numeric strings are all rejected with 422 rather than silently coerced — otherwise Pydantic would serialize non-finite floats as `null` in a 200 response.
- **`power(0, -1)` maps to `division_by_zero`** (it is 1/0), distinct from `invalid_power` (negative base with fractional exponent, no real result).
- **Errors split 400 vs 422**: 400 = valid request, mathematically impossible (domain); 422 = malformed request (validation). Both share the `{"error", "detail"}` body so clients parse one shape.
- **Frontend trusts nothing**: 200 bodies are shape-checked at runtime; API errors and network failures are distinct types with distinct messages; results are formatted via `toPrecision(12)` so `0.1 + 0.2` displays as `0.3`.
- **nginx proxy re-resolves the backend** (`resolver 127.0.0.11` + variable `proxy_pass`), so restarting only the backend container doesn't leave the proxy pointing at a stale IP (would otherwise 502 until the frontend restarts).
- **Kept out of scope** on purpose: no database, no auth, no state-management library (`useState` suffices), no calculation history.
