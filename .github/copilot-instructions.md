# Copilot Instructions for Noted

## Build, test, and lint commands

Run backend commands from `backend/`, frontend commands from `frontend/`, and Docker commands from the repository root.

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env` before local development.

| Area | Commands |
|---|---|
| Infrastructure | `docker compose up -d postgres redis` |
| Backend setup/dev | `python -m venv venv && pip install -r requirements-dev.txt`, `alembic upgrade head`, `uvicorn app.main:app --reload --port 8000`, `arq app.tasks.worker.WorkerSettings` |
| Backend test/lint/type-check | `pytest -v --cov=app --cov-report=term-missing`, `pytest tests\test_notes.py::test_name`, `ruff check .`, `mypy app/` |
| Frontend build/lint | `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm format` |
| Frontend tests | `pnpm test -- --run`, `pnpm test -- --run src\path\to\file.test.tsx`, `pnpm test -- --run -t "test name"`, `pnpm test:e2e`, `pnpm test:e2e -- e2e\collaboration-flow.spec.ts`, `pnpm test:e2e -- -g "collaboration-flow"` |

Use `pnpm test -- --run` for one-shot Vitest execution in CLI/CI contexts; plain `pnpm test` starts Vitest in watch mode.

`pnpm test:e2e` is an end-to-end environment bootstrap, not just a browser runner: `frontend/playwright.config.ts` starts Docker-backed Postgres/Redis, runs backend migrations from `backend/`, launches `uvicorn` plus the ARQ worker from `backend\venv`, and then builds/previews the frontend. It also defaults `AI_PROVIDER=mock` so browser tests do not require real provider credentials.

## High-level architecture

- This is a monorepo with a FastAPI backend in `backend/` and a React + Vite SPA in `frontend/`.
- `backend/app/main.py` is the backend composition root: it configures structured logging, CORS, rate limiting, error handlers, Redis-backed lifespan startup/shutdown, mounts REST routers under `settings.API_V1_PREFIX`, and mounts the websocket router.
- Backend request flow is **Router -> Service -> Model/DB**. Shared DB/auth/RBAC dependencies live in `backend/app/dependencies.py`.
- The core product hierarchy is **Workspace -> Notebook -> Note**. Most authorization and resource lookups resolve through that chain, so workspace, notebook, and note access rules are tightly coupled.
- Real-time collaboration spans both apps: `backend/app/websocket/manager.py` keeps `note_id -> user_id -> WebSocket` rooms and fans out events across instances through Redis pub/sub; `frontend/src/hooks/useWebSocket.ts` feeds websocket state into Zustand editor/presence stores; `frontend/src/components/editor/collaboration.ts` converts TipTap documents into block-level deltas for the backend's merge logic.
- Quiz generation is asynchronous: the API creates quiz records, the ARQ worker in `backend/app/tasks/worker.py` runs `generate_quiz_task`, and `backend/app/services/ai_service.py` chooses the configured provider (`openai`, `gemini`, `groq`, or `mock`) while normalizing all responses to the same persisted question shape.
- Search is PostgreSQL full-text search over `notes.search_vector`, implemented in `backend/app/services/search_service.py` with raw SQL ranking/snippet generation and Redis caching.
- On the frontend, `frontend/src/App.tsx` sets up React Query, routing, auth hydration, and the global theme shell. Server state is handled through React Query hooks; client-only UI, auth, editor, presence, and theme state live in Zustand stores or the theme context. All HTTP requests go through `frontend/src/api/client.ts`.

## Key conventions

- `implementation_plan.md` is the repository source of truth. Section 9 tracks live task order/status, and Sections 2-5 contain file-level code/templates worth reusing before inventing new structures.
- Backend database work is async-only: use `AsyncSession`, `await`, and the `get_db` dependency. Do not introduce synchronous SQLAlchemy sessions.
- Keep business logic out of routers. Routers should mainly define HTTP/websocket contracts, dependencies, and service calls.
- Preserve the RBAC pattern: workspace-scoped access should go through the role-check dependencies, and non-members should get `404` rather than leaking resource existence. The same "hide existence from non-members" rule also applies when resolving notebook and note access.
- Use Pydantic v2 patterns (`ConfigDict`, `model_validate`, `model_dump`, `model_validator` when needed), not legacy inner `Config` or `@validator`.
- Frontend auth has two layers: tokens live in `tokenStorage` inside `frontend/src/api/client.ts`, while Zustand stores user/session state. `frontend/src/App.tsx` calls `authStore.hydrate()` on mount so route protection and top-level chrome recover correctly after refresh. When changing auth, keep `tokenStorage`, the Axios refresh interceptor, `ProtectedRoute`, websocket auth, and the auth store/pages aligned.
- Collaboration depends on stable top-level block ids in TipTap content. Keep `attrs.block_id` and `attrs.id` synchronized, and preserve the current delete+insert representation for reordered blocks unless the backend merge strategy changes too.
- Dark mode is global, not page-local: `ThemeProvider`, `useTheme`, and the floating `ThemeToggle` apply the `dark` class on `document.documentElement`, persist the choice in `localStorage` under `noted-theme`, and the current dark palette is zinc/gray-based. Theme work should plug into that path instead of introducing per-page theme state.
- Redis is cross-cutting infrastructure here: it backs rate limiting, refresh-token storage, ARQ jobs, search caching, collaboration presence, and websocket pub/sub. Changes in those areas often span more than one module.
- The backend pytest suite creates tables with `Base.metadata.create_all()` instead of replaying Alembic migrations, and replaces Redis with `FakeAsyncRedis` in `backend/tests/conftest.py`. Any migration that adds raw SQL objects must also be mirrored there (for example, `notes.search_vector` and its GIN index).
- Playwright MCP is already configured repo-locally in `.vscode/mcp.json` using headless `@playwright/mcp`. Prefer keeping that config in the repository so browser automation is available to future Copilot sessions without per-user setup.
- Existing repo guidance in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` expects concise comments/docstrings on non-obvious logic, especially websocket flows, background jobs, auth, caching, and state synchronization.
