# Copilot Instructions for Noted

## Build, test, and lint commands

Run backend commands from `backend/`, frontend commands from `frontend/`, and Docker commands from the repository root.

| Area | Commands |
|---|---|
| Infrastructure | `docker compose up -d postgres redis` |
| Backend setup/dev | `python -m venv venv && pip install -r requirements-dev.txt`, `alembic upgrade head`, `uvicorn app.main:app --reload --port 8000`, `arq app.tasks.worker.WorkerSettings` |
| Backend test/lint/type-check | `pytest -v --cov=app --cov-report=term-missing`, `pytest tests/test_notes.py::test_name`, `ruff check .`, `mypy app/` |
| Frontend build/lint | `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm format` |
| Frontend tests | `pnpm test`, `pnpm test -- src/path/to/file.test.tsx`, `pnpm test -- -t "test name"`, `pnpm test:e2e`, `pnpm test:e2e -- e2e/collaboration-flow.spec.ts`, `pnpm test:e2e -- -g "collaboration-flow"` |

`pnpm test:e2e` uses `frontend/playwright.config.ts` to start Docker-backed Postgres/Redis, run backend migrations, launch FastAPI from `backend/venv`, and then build/preview the frontend.

## High-level architecture

- This is a monorepo with a FastAPI backend in `backend/` and a React + Vite SPA in `frontend/`.
- `backend/app/main.py` creates the FastAPI app, registers CORS/rate-limit/error middleware, mounts REST routers under `settings.API_V1_PREFIX`, and mounts the websocket router.
- Backend request flow is **Router -> Service -> Model/DB**. Shared DB/auth/RBAC dependencies live in `backend/app/dependencies.py`.
- The core resource hierarchy is **Workspace -> Notebook -> Note**. Role checks are resolved through dependency helpers such as `require_workspace_role`, `require_min_role`, `require_min_notebook_role`, and `require_min_note_role`.
- Real-time collaboration spans both apps: `backend/app/websocket/manager.py` keeps `note_id -> user_id -> WebSocket` rooms and fans out events across instances through Redis pub/sub; `frontend/src/hooks/useWebSocket.ts` feeds websocket state into Zustand editor/presence stores; `frontend/src/components/editor/collaboration.ts` turns TipTap documents into block-level deltas with stable block ids for the backend merge logic.
- Quiz generation is asynchronous: the API creates quiz rows, the ARQ worker in `backend/app/tasks/worker.py` runs `generate_quiz_task`, and `backend/app/services/ai_service.py` selects the OpenAI, Gemini, or Groq provider and normalizes the returned question shape before persistence.
- Search is PostgreSQL full-text search over `notes.search_vector`, wrapped by `backend/app/services/search_service.py` and cached in Redis.
- On the frontend, `frontend/src/App.tsx` sets up React Query and routing. Server state is handled through React Query hooks; client-only UI, auth, editor, and presence state live in Zustand stores. All HTTP requests go through `frontend/src/api/client.ts`.

## Key conventions

- `implementation_plan.md` is the repository source of truth. Section 9 tracks live task order/status, and Sections 2-5 contain file-level code/templates worth reusing before inventing new structures.
- Backend database work is async-only: use `AsyncSession`, `await`, and the `get_db` dependency. Do not introduce synchronous SQLAlchemy sessions.
- Keep business logic out of routers. Routers should mainly define HTTP/websocket contracts, dependencies, and service calls.
- Preserve the RBAC pattern: workspace-scoped access should go through the role-check dependencies, and non-members should get `404` rather than leaking resource existence.
- Use Pydantic v2 patterns (`ConfigDict`, `model_validate`, `model_dump`, `model_validator` when needed), not legacy inner `Config` or `@validator`.
- Frontend auth has two layers: tokens live in `tokenStorage` inside `frontend/src/api/client.ts`, while Zustand stores user/session state. When changing auth, keep `tokenStorage`, the Axios refresh interceptor, `ProtectedRoute`, websocket auth, and the auth store/pages aligned.
- Collaboration depends on stable top-level block ids in TipTap content. Keep `attrs.block_id` and `attrs.id` synchronized, and preserve the current delete+insert representation for reordered blocks unless the backend merge strategy changes too.
- The backend pytest suite creates tables with `Base.metadata.create_all()` instead of replaying Alembic migrations. Any migration that adds raw SQL objects must also be mirrored in `backend/tests/conftest.py` (for example, `notes.search_vector` and its GIN index).
- Workspace-level Playwright MCP is configured in `.vscode/mcp.json` for VS Code/Copilot sessions. Keep that file repo-local and update it if browser automation needs change.
- Existing repo guidance in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` expects concise comments/docstrings on non-obvious logic, especially websocket flows, background jobs, auth, caching, and state synchronization.
