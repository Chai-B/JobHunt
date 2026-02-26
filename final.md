JobHunt Codebase: Deep Analysis and E
nhancement Roadmap

Part 1: Current Implementation Analysis
1.1 Scrapers and Crawlers
Architecture:

Entry Point: backend/app/api/v1/endpoints/scraper.py - POST /scraper/run triggers scraping
Core Logic: backend/app/worker/tasks.py - run_scraping_agent_async() 
Headless Engine: backend/app/services/spiders.py - scrape_jobs_headless() using Playwright
Scheduling: backend/app/worker/celery_app.py - Celery Beat runs run_automated_discovery_task daily at 8 AM
How It Works:


Output
Extraction Strategies
Scraper Pipeline
Trigger Layer
JobPosting DB
JSON-LD JobPosting
spaCy NER + is_job_title
_extract_jobs_with_ai
_fetch_page requests
BeautifulSoup + lxml
URL Router
RemoteOK Parser
HackerNews Parser
WeWorkRemotely Parser
scrape_jobs_headless Playwright
Scraper Page
Celery Beat 8AM
run_scraping_agent_async
run_automated_discovery_async


Site-Specific Parsers (tasks.py):

RemoteOK: _parse_remoteok_jobs() - DOM tr.job, h2, h3, tags
HackerNews: _parse_hackernews_jobs() - tr.athing, extracts "at Company" patterns
WeWorkRemotely: _parse_weworkremotely_jobs() - li.feature, spans with title/company
Generic/Other: scrape_jobs_headless() - Playwright + JSON-LD first, then DOM heuristics + spaCy NER
Headless Scraper (spiders.py):

Uses Playwright Chromium, blocks images/CSS for speed
Strategy 1: JSON-LD @type: JobPosting - highest quality when available
Strategy 2: DOM traversal + is_job_title() heuristic + extract_entities() (spaCy NER for ORG, GPE, LOC)
Falls back to AI extraction (_extract_jobs_with_ai) only in _parse_generic_jobs - but this path is NOT used in run_scraping_agent_async for generic URLs; only scrape_jobs_headless is called
Crawls sub-links via _crawl_for_job_links() when len(dataList) < 5 (up to 3 sub-URLs)
Critical Gap - Job Embeddings:

Scraped jobs are inserted with JobPosting(source="scraper", ...) without embedding field (tasks.py:416-419)
Manual jobs via POST /jobs/ingest/manual DO get embeddings via ManualJobAdapter.process_job()
Matching engine requires job.embedding - find_best_resume_for_job() returns error if not job.embedding
Result: Scraped jobs cannot be used for semantic resume matching
Contact Scraping:

target_type="contacts" uses _parse_generic_contacts() - regex email extraction, blacklist for noreply/info/support, NER for name/company
Stores in ScrapedContact table
No AI enhancement for contact extraction
---

1.2 Auto Applications
Architecture:

Entry Point: backend/app/api/v1/endpoints/applications.py - POST /applications/{app_id}/auto-apply
Task: backend/app/worker/tasks.py - run_auto_apply_async()
State Machine: backend/app/services/application_engine.py - validates transitions (discovered→shortlisted→prepared→submitted→...)
How It Works:

User clicks Auto-Apply
run_auto_apply_async
Fetch Application Job Resume User
Gemini Prompt
JSON: cover_letter why_this_company salary_expectations
Store in app_record.notes
status = submitted
NO FORM FILLING
Reality Check:

Does NOT fill forms on webpages. The AI generates a JSON payload (cover letter, why_this_company, salary_expectations, custom_questions_inferred) and stores it in Application.notes. Status is set to "submitted" but no HTTP POST, no Playwright form interaction, no actual submission occurs.
User must manually copy the generated content and apply elsewhere.
Job source_url exists but is never used for navigation.
---

1.3 Cold Mailing
Architecture:

Entry Point: Frontend calls /api/v1/scraper/cold-mail - BACKEND HAS /dispatch-mail - potential 404 bug
Task: run_cold_mail_async() in tasks.py
Email: SMTP (smtplib) - NOT Gmail OAuth
How It Works:

User selects contact, template, resume
Gemini personalizes template subject + body using contact (name, role, company), user profile, resume text
Sends via smtplib.SMTP(settings.smtp_server) with settings.smtp_username/password
No Gmail OAuth - uses app password / SMTP relay
No automatic template+resume selection - user must manually choose
No 24/7 background automation - each send is triggered by user click or batch loop in frontend
No process tracking - no read receipts, no threading with Gmail inbox
Bug: Frontend uses cold-mail path, backend defines dispatch-mail. Route mismatch will cause 404.---

1.4 Matching Engine and Resume Parser
Matching: backend/app/services/matching_engine.py

Uses pgvector cosine_distance between JobPosting.embedding and Resume.embedding
all-MiniLM-L6-v2 (384 dim) - same model for both
Returns best_resume_id and match_score (0-100)
Broken for scraped jobs (no embeddings)
Resume Parser: backend/app/services/resume_parser.py

Extracts text from PDF (PyMuPDF), DOCX (python-docx)
Generates embedding via SentenceTransformer('all-MiniLM-L6-v2')
Computes structural_score (sections, bullets, length) and semantic_score (action verbs, quantified achievements)
No ATS score - structural/semantic are internal heuristics, not ATS-compliant scoring
No profile auto-fill - extracted content is stored in Resume.raw_text and embedding only; User profile (full_name, phone, linkedin_url, etc.) is NOT populated from resume
---

1.5 Extract Feature
Endpoint: backend/app/api/v1/endpoints/extract.py

Parses pasted text for contacts (regex emails, spaCy NER for PERSON/ORG) and jobs (heuristics: job title, "requirements"/"responsibilities")
Returns ExtractedEntity list
Frontend can save to contacts or jobs - but jobs save to /api/v1/jobs/ which does not exist; jobs have POST /jobs/ingest/manual - schema mismatch (extract sends source, source_url, is_active; manual ingest expects title, company, description)
---

1.6 Background Automation (Celery Beat)
Current Schedule:

run_automated_discovery_task - 8 AM daily - scrapes RemoteOK and HackerNews with basic regex DOM parsing (NOT the full spider pipeline)
run_daily_match_alerts_task - 9 AM daily - fetches new jobs, uses Gemini to pick top 3 matches per user, emails digest via SMTP
Bug in tasks.py:508 - user_settings.preferred_model should be settings.preferred_model (NameError)
Missing:

No periodic scraping of user-configured URLs
No auto-apply pipeline (discover → match → shortlist → auto-apply)
No cold mail automation (scheduled sends)
Scrape frequency setting (scrape_frequency_hours) exists in UserSetting but is unused
---

Part 2: Gap Analysis vs Your Expectations
| Expectation | Current State | Gap |

|-------------|---------------|-----|

| Work in background 24/7 | Celery Beat runs 2 tasks daily; scraper/cold mail are on-demand | No continuous pipeline; no user-configured schedules |

| Email access | SMTP only; no Gmail OAuth | Need Gmail API + OAuth for send + read/track |

| Crawlers find jobs | Yes - RemoteOK, HN, WWR, generic Playwright | Limited sites; no LinkedIn/Indeed (ToS); scraped jobs lack embeddings |

| Scrape + ML match + auto-apply | Scrape: yes. Match: broken for scraped jobs. Auto-apply: simulated only | Embeddings for scraped jobs; real form-filling |

| AI autofill forms on webpage | No - generates JSON, stores in DB | Playwright/browser automation to detect and fill form fields |

| Cold mail: AI template+resume selection | No - user selects manually | Need AI to pick template+resume per contact |

| Cold mail: 24/7 automated | No - manual/batch trigger | Scheduled task + config-driven |

| Process tracking via Gmail | No | Gmail API for labels, threading, read state |

| ATS score of resume | No | Implement ATS parsing (keywords, format, length) |

| Resume → profile autofill | No | LLM/extraction to populate User fields from Resume.raw_text |

| Resume content for job matching | Yes - embedding + cosine | Works only when job has embedding |---

Part 3: Technologies and Libraries to Implement
3.1 MCP (Model Context Protocol)
Purpose: Expose tools (browser, email, calendar) to LLMs so they can act autonomously
Use Case: LLM decides "apply to this job" → calls MCP tool browser_fill_form(url, fields) → tool uses Playwright
Libraries: @modelcontextprotocol/sdk (Python/TS), MCP servers for Playwright, Gmail
Free: Yes - open protocol
3.2 Browser Automation (Form Filling)
Current: Playwright (already used for scraping)
Enhancement: Use Playwright to navigate to job.source_url (or apply URL), detect form fields (input, textarea, select), map AI-generated payload to field names/labels, fill and submit
Libraries: playwright (already in use), playwright-stealth for anti-bot, botasaurus (alternative)
Challenge: Every site has different form structure; need adaptive selectors or vision-based filling (screenshot + LLM/VLM to identify fields)
3.3 Gmail Integration
Gmail API: Send, read, label, search
Auth: google-auth, google-api-python-client - OAuth 2.0 with refresh token
Libraries: google-auth-oauthlib, google-api-python-client
Free: Yes within Gmail API quotas
3.4 Faster/More Accurate ML
| Component | Current | Recommended | Rationale |

|-----------|---------|-------------|-----------|

| Embeddings | all-MiniLM-L6-v2 (384d) | all-mpnet-base-v2 or bge-large-en-v1.5 | Better semantic quality; BGE has 1024d |

| Job-Resume Match | Cosine only | Cosine + keyword boost + LLM rerank (top-K) | Reduces false positives |

| Job Extraction | JSON-LD + heuristics | + LLM/VLM for complex pages | Handles non-standard layouts |

| Contact Extraction | Regex + NER | + LLM extraction from raw text | More robust for varied formats |

3.5 ATS Score
Approach: Parse resume structure (sections, keywords from job desc), check formatting (fonts, spacing), keyword density, length
Libraries: Resume parsing: pyresparser, resume-parser (community); or custom with PyMuPDF + regex/LLM
ATS Criteria: Keywords match, clear sections, no tables/graphics (some ATS fail), standard headings
Output: 0-100 score + improvement suggestions
3.6 Profile Auto-Fill from Resume
Approach: LLM extraction with structured output (name, email, phone, location, skills, experience, education)
Schema: Map to User model fields; allow manual override
Library: Gemini/OpenAI with JSON mode; or instructor for Pydantic validation
---

Part 4: LLM Generation Prompt
Below is a detailed prompt you can use with an LLM (Claude, GPT-4, etc.) to generate implementation code and architecture for the enhanced JobHunt system.

---

PROMPT START
You are an expert software architect and engineer. You will enhance an existing Python/FastAPI job application automation platform called JobHunt. Below is a detailed specification. Produce implementation plans, code snippets, and configuration changes. Do NOT implement interview prep or resume AI rewriting. Focus ONLY on job application automation, cold mailing, and process tracking.

## CONTEXT: Existing Codebase

The platform has:
- Backend: FastAPI, SQLAlchemy async, PostgreSQL + pgvector, Celery + Redis
- Scrapers: Playwright, BeautifulSoup, site-specific parsers for RemoteOK, HackerNews, WeWorkRemotely
- Matching: sentence-transformers (all-MiniLM-L6-v2), pgvector cosine distance
- Cold mail: Gemini personalization, SMTP sending
- Auto-apply: Gemini generates JSON payload; NO actual form filling on webpages
- Models: User, UserSetting, JobPosting, Resume, Application, ScrapedContact, EmailTemplate

Key files:
- backend/app/worker/tasks.py - scraper, auto_apply, cold_mail, automated_discovery, daily_match_alerts
- backend/app/services/spiders.py - scrape_jobs_headless
- backend/app/services/matching_engine.py - find_best_resume_for_job
- backend/app/services/resume_parser.py - parse_and_embed_resume
- backend/app/services/job_ingestion.py - ManualJobAdapter with embedding

## REQUIREMENTS

### 1. Background Automation (24/7)

- Add Celery Beat tasks that run on configurable intervals (UserSetting.scrape_frequency_hours)
- Pipeline: Scrape configured URLs → Compute embeddings for new jobs → Run ML match against user's resumes → If match_score >= threshold (configurable), auto-create Application in "shortlisted" or "prepared"
- Optionally auto-trigger auto-apply for prepared applications (respect daily_apply_limit)
- All operations must be user-scoped; use first user or iterate users with valid settings

### 2. Job Scraping Enhancements

- When saving scraped jobs (tasks.py run_scraping_agent_async), compute embedding using SentenceTransformer('all-MiniLM-L6-v2') and JobPosting model's Vector(384). Use same combined text format as ManualJobAdapter: "Title: X\nCompany: Y\nDescription: Z"
- Add a post-save hook or inline embedding computation so every new JobPosting has embedding before match runs
- Consider upgrading to all-mpnet-base-v2 (768d) - requires migration for Vector dimension
- Support user-configurable scrape URLs (new model or JSON field in UserSetting)

### 3. Real Auto-Apply (Form Filling)

- When auto-apply runs, fetch job.source_url. If it points to an application page:
  - Use Playwright to navigate to the page
  - Extract form fields (input, textarea, select) - get name, id, placeholder, label
  - Map AI-generated payload (cover_letter, why_this_company, etc.) to fields using heuristics or LLM: "Given form fields [list], map these answers [payload] to the correct fields"
  - Fill fields and submit (detect submit button)
- Handle multi-page forms (wizard): click Next, repeat until Submit
- Store result: success/failure, screenshot or error message in Application.notes
- Fallback: If form filling fails (CAPTCHA, complex JS), store generated payload in notes and mark status as "prepared" for manual apply

### 4. Gmail Integration

- Add Gmail OAuth flow: User clicks "Connect Gmail" → OAuth consent → Store refresh_token and access_token (encrypted) in UserSetting
- Use Gmail API for:
  - Sending cold emails (replace SMTP when Gmail connected)
  - Reading sent mail to track threads
  - Applying labels (e.g., "JobHunt-Sent") for process tracking
- Cold mail sent via Gmail should thread properly and appear in user's Sent folder
- Add settings UI: "Use Gmail" toggle; when on, use Gmail API; when off, use SMTP

### 5. Cold Mail Automation

- New Celery task: run_scheduled_cold_mail_task
  - Fetch users with cold_mail_automation_enabled (new setting)
  - For each user: fetch contacts not yet mailed, pick template+resume via AI based on contact.role, contact.company, and user config (target_roles)
  - LLM prompt: "Given contact [name, role, company], available templates [list names/subjects], available resumes [list]. Pick best template and resume. Return JSON {template_id, resume_id, reason}"
  - Dispatch cold mail; respect daily_cold_mail_limit (new setting)
- Run on schedule (e.g., every 6 hours or configurable)

### 6. ATS Score for Resume

- Add ats_score (Float 0-100) to Resume model
- Implementation:
  - Parse resume for sections: Experience, Education, Skills, Summary
  - Check keyword coverage from a reference job description (or generic tech keywords)
  - Check format: bullet usage, section headers, length (300-800 words ideal)
  - Use LLM: "Score this resume 0-100 for ATS compatibility. Consider: keyword density, clear sections, no graphics/tables, standard headings. Return JSON {score, feedback[]}"
- Compute on resume upload/update; optionally re-run when job context provided

### 7. Profile Auto-Fill from Resume

- New endpoint: POST /resumes/{id}/extract-to-profile
- Use LLM to extract: full_name, email, phone, location, linkedin_url, summary/bio, skills (comma-separated)
- Map to User model fields; return diff for user to approve before PATCH /users/me
- Allow manual edits to extracted content before save

### 8. Resume Content for Job Matching

- Already done via embedding; ensure job embeddings exist (requirement 2)
- Add optional LLM rerank: when match_score is borderline (e.g., 60-80), run LLM: "Does this resume match this job? Yes/No, reason." Use to filter or boost

### 9. Fix Existing Bugs

- Fix tasks.py line ~508: user_settings -> settings (NameError in run_daily_match_alerts_async)
- Fix frontend cold-mail: change /scraper/cold-mail to /scraper/dispatch-mail OR add backend route alias
- Fix extract -> jobs save: Extract page sends to /api/v1/jobs/ but should use /jobs/ingest/manual with correct schema (title, company, description)

### 10. Configuration Model Updates

Add to UserSetting:
- scrape_urls: JSON array of URLs to scrape periodically
- match_threshold: Float (default 70) - min score to auto-shortlist
- auto_apply_enabled: Boolean
- cold_mail_automation_enabled: Boolean
- daily_cold_mail_limit: Integer (default 5)
- gmail_refresh_token: String (encrypted)
- gmail_access_token: String (encrypted)
- use_gmail_for_send: Boolean

## CONSTRAINTS

- Use only freely available libraries (MIT, Apache, BSD)
- No interview prep, no resume rewriting AI
- Manual edits to extracted resume content allowed
- Prefer existing stack: FastAPI, Celery, Playwright, sentence-transformers, Gemini/OpenAI
- Optimize for: speed (async, batch), accuracy (better embeddings, LLM rerank), reliability (retries, logging)

## OUTPUT

Produce:
1. Database migration (Alembic) for new columns
2. Updated tasks.py with new logic and bug fixes
3. Updated spiders.py / job ingestion for scraped job embeddings
4. New service: gmail_service.py for Gmail API
5. New service: form_filler_service.py for Playwright form automation
6. New Celery tasks and beat schedule entries
7. API endpoint changes (new routes, schema updates)
8. Frontend changes for new settings and Gmail connect

Be specific with file paths, function signatures, and key logic. Do not write full implementations of every line; provide pseudocode or critical snippets where sufficient.


PROMPT END
---

Part 5: Summary
What the current implementation CAN do:

Scrape jobs from RemoteOK, HN, WeWorkRemotely, and generic URLs (Playwright + JSON-LD/heuristics)
Scrape contacts from generic pages (regex + NER)
Match manual jobs to resumes via semantic similarity (pgvector)
Generate AI-personalized cold emails and send via SMTP
Generate AI application payloads (cover letter, etc.) and store them
Daily discovery and match alerts (with a bug)
Manual application pipeline (CRUD, status updates)
What it CANNOT do (or does poorly):

Fill application forms on actual webpages
Use Gmail for send/track
Automatically select template+resume for cold mail
Run cold mail or auto-apply in background 24/7
Score resumes for ATS
Auto-fill user profile from resume
Match scraped jobs (no embeddings)
User-configured scrape schedules