# Calculator frontend

React + TypeScript + Vite UI for the calculator API. Supports add, subtract, multiply, divide, power, square root, and percentage.

## Configuration

The API base URL comes from `VITE_API_URL`. `.env.development` (committed) points at the local backend:

```
VITE_API_URL=http://localhost:8000
```

Set `VITE_API_URL` at build time for other environments.

## Commands

```bash
npm install
npm run dev        # dev server on http://localhost:5173 (backend must run on :8000)
npm run build      # typecheck + production build
npm run test       # vitest, single run
npm run coverage   # vitest with coverage report
npm run lint       # oxlint
```
