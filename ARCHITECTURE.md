# Salon Management Pro — Architecture

Monorepo: `backend/` (FastAPI), `frontend/` (React + TS + Vite + Tailwind), `public-site/` (Vite landing).

## Frontend (`frontend/src`)

- **Import alias `@/` only.** Relative parent imports (`../*`) are forbidden by
  eslint (`no-restricted-imports`). Verified: zero occurrences.
- **`lib/`** — framework-agnostic utilities, split by domain with barrel files:
  `core/ format/ theme/ access/ domain/ site/ export/ money/ media/ print/`.
- **`types/`** — canonical domain types (`employee payroll catalog expenses
  cashbox website attendance reports common`) + `types/index.ts` barrel.
- **`components/shared/`** — merged shared UI (formerly `common/`). **`components/ui/`** — typed primitives with barrel.
- **`features/<domain>/`** — feature modules, each with `hooks/ utils/
  components/` + `index.ts` barrel. Established: `bookings inventory hr
  attendance`. Pages consume features; features never import from pages.
- **Pages are thin orchestration**: `Bookings.tsx` 2418→747, `HRManagement.tsx`
  2355→770, `AttendanceManagement.tsx` 1868→567 lines via extraction.
- **Rules**: types-only changes where noted; no JSX/className, Arabic-string,
  or API URL/payload changes during refactors. Verify per change:
  `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.

## Backend (`backend/`)

- FastAPI + SQLAlchemy 2.0. `SessionLocal` uses **`autoflush=False`** — any
  code that queries right after `db.add()` MUST `db.flush()` first (a missing
  flush once caused silent stock loss on invoice creation).
- **Money aggregates exclude drafts**: every revenue/count query over
  `Invoice` filters `is_draft == False` (close, daily-summary, total-balance,
  owner/manager/cashier summaries, reports overview).
- **Datetime comparisons**: SQLite stores server-side `CURRENT_TIMESTAMP`
  without microseconds while bound datetimes carry `.000000`, so same-second
  rows compare as older. Time-window filters use a documented 1s tolerance.
- **Tests** (`backend/tests/`, pytest + sqlite, 88 green): shared `helpers.py`
  (`make_user/login/auth_headers`) + per-endpoint files. Fixtures in
  `backend/conftest.py` (fresh schema per test). RBAC pinned for
  payroll/reports (cashier → 403). Run: `pytest tests/ -q` from `backend/`.
- Modernized: Pydantic v2 `@field_validator`, FastAPI `lifespan` events.

## CI (`.github/workflows/ci.yml`)

- `backend-tests`: pip install + `pytest -v`.
- `frontend`: `lint` + `typecheck` + `test:run` + `build`.
- `build` (main only): `docker compose build` + `config`.

## Verification cheat-sheet

```bash
cd frontend && npx tsc --noEmit && npm run lint && npm run test:run && npm run build
cd ../backend && .\.venv\Scripts\python.exe -m pytest tests/ -q
cd ../public-site && npm run build
```
