# JobHunt

An AI-powered job application management platform. Track applications, send cold emails, and scan your inbox for updates — all from one dashboard.

---

## Features

### Application Tracker
Keep tabs on every application in one place. Hit **Sync Now** to scan your Gmail inbox — the AI picks up application confirmations, interview invites, rejections, and offers automatically. Each company gets a full interaction timeline. Delete any bad entries with the trash icon.

### Cold Email Engine
Write email templates with dynamic tags like `{{FULL_NAME}}`, `{{COMPANY}}`, `{{SKILLS}}`. Pick a resume and the tags swap automatically — no AI cost per send. Preview everything before it goes out. Attach resumes with one click.

### Resume Manager
Upload multiple resumes (PDF or DOCX). They get parsed automatically so the system can pull your details for template tags and AI matching.

### Contacts
Store recruiter and hiring manager contacts. Import them from scraped pages or add manually. Use them as recipients for cold email campaigns.

### Templates
Build reusable email templates with AI assistance. Choose tone, purpose, and let the AI generate a professional draft — then customize it however you want.

### Text Extractor
Paste raw text from job listings, career pages, or emails. The AI extracts structured contacts and job info that you can save directly to your database.

### Gmail Integration
Connect your Gmail via OAuth in Settings. The app sends cold emails from your actual Gmail account and scans your inbox to track application status changes.

### Background Automation
The system runs scheduled tasks in the background:
- **Inbox Sync** — every 2 hours, checks for application updates
- **Job Discovery** — daily scraping of configured job boards
- **Cold Mail Dispatch** — sends scheduled email campaigns

Everything can also be triggered manually from the dashboard.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js, React, Tailwind CSS, Shadcn UI |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL + pgvector |
| Queue | Redis + Celery |
| AI | Google Gemini / OpenAI (configurable) |
| Auth | JWT + Clerk SSO |
| Email | Gmail API (OAuth 2.0) |

---

