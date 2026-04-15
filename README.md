# Noted

A collaborative study notes platform with AI-powered quiz generation.

## What is Noted?

Noted bridges the gap between note-taking and active recall. Write your study notes, collaborate with classmates in real-time, and let AI generate quizzes from your content — all in one place.

### Core Features

- **📝 Rich Text Notes** — Organize notes in Workspaces → Notebooks → Notes with a TipTap-powered editor
- **👥 Real-Time Collaboration** — Edit notes simultaneously with cursor awareness and presence indicators
- **🤖 AI Quiz Generation** — Select any note and generate multiple-choice, fill-in-the-blank, and flashcard quizzes via Claude
- **📊 Quiz Review Mode** — Interactive quiz interface with scoring and attempt history
- **🔍 Full-Text Search** — Search across all notes in a workspace with ranked results and highlighted snippets
- **🔐 Role-Based Access** — Invite members as Owner, Editor, Commenter, or Viewer
- **🔑 Flexible Auth** — Email/password registration or Google OAuth with JWT token flow

## Tech Stack

| | Technology |
|---|---|
| **Backend** | Python · FastAPI · SQLAlchemy (async) · PostgreSQL · Redis · ARQ |
| **Frontend** | React · TypeScript · Vite · Tailwind CSS · Zustand · React Query · TipTap |
| **AI** | Anthropic Claude API |
| **Deploy** | Docker · k3s · AWS EC2 · GitHub Actions |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+ with pnpm
- Docker & Docker Compose
- PostgreSQL 16 and Redis 7 (or use Docker Compose)

### 1. Clone & Configure

```bash
git clone https://github.com/your-user/noted.git
cd noted
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit both .env files with your credentials
```

### 2. Start Infrastructure

```bash
docker compose up -d postgres redis
```

### 3. Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### 4. ARQ Worker (separate terminal)

```bash
cd backend
.\venv\Scripts\activate
arq app.tasks.worker.WorkerSettings
```

### 5. Frontend (separate terminal)

```bash
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:5173

## Project Structure

```
noted/
├── backend/          # FastAPI application
│   ├── app/          # Source code
│   ├── alembic/      # Database migrations
│   └── tests/        # pytest test suite
├── frontend/         # React SPA
│   ├── src/          # Source code
│   └── public/       # Static assets
├── k8s/              # Kubernetes manifests
└── docker-compose.yml
```

## Running Tests

```bash
# Backend
cd backend && pytest -v

# Frontend unit tests
cd frontend && pnpm test

# Frontend E2E
cd frontend && npx playwright test
```

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for all required configuration.

## License

MIT
