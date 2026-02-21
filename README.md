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

## License

MIT
