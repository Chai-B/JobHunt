# JobHunt

AI-powered job application automation platform. Scrape jobs, manage applications, auto-apply with AI-generated templates, and track your pipeline — all from a single dashboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Shadcn UI, TypeScript |
| Backend | FastAPI, SQLAlchemy (async), Pydantic v2 |
| Database | PostgreSQL + pgvector |
| Queue | Celery + Redis |
| AI | Google Gemini, sentence-transformers |
| Auth | JWT + Clerk OAuth (optional) |

## Quick Start (Docker)

For detailed instructions on deploying to a live server (VPS or Cloud), see the [Deployment Guide](DEPLOYMENT_GUIDE.md).

```bash
# 1. Clone and configure
git clone https://github.com/YOUR_USERNAME/jobhunt.git
cd jobhunt
cp .env.example .env
# Edit .env with your settings (at minimum, set SECRET_KEY)

# 2. Launch all services
docker compose up -d

# 3. Run database migrations
docker compose exec backend alembic upgrade head

# 4. Open the app
open http://localhost:3000
```

This starts 5 services:
- **PostgreSQL** (pgvector) on port `5433`
- **Redis** on port `6379`
- **Backend API** on port `8000`
- **Celery Worker** for background jobs
- **Frontend** on port `3000`

## Manual Setup (Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL with pgvector extension
- Redis

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.worker.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (async: `postgresql+asyncpg://...`) |
| `SECRET_KEY` | Yes | JWT signing key (change from default!) |
| `CELERY_BROKER_URL` | Yes | Redis URL for Celery broker |
| `CELERY_RESULT_BACKEND` | Yes | Redis URL for Celery results |
| `NEXT_PUBLIC_API_URL` | No | Backend URL (default: `http://localhost:8000`) |
| `CLERK_SECRET_KEY` | No | Clerk Backend API key for OAuth |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | No | Clerk publishable key for OAuth buttons |

> **Note:** Gemini API key is managed per-user via the Settings page in the app.

## Features

### Job Scraping
- One-click scraping from RemoteOK, Hacker News, We Work Remotely, and custom URLs
- Site-specific parsers with fallback generic parser
- Automatic deduplication and contact extraction

### Application Pipeline
- Full state machine: Discovered → Shortlisted → Prepared → Submitted → Responded → Closed
- Resume matching via pgvector cosine similarity
- Bulk auto-apply with Celery background workers

### AI Templates
- Generate email templates with Gemini AI
- Choose purpose (cold outreach, follow-up, networking) and tone
- Templates use `{{placeholders}}` for personalization

### Cold Mailing
- Batch send to scraped contacts using templates + resumes
- SMTP integration via user settings

### Authentication
- Email/password with JWT
- Google and GitHub OAuth via Clerk (optional)

## API Overview

All endpoints are under `/api/v1/`:

| Endpoint | Description |
|----------|-------------|
| `POST /auth/login` | Get JWT token |
| `POST /auth/register` | Create account |
| `POST /auth/oauth-sync` | Sync OAuth user |
| `GET /users/me` | Current user profile |
| `GET /users/metrics` | Dashboard analytics |
| `GET /jobs/` | List all jobs |
| `POST /jobs/ingest/manual` | Add job manually |
| `POST /scraper/run` | Trigger background scraper |
| `GET /resumes/` | List resumes |
| `POST /resumes/upload` | Upload resume (PDF/DOCX) |
| `GET /templates/` | List email templates |
| `POST /templates/generate-ai` | AI template generation |
| `GET /applications/` | List applications |
| `GET /settings/me` | User settings |
| `GET /health` | Health check |

## Project Structure

```
jobhunt/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # FastAPI route handlers
│   │   ├── core/               # Config, JWT, security, logging
│   │   ├── crud/               # Database CRUD operations
│   │   ├── db/models/          # SQLAlchemy models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic (matching, parsing, Clerk)
│   │   ├── worker/             # Celery tasks (scraping, auto-apply)
│   │   └── main.py             # FastAPI app entry point
│   ├── alembic/                # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/app/                # Next.js pages
│   ├── src/components/         # Reusable UI components
│   ├── src/lib/                # Utilities and config
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## License

MIT
