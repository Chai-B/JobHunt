# JobHunt: Autonomous AI Job Agent

JobHunt is a comprehensive, AI-driven platform designed to automate and optimize the modern job application lifecycle. 

The platform serves as an intelligent recruitment assistant by centralizing job discovery, maintaining a structured application pipeline, extracting key contact information, generating personalized cold outreach emails via generative AI, and matching candidate profiles to opportunities using semantic vector intelligence.

---

## Core Features

### 1. Unified Job Scraping Engine
The platform consolidates job discovery through a centralized engine:
- **Multi-Source Ingestion:** Seamless integration with primary remote job boards including RemoteOK, HackerNews, and We Work Remotely.
- **Custom URL Scraping:** Support for generic job board URLs, utilizing a fallback parser to extract structural data.
- **Background Autonomy:** Scraping operations execute asynchronously via Celery, ensuring uninterrupted user workflows while populating the database.
- **Intelligent Deduplication:** The engine automatically identifies and deduplicates cyclical postings across multiple platforms.

### 2. Semantic Resume Matching
The platform utilizes mathematical modeling to determine candidate fit:
- **Vector Integration:** Job descriptions and resumes are converted into high-dimensional vector embeddings using local `sentence-transformers`.
- **Cosine Similarity:** The system mathematically determines the optimal resume for a specific job posting based on conceptual alignment.
- **Multi-Format Support:** Automated parsing and semantic extraction for `.pdf`, `.docx`, and raw text formats.

### 3. Application CRM Pipeline
Applications are managed through a structured, stage-based lifecycle.
- **State Machine Architecture:** Applications transition through defined states: *Discovered → Shortlisted → Prepared → Submitted → Responded → Closed*.
- **Metrics Dashboard:** Real-time analytics tracking pipeline velocity and global knowledge pool statistics.

### 4. AI-Powered Cold Email Generation
The platform leverages Google Gemini Pro to generate context-aware outreach.
- **Contextual Awareness:** The generation model analyzes both the specific job description and the matched resume.
- **Customizable Tones:** Output configurable for various professional tones including direct, formal, and enthusiastic.
- **Purpose-Built Modes:** Tailored generation for general applications, cold outreach, networking, and subsequent follow-ups.
- **Dynamic Placeholders:** Supports template tags such as `{{HiringManager}}` for integration with mass outreach campaigns.

### 5. Collaborative Contact Extraction
- During the scraping process, embedded email addresses and recruiter contact information are parsed and aggregated into a global collaborative pool.
- Users can initiate autonomous cold outreach campaigns directly from the contact dashboard, securely utilizing generated AI templates.

### 6. Secure Authentication
- Stateless, JWT-based backend routing.
- Integrated out-of-the-box with Clerk OAuth for immediate, secure single sign-on (SSO) via Google and GitHub, with a fallback to local authentication when the service is not configured.

---

## Technical Architecture

JobHunt is architected for high concurrency and intensive AI workloads.

| Layer | Technology |
|-------|-----------|
| **Frontend UI** | Next.js 16 (App Router), React 19, TailwindCSS, Shadcn UI |
| **Backend API** | Python, FastAPI, SQLAlchemy (Async), Pydantic v2 |
| **Database** | PostgreSQL natively extended with `pgvector` |
| **Task Queue** | Redis + Celery |
| **Artificial Intelligence** | Google Gemini (Generative AI), `all-MiniLM-L6-v2` (Sentence Embeddings) |

---

## License

This project is licensed under the MIT License.
