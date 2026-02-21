# JobHunt - Personal Setup Guide

This guide provides a step-by-step walkthrough to get the JobHunt platform up and running on your local machine or a server using Docker.

## 1. Prerequisites

Before you begin, ensure you have the following installed:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [Git](https://git-scm.com/)

---

## 2. Environment Configuration

1. **Clone the Repository** (If you haven't already):
   ```bash
   git clone https://github.com/Chai-B/JobHunt.git
   cd JobHunt
   ```

2. **Prepare the `.env` File**:
   Copy the example environment file to create your active `.env` file:
   ```bash
   cp .env.example .env
   ```

3. **Configure the `.env` File**:
   Open `.env` in your favorite text editor. You **MUST** set at least the following:
   - `SECRET_KEY`: Generate a random string (e.g., using `openssl rand -hex 32`).
   - `POSTGRES_PASSWORD`: Use a strong password.
   - `DATABASE_URL`: Update it to match the `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` you set. 
     *Note: In Docker, the hostname is `db`, so it should look like: `postgresql+asyncpg://user:pass@db:5432/dbname`*

4. **(Optional) Clerk Configuration**:
   If you want to use Google/GitHub sign-in:
   - Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from your [Clerk Dashboard](https://dashboard.clerk.com).

---

## 3. Launching the Services

Run the following command to build and start all containers in the background:

```bash
docker compose up -d --build
```

This will start:
- **`db`**: PostgreSQL with pgvector support.
- **`redis`**: For task queue management.
- **`backend`**: FastAPI API server.
- **`celery-worker`**: For background scraping and AI tasks.
- **`frontend`**: Next.js web application.

---

## 4. Initialize the Database

Once the containers are running, you need to apply the database migrations to create the tables:

```bash
docker compose exec backend alembic upgrade head
```

---

## 5. Accessing the Application

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 6. Post-Setup Steps

1. **Sign Up**: Create your first account on the landing page.
2. **Configure Gemini**: Go to **Settings** in the dashboard and add your `GEMINI_API_KEY`. This is required for AI template generation and resume parsing.
3. **Upload Resume**: Go to the **Resumes** tab and upload your CV to start matching with jobs.

---

## 7. Troubleshooting

- **Check Logs**: 
  ```bash
  docker compose logs -f backend  # For API issues
  docker compose logs -f celery-worker # For scraper/AI issues
  ```
- **Restart Services**:
  ```bash
  docker compose restart
  ```
- **Wipe Data (Caution)**:
  To completely reset everything (including the database):
  ```bash
  docker compose down -v
  ```
