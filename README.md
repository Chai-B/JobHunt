# JobHunt: The Autonomous AI Job Agent

Welcome to JobHunt, an all-in-one AI-powered platform designed to fully automate and optimize the tedious modern job application process. 

JobHunt acts as your personal recruitment assistant: finding jobs, tracking them in a CRM-style pipeline, extracting contacts, generating highly personalized AI cold emails, and ultimately matching your skills to the perfect role using semantic intelligence.

---

## 🚀 Core Features

### 1. Unified Job Scraping Engine
Job finding shouldn't require opening 50 tabs. JobHunt centralizes the search:
- **Multi-Source Ingestion:** One-click integration with major remote job boards (RemoteOK, HackerNews, We Work Remotely).
- **Custom URL Scraping:** Feed it any generic job board URL, and the platform uses a fallback parser to extract the structural data.
- **Background Autonomy:** Scraping runs completely asynchronously via Celery unblocking your workflow while jobs pour into your database.
- **Smart Deduplication:** The engine intelligently deduplicates job postings that appear across multiple platforms.

### 2. Semantic Resume Matching
Stop guessing if your resume fits the job description.
- **pgvector Integration:** Both jobs and resumes are converted into high-dimensional vector embeddings using local `sentence-transformers`.
- **Cosine Similarity:** instantly mathematically determines which of your uploaded resumes is the most conceptually aligned with a specific job posting.
- **Multi-Format Support:** Automatically parses and extracts semantic text from `.pdf`, `.docx`, and raw text formats.

### 3. Comprehensive Application CRM
Treat your job search like a sales pipeline.
- **Strict State Machine:** Applications transition cleanly through states: *Discovered → Shortlisted → Prepared → Submitted → Responded → Closed*.
- **Metrics Dashboard:** Real-time analytics on your specific pipeline velocity and global knowledge pool stats.

### 4. AI-Powered Cold Email Generation
Harness the power of Google's Gemini Pro to write the perfect pitch.
- **Contextual Awareness:** The AI reads the specific Job Description and the specific matched Resume.
- **Customizable Tones:** Generate templates ranging from *Professional* and *Direct* to *Enthusiastic*.
- **Multi-Purpose:** Specifically tailored modes for General Applications, Cold Outreach (finding recruiters), Networking, and Follow-ups.
- **Placeholders:** Emits dynamic tags like `{{HiringManager}}` to drop into mass campaigns.

### 5. Collaborative Contact Extraction
- As jobs are scraped, embedded email addresses or recruiter contact information is parsed and dropped into a global collaborative pool.
- Initiate autonomous 'Cold Mail Agents' directly from the contact dashboard safely tied to your selected AI templates.

### 6. Beautiful, Headless Authentication
- Secure JWT-based backend routing.
- Integrated out-of-the-box with **Clerk OAuth** for immediate, secure 1-click Google and GitHub login on the frontend, gracefully falling back to local Auth if ignored.

---

## 🛠 Tech Stack Overview

JobHunt is built for high concurrency and heavy AI workloads.

| Layer | Technology |
|-------|-----------|
| **Frontend UI** | Next.js 16 (App Router), React 19, TailwindCSS, Shadcn UI |
| **Backend API** | Python, FastAPI, SQLAlchemy (Async), Pydantic v2 |
| **Database** | PostgreSQL natively extended with `pgvector` |
| **Task Queue** | Redis + Celery |
| **Artificial Intelligence** | Google Gemini (Generative AI), `all-MiniLM-L6-v2` (Sentence Embeddings) |

---

## 📜 License

This project is licensed under the MIT License.
