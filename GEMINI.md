# GEMINI.md

## Project Overview
**Noted** is a collaborative study notes platform featuring real-time editing and AI-powered quiz generation. It bridges the gap between note-taking and active recall by allowing users to generate quizzes (multiple-choice, fill-in-the-blank, flashcards) directly from their notes using the Anthropic Claude API.

### Key Technologies
- **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2.0 (Async), PostgreSQL 16, Redis 7, Arq (Background Tasks).
- **Frontend:** TypeScript, React 18, Vite 5, Tailwind CSS 3, Zustand (State), React Query (Data Fetching), TipTap (Editor).
- **AI Integration:** Anthropic Claude API for intelligent quiz generation.
- **Infrastructure:** Docker, Docker Compose, Kubernetes (k8s manifests provided).

---

## Building and Running

### Prerequisites
- Python 3.12+ & Node.js 20+ with `pnpm`.
- Docker & Docker Compose.
- Anthropic API Key (for AI features).

### Local Development (Manual)
1. **Infrastructure:**
   ```bash
   docker compose up -d postgres redis
   ```
2. **Backend:**
   ```bash
   cd backend
   # Create venv and install dependencies
   python -m venv venv
   source venv/bin/activate  # or .\venv\Scripts\activate on Windows
   pip install -r requirements.txt
   # Run migrations
   alembic upgrade head
   # Start server
   uvicorn app.main:app --reload
   ```
3. **Background Worker (Arq):**
   ```bash
   cd backend
   arq app.tasks.worker.WorkerSettings
   ```
4. **Frontend:**
   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

### Docker Development
You can run the entire stack using Docker Compose:
```bash
docker compose up --build
```

---

## Testing

### Backend (Pytest)
```bash
cd backend
pytest -v
```

### Frontend (Vitest & Playwright)
- **Unit/Integration:** `cd frontend && pnpm test`
- **E2E:** `cd frontend && pnpm test:e2e`

---

## Development Conventions

### Backend
- **Async First:** Use `async/await` for database operations and external API calls.
- **Dependency Injection:** Use FastAPI's `Depends` for services, database sessions, and auth.
- **Schemas:** Use Pydantic V2 for request/response validation.
- **Migrations:** All database schema changes must be handled via Alembic migrations (`alembic revision --autogenerate`).

### Frontend
- **Type Safety:** Strict TypeScript usage. Define interfaces/types in `src/types/`.
- **State Management:** Use Zustand for UI state and React Query for server-side state.
- **Styling:** Use Tailwind CSS utility classes; avoid custom CSS where possible.
- **Components:** Functional components with hooks. Prefer small, reusable components in `src/components/ui/`.

### AI Generation
- Quiz generation logic is encapsulated in `backend/app/services/ai_service.py` and processed asynchronously via Arq tasks in `backend/app/tasks/quiz_tasks.py`.

## Environment Variables

### Backend (backend/.env)
- `DATABASE_URL`: PostgreSQL connection string (asyncpg).
- `REDIS_URL`: Redis connection string.
- `ANTHROPIC_API_KEY`: Required for AI quiz generation.
- `JWT_SECRET_KEY`: Used for token signing.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: For Google OAuth.

### Frontend (frontend/.env)
- `VITE_API_URL`: Base URL for the backend API (default: `http://localhost:8000/api/v1`).
- `VITE_GOOGLE_CLIENT_ID`: Required for Google login button.

---

## Project Structure Highlights
- `backend/app/routers/`: API endpoints organized by resource.
- `backend/app/models/`: SQLAlchemy models.
- `backend/app/services/`: Business logic layer.
- `frontend/src/api/`: Axios client and API wrappers.
- `frontend/src/components/editor/`: Real-time collaboration editor logic.
- `k8s/`: Deployment configurations for Kubernetes.
