import asyncio
from loguru import logger
from sqlalchemy import select
import os
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from app.worker.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.db.models.resume import Resume
from app.db.models.setting import UserSetting
from app.db.models.contact import ScrapedContact
from app.db.models.job_posting import JobPosting
from app.db.models.user import User
from app.db.models.application import Application
from app.db.models.email_template import EmailTemplate
from app.db.models.action_log import ActionLog
from app.services.resume_parser import parse_and_embed_resume
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
from app.services.llm import call_llm
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

async def process_resume_async(resume_id: int, file_bytes: bytes, filename: str):
    async with AsyncSessionLocal() as db:
        try:
            # 1. Parse and Embed
            logger.info(f"Starting parsing for resume_id={resume_id}")
            
            # Fetch user ID first to associate the log
            stmt = select(Resume).where(Resume.id == resume_id)
            db_res = await db.execute(stmt)
            resume = db_res.scalars().first()
            if not resume:
                logger.error(f"Resume {resume_id} not found in DB.")
                return
                
            # Log Start
            log_start = ActionLog(user_id=resume.user_id, action_type="resume_extraction", status="running", message=f"Started extracting text for resume: {filename}")
            db.add(log_start)
            await db.commit()

            # Run synchronous parsing + embedding in a thread pool to avoid blocking event loop
            result = await asyncio.to_thread(parse_and_embed_resume, file_bytes, filename)
            
            # 2. Update DB Entity
            resume.raw_text = result["raw_text"]
            resume.embedding = result["embedding"]
            resume.structural_score = result["structural_score"]
            resume.semantic_score = result["semantic_score"]
            
            # Extract precise tags using LLM to populate parsed_json for templating
            stmt_set = select(UserSetting).where(UserSetting.user_id == resume.user_id)
            settings = (await db.execute(stmt_set)).scalars().first()
            
            if settings and settings.gemini_api_keys:
                extract_prompt = f"""You are a professional resume parser. Extract the following key details from this resume text to be used directly as replacement variables in cold emails and templates. 
Return STRICTLY valid JSON with these exact keys. 
Your output values MUST strictly be concise, tight phrases without fluff. Do not write full sentences. Write them as if they are being dropped into the middle of a sentence.

CONSTRAINTS:
- "experience_years": Integer string ONLY (e.g. "5"). NO reasoning, NO text like "estimated from". If unknown, use "0".
- "skills": Top 10 skills max, comma separated (e.g. "Python, React, AWS").
- "top_projects": 1 short phrase per project, max 2 projects (e.g. "built a scalable API and optimized DB queries").
- "education": Shortest form (e.g. "BTech CS, XYZ Univ").
- "recent_role": Specific title and company (e.g. "Senior Dev at ABC").
- "certifications": comma separated.

{{
  "education": "...",
  "recent_role": "...",
  "top_projects": "...",
  "certifications": "...",
  "experience_years": "...",
  "skills": "..."
}}
If a field is not found or cannot be reasonably inferred, omit the key entirely or set it to an empty string "".
Resume Text:
{resume.raw_text[:10000]}"""
                try:
                    raw_parsed = await call_llm(extract_prompt, settings, is_json=True)
                    resume.parsed_json = json.loads(raw_parsed, strict=False)
                    logger.info(f"Successfully extracted rich tags for resume {resume.id}")
                except Exception as llm_e:
                    logger.warning(f"LLM rich tag extraction failed for resume {resume.id}: {llm_e}")
                    resume.parsed_json = {}

            ats_score = (resume.structural_score * 0.4 + resume.semantic_score * 0.6) * 100
            stmt_set = select(UserSetting).where(UserSetting.user_id == resume.user_id)
            settings = (await db.execute(stmt_set)).scalars().first()
            if settings and settings.gemini_api_keys:
                prompt = f"""Score this resume 0-100 for ATS compatibility. Consider: keyword density, clear sections, no graphics/tables, standard headings. Return JSON {{"score": 85, "feedback": ["Good"]}}. Resume Text: {resume.raw_text[:8000]}"""
                try:
                    raw_ats = await call_llm(prompt, settings, is_json=True)
                    ats_data = json.loads(raw_ats, strict=False)
                    ats_score = float(ats_data.get("score", ats_score))
                except Exception as llm_e:
                    logger.warning(f"LLM ATS Score failed: {llm_e}")
            
            resume.ats_score = ats_score
            resume.status = "completed"
            db.add(resume)
            
            # Log Success
            log_success = ActionLog(user_id=resume.user_id, action_type="resume_extraction", status="success", message=f"Successfully extracted {len(result['raw_text'])} characters for {filename}")
            db.add(log_success)
            
            await db.commit()
            logger.info(f"Successfully processed resume_id={resume_id}")
            
        except Exception as e:
            logger.exception(f"Failed to process resume {resume_id}: {e}")
            stmt = select(Resume).where(Resume.id == resume_id)
            db_res = await db.execute(stmt)
            resume = db_res.scalars().first()
            if resume:
                resume.status = "error"
                db.add(resume)
                
                # Log Error
                log_error = ActionLog(user_id=resume.user_id, action_type="resume_extraction", status="failed", message=f"Extraction failed: {str(e)}")
                db.add(log_error)
                
                await db.commit()

@celery_app.task(name="process_resume_task")
def process_resume_task(resume_id: int, file_bytes: bytes, filename: str):
    """
    Synchronous wrapper for Celery to run the async DB update.
    """
    asyncio.run(process_resume_async(resume_id, file_bytes, filename))

import random
import time

USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
]

def _fetch_page(url: str, retries: int = 3, timeout: int = 20):
    """Fetch a page with retry logic and rotating User-Agent."""
    for attempt in range(retries):
        try:
            headers = {
                'User-Agent': random.choice(USER_AGENTS),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            }
            response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            logger.warning(f"Scrape attempt {attempt + 1}/{retries} failed for {url}: {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
    raise Exception(f"Failed to fetch {url} after {retries} attempts")

def _parse_remoteok_jobs(soup):
    """Site-specific parser for RemoteOK."""
    jobs = []
    for row in soup.find_all('tr', class_='job'):
        title_el = row.find('h2')
        company_el = row.find('h3')
        tags = [tag.get_text(strip=True) for tag in row.find_all('div', class_='tag')]
        if title_el:
            jobs.append({
                "title": title_el.get_text(strip=True),
                "company": company_el.get_text(strip=True) if company_el else "Unknown",
                "location": "Remote",
                "description": f"Tags: {', '.join(tags[:5])}" if tags else "Remote position",
            })
    return jobs

def _parse_hackernews_jobs(soup):
    """Site-specific parser for Hacker News jobs."""
    jobs = []
    for item in soup.find_all('tr', class_='athing'):
        title_link = item.find('a', class_='titleline') or item.find('span', class_='titleline')
        if title_link:
            text = title_link.get_text(strip=True)
            if len(text) > 10 and len(text) < 200:
                # Try to extract company from " at Company" or "Company - " patterns
                company = "YC Company"
                if " at " in text:
                    parts = text.split(" at ", 1)
                    company = parts[1].split("(")[0].strip() if len(parts) > 1 else company
                elif " - " in text:
                    company = text.split(" - ")[0].strip()
                jobs.append({
                    "title": text,
                    "company": company,
                    "location": "Remote / On-site",
                    "description": text,
                })
    return jobs

def _parse_weworkremotely_jobs(soup):
    """Site-specific parser for WeWorkRemotely."""
    jobs = []
    for listing in soup.find_all('li', class_='feature'):
        link = listing.find('a')
        if not link:
            continue
        spans = link.find_all('span')
        title = ""
        company = ""
        for span in spans:
            cls = span.get('class', [])
            if 'title' in cls:
                title = span.get_text(strip=True)
            elif 'company' in cls:
                company = span.get_text(strip=True)
        if title:
            jobs.append({
                "title": title,
                "company": company or "Unknown",
                "location": "Remote",
                "description": f"{title} at {company}" if company else title,
            })
    return jobs

import re as _re
from urllib.parse import urljoin, urlparse

def _parse_json_ld_jobs(soup):
    """Extract job postings from JSON-LD structured data."""
    jobs = []
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            items = data if isinstance(data, list) else [data]
            for item in list(items):
                if isinstance(item, dict) and item.get('@graph'):
                    items.extend(item['@graph'])
            for item in items:
                if not isinstance(item, dict):
                    continue
                item_type = str(item.get('@type', ''))
                if 'JobPosting' not in item_type:
                    continue
                title = item.get('title') or item.get('name', '')
                company = ''
                org = item.get('hiringOrganization', {})
                if isinstance(org, dict):
                    company = org.get('name', '')
                location = ''
                loc = item.get('jobLocation', {})
                if isinstance(loc, dict):
                    addr = loc.get('address', {})
                    if isinstance(addr, dict):
                        location = addr.get('addressLocality', '')
                description = item.get('description', '')
                if '<' in description:
                    description = BeautifulSoup(description, 'html.parser').get_text(separator=' ', strip=True)
                if title:
                    jobs.append({"title": title.strip(), "company": company.strip() or "Unknown",
                                 "location": location.strip() or "Not specified",
                                 "description": (description[:500] if description else title)})
        except (json.JSONDecodeError, AttributeError, TypeError):
            continue
    return jobs

async def _extract_jobs_with_ai(page_text: str, url: str, settings) -> list:
    """Use AI to extract real job postings from page text."""
    if not settings or not page_text.strip():
        return []
    
    # Truncate to stay within token limits
    text_chunk = page_text[:15000]
    
    prompt = f"""Analyze the following webpage text and extract ONLY actual job postings/openings.
Do NOT include:
- Navigation links or menu items
- Category headers or filter labels
- Company descriptions or about pages
- Blog posts or articles
- Any text that is NOT a specific job opening

For each REAL job posting found, extract:
- title: The exact job title (e.g. "Senior Software Engineer")
- company: The hiring company name
- location: The job location (or "Remote" / "Not specified")
- description: A brief description of the role (max 300 chars)

Return ONLY a valid JSON array. If no real job postings are found, return [].
Do not wrap in markdown code blocks. Just return the raw JSON array.

Webpage URL: {url}

Webpage text:
{text_chunk}"""

    try:
        raw = await call_llm(prompt=prompt, settings=settings, is_json=True)
        jobs = json.loads(raw, strict=False)
        if not isinstance(jobs, list):
            return []
        
        # Validate and clean results
        valid_jobs = []
        seen = set()
        for j in jobs:
            if not isinstance(j, dict):
                continue
            title = str(j.get('title', '')).strip()
            if not title or len(title) < 3 or len(title) > 200:
                continue
            tk = title.lower()
            if tk in seen:
                continue
            seen.add(tk)
            valid_jobs.append({
                "title": title,
                "company": str(j.get('company', 'Unknown')).strip() or 'Unknown',
                "location": str(j.get('location', 'Not specified')).strip() or 'Not specified',
                "description": str(j.get('description', title)).strip()[:500] or title
            })
        
        logger.info(f"AI extracted {len(valid_jobs)} verified jobs from {url}")
        return valid_jobs[:50]
    except Exception as e:
        logger.warning(f"AI extraction failed for {url}: {e}")
        return []

def _clean_page_text(soup) -> str:
    """Extract meaningful text from a page, stripping nav/footer/scripts."""
    # Remove noise elements
    for tag in soup.find_all(['script', 'style', 'noscript', 'iframe', 'svg']):
        tag.decompose()
    for tag in soup.find_all(['nav', 'footer', 'header']):
        tag.decompose()
    # Also remove hidden elements
    for tag in soup.find_all(attrs={'style': _re.compile(r'display:\s*none', _re.I)}):
        tag.decompose()
    
    text = soup.get_text(separator='\n', strip=True)
    # Collapse multiple blank lines
    text = _re.sub(r'\n{3,}', '\n\n', text)
    return text

def _crawl_for_job_links(soup, base_url: str):
    """Find internal links that likely lead to job listings."""
    job_urls = set()
    parsed_base = urlparse(base_url)
    for a in soup.find_all('a', href=True):
        full_url = urljoin(base_url, a['href'])
        parsed = urlparse(full_url)
        if parsed.netloc != parsed_base.netloc:
            continue
        path_lower = parsed.path.lower()
        link_text = a.get_text(strip=True).lower()
        if _re.search(r'(job|career|position|opening|vacanc|hiring|work-with|join)', path_lower) or \
           _re.search(r'(job|career|position|opening|vacanc|hiring|see all|view all)', link_text):
            job_urls.add(full_url)
    return list(job_urls)[:10]

async def _parse_generic_jobs(soup, url: str, settings=None):
    """AI-powered generic parser: JSON-LD first (free) → Custom AI extraction."""
    all_jobs = []
    
    # Strategy 1: JSON-LD structured data (free, highest quality)
    all_jobs.extend(_parse_json_ld_jobs(soup))
    
    # Strategy 2: AI extraction (if JSON-LD didn't find enough)
    if len(all_jobs) < 5 and settings:
        page_text = _clean_page_text(soup)
        if len(page_text) > 100:  # Only if there's meaningful content
            existing = {j['title'].lower().strip() for j in all_jobs}
            ai_jobs = await _extract_jobs_with_ai(page_text, url, settings)
            for j in ai_jobs:
                if j['title'].lower().strip() not in existing:
                    all_jobs.append(j)
                    existing.add(j['title'].lower().strip())
    
    return all_jobs[:50]

def _filter_jobs_by_keywords(jobs: list, keywords: str) -> list:
    """Filter jobs by keyword matching on title, company, or description."""
    if not keywords: return jobs
    kw_list = [k.strip().lower() for k in keywords.split(",") if k.strip()]
    if not kw_list: return jobs
    return [j for j in jobs if any(kw in f"{j.get('title','')} {j.get('company','')} {j.get('description','')}".lower() for kw in kw_list)]

def _parse_generic_contacts(soup, url: str):
    """Generic contact parser with deduplication."""
    contacts = []
    seen_emails = set()
    text = soup.get_text(separator=' ')
    
    # Extract emails
    emails = set(_re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text))
    # Filter out common non-person emails
    blacklist = {'noreply', 'no-reply', 'info@', 'support@', 'admin@', 'webmaster@', 'contact@', 'hello@', 'sales@', 'marketing@'}
    
    for email in list(emails)[:30]:
        if any(bl in email.lower() for bl in blacklist):
            continue
        if email.lower() in seen_emails:
            continue
        seen_emails.add(email.lower())
        
        name = email.split('@')[0].replace('.', ' ').replace('_', ' ').replace('-', ' ').title()
        domain = email.split('@')[1].split('.')[0].title()
        
        contacts.append({
            "name": name,
            "email": email,
            "role": "Contact",
            "company": domain,
            "source_url": url
        })
    
    return contacts

async def run_scraping_agent_async(user_id: int, target_url: str, target_type: str, keywords: str = None):
    async with AsyncSessionLocal() as db:
        try:
            logger.info(f"User {user_id} crawling {target_url} for {target_type}")
            filter_msg = f" (filter: {keywords})" if keywords else ""
            log_start = ActionLog(user_id=user_id, action_type="scraper", status="running",
                                 message=f"Crawling {target_url} for {target_type}{filter_msg}")
            db.add(log_start)
            await db.commit()
            stmt_set = select(UserSetting).where(UserSetting.user_id == user_id)
            user_settings = (await db.execute(stmt_set)).scalars().first()
            
            response = _fetch_page(target_url)
            soup = BeautifulSoup(response.content, 'lxml')
            dataList = []
            
            if target_type == "jobs":
                url_lower = target_url.lower()
                from app.services.spiders import scrape_jobs_headless
                
                if 'remoteok.com' in url_lower:
                    dataList = _parse_remoteok_jobs(soup)
                elif 'news.ycombinator.com' in url_lower or 'ycombinator.com/jobs' in url_lower:
                    dataList = _parse_hackernews_jobs(soup)
                elif 'weworkremotely.com' in url_lower:
                    dataList = _parse_weworkremotely_jobs(soup)
                else:
                    dataList = await scrape_jobs_headless(target_url, user_settings)
                
                # If few results, crawl linked job pages
                if len(dataList) < 5:
                    sub_urls = _crawl_for_job_links(soup, target_url)
                    existing_t = {j['title'].lower().strip() for j in dataList}
                    for sub_url in sub_urls[:3]: # Cap at 3 for headless speed
                        try:
                            sub_data = await scrape_jobs_headless(sub_url, user_settings)
                            for j in sub_data:
                                if j['title'].lower().strip() not in existing_t:
                                    j['source_url'] = sub_url
                                    dataList.append(j)
                                    existing_t.add(j['title'].lower().strip())
                        except Exception as e:
                            logger.error(f"Failed to scrape suburl {sub_url}: {e}")
                            continue
                
                if keywords:
                    dataList = _filter_jobs_by_keywords(dataList, keywords)
                
                for item in dataList:
                    if 'source_url' not in item:
                        item['source_url'] = target_url
                
                existing_titles = set()
                existing_res = await db.execute(
                    select(JobPosting.title).where(JobPosting.source_url == target_url))
                for row in existing_res:
                    existing_titles.add(row[0].lower().strip())
                new_jobs = [j for j in dataList if j['title'].lower().strip() not in existing_titles]
                
                for item in new_jobs:
                    title = item.get("title", "Unknown")
                    company = item.get("company", "Unknown")
                    description = item.get("description", "")
                    combined_text = f"Title: {title}\nCompany: {company}\nDescription: {description}"
                    from app.services.job_ingestion import model as sentence_model
                    embedding = sentence_model.encode(combined_text).tolist()

                    db.add(JobPosting(source="scraper", title=title,
                                     company=company, location=item.get("location"),
                                     description=description,
                                     embedding=embedding,
                                     source_url=item.get("source_url", target_url)))
                
                log_msg = f"Crawled {target_url}: {len(dataList)} jobs found, {len(new_jobs)} new"
                if keywords: log_msg += f" (filter: {keywords})"
            else:
                dataList = _parse_generic_contacts(soup, target_url)
                existing_emails = set()
                existing_res = await db.execute(select(ScrapedContact.email))
                for row in existing_res:
                    if row[0]: existing_emails.add(row[0].lower())
                new_contacts = [c for c in dataList if c['email'].lower() not in existing_emails]
                for item in new_contacts:
                    db.add(ScrapedContact(name=item.get('name'), email=item.get('email'),
                                         role=item.get('role'), company=item.get('company'),
                                         source_url=item.get('source_url', target_url)))
                log_msg = f"Crawled {target_url}: {len(dataList)} contacts, {len(new_contacts)} new"
            
            log_success = ActionLog(user_id=user_id, action_type="scraper", status="success", message=log_msg)
            db.add(log_success)
            await db.commit()
            logger.info(log_msg)

        except Exception as e:
            logger.exception(f"Scraping failed for {target_url}: {e}")
            log_error = ActionLog(user_id=user_id, action_type="scraper", status="failed",
                                 message=f"Scraping failed: {str(e)}")
            db.add(log_error)
            await db.commit()

@celery_app.task(name="run_scraping_agent_task")
def run_scraping_agent_task(user_id: int, target_url: str, target_type: str, keywords: str = None):
    asyncio.run(run_scraping_agent_async(user_id, target_url, target_type, keywords))

async def run_auto_apply_async(user_id: int, app_id: int):
    async with AsyncSessionLocal() as db:
        try:
            logger.info(f"User {user_id} starting auto-apply for application {app_id}")
            
            log_start = ActionLog(user_id=user_id, action_type="auto_apply", status="running", message=f"Constructing Application #{app_id} Payload")
            db.add(log_start)
            await db.commit()
            
            # Fetch Context: Application, User, Settings, Resume, Job
            stmt = select(Application).where(Application.id == app_id)
            res = await db.execute(stmt)
            app_record = res.scalars().first()
            if not app_record: return
            
            # Application needs a resume
            if not app_record.resume_id: return
            
            stmt = select(User).where(User.id == user_id)
            user = (await db.execute(stmt)).scalars().first()
            
            stmt = select(UserSetting).where(UserSetting.user_id == user_id)
            settings = (await db.execute(stmt)).scalars().first()
            if not settings or not settings.gemini_api_keys:
                logger.error("No Gemini key configured for auto-apply.")
                app_record.status = "error"
                app_record.notes = "Failed: Missing Gemini API Key in Settings."
                db.add(app_record)
                await db.commit()
                return

            stmt = select(Resume).where(Resume.id == app_record.resume_id)
            resume = (await db.execute(stmt)).scalars().first()
            
            stmt = select(JobPosting).where(JobPosting.id == app_record.job_id)
            job = (await db.execute(stmt)).scalars().first()

            # Setup Gemini
            api_key = settings.gemini_api_keys.split(",")[0].strip()
            genai.configure(api_key=api_key)
            model_name = settings.preferred_model or "gemini-2.0-flash"
            model = genai.GenerativeModel(model_name)
            
            user_profile_data = f"""
            Name: {user.full_name}
            Email: {user.email}
            Phone: {user.phone}
            Location: {user.location}
            Bio: {user.bio}
            LinkedIn: {user.linkedin_url}
            GitHub: {user.github_url}
            Portfolio: {user.portfolio_url}
            """
            
            resume_text = resume.raw_text[:20000] if resume.raw_text else ""
            job_desc = job.description[:20000] if job.description else ""

            prompt = f"""
            You are an autonomous job application agent acting on behalf of the user.
            Your goal is to simulate filling out a job application perfectly.
            
            USER PROFILE:
            {user_profile_data}
            
            USER RESUME:
            {resume_text}
            
            JOB POSTING ({job.title} at {job.company}):
            {job_desc}
            
            Output a JSON response containing the simulated application form answers:
            {{
                "cover_letter": "A highly tailored 3-paragraph cover letter...",
                "why_this_company": "A 2-sentence specific reason for wanting to join this company based on the job description",
                "salary_expectations": "Negotiable based on total compensation package",
                "custom_questions_inferred": "Any specific requirements answered directly..."
            }}
            Return strictly JSON.
            """
            
            ai_response = model.generate_content(prompt)
            raw_json_str = ai_response.text
            
            if raw_json_str.startswith('```json'):
                raw_json_str = raw_json_str.split('```json')[1].split('```')[0].strip()
            elif raw_json_str.startswith('```'):
                raw_json_str = raw_json_str.split('```')[1].split('```')[0].strip()
                
            form_payload = json.loads(raw_json_str, strict=False)
            # Execute Playwright Form Filling attempt
            form_result = "Form Fill Skipped/Not Attempted"
            status = "prepared"
            try:
                if job.source_url and job.source_url.startswith("http"):
                    from app.services.form_filler_service import fill_application_form
                    form_result = await fill_application_form(job.source_url, form_payload, settings)
                    status = "submitted" # Successfully ran the autonomous logic
            except Exception as e:
                logger.warning(f"Form filler fallback triggered for {job.source_url}: {e}")
                form_result = f"Failed to auto-fill form: {str(e)}"
                status = "prepared"
            
            logger.info(f"Generated auto-apply payload for app {app_id}. Result: {form_result}")
            
            app_record.status = status
            
            # Combine generated AI notes + Form result
            app_record.notes = json.dumps({"ai_payload": form_payload, "form_result": form_result}, indent=2)
            db.add(app_record)
            
            log_succ = ActionLog(user_id=user_id, action_type="auto_apply", status="success", message=f"Generated Auto-Apply Application Payload successfully")
            db.add(log_succ)
            await db.commit()
            logger.info(f"Auto-Apply completed for App {app_id}")
            
        except Exception as e:
            logger.exception(f"Auto-Apply failed: {e}")
            
            log_err = ActionLog(user_id=user_id, action_type="auto_apply", status="failed", message=f"Auto-Apply Failed: {str(e)}")
            db.add(log_err)
            
            if 'app_record' in locals() and app_record:
                app_record.status = "error"
                app_record.notes = f"Exception during Auto-Apply execution: {str(e)}"
                db.add(app_record)
                await db.commit()

@celery_app.task(name="run_auto_apply_task")
def run_auto_apply_task(user_id: int, app_id: int):
    asyncio.run(run_auto_apply_async(user_id, app_id))

async def run_cold_mail_async(user_id: int, contact_id: int, template_id: int, resume_id: int):
    async with AsyncSessionLocal() as db:
        try:
            logger.info(f"User {user_id} starting cold-mail dispatch for contact {contact_id}")
            
            log_start = ActionLog(user_id=user_id, action_type="cold_mail", status="running", message=f"Dispatching Cold Mail to Contact #{contact_id}")
            db.add(log_start)
            await db.commit()
            
            # Fetch Context
            user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
            settings = (await db.execute(select(UserSetting).where(UserSetting.user_id == user_id))).scalars().first()
            contact = (await db.execute(select(ScrapedContact).where(ScrapedContact.id == contact_id))).scalars().first()
            template = (await db.execute(select(EmailTemplate).where(EmailTemplate.id == template_id))).scalars().first()
            resume = (await db.execute(select(Resume).where(Resume.id == resume_id))).scalars().first()

            if not all([user, settings, contact, template, resume]):
                logger.error("Missing required context/entities for cold mail.")
                return

            if getattr(settings, 'use_gmail_for_send', False):
                if not getattr(settings, 'gmail_access_token', None):
                    logger.error("Missing Gmail tokens but use_gmail_for_send is enabled.")
                    return
            else:
                if not settings.smtp_server or not settings.smtp_username or not settings.smtp_password:
                    logger.error("Missing SMTP Configuration in User Settings.")
                    return

            # Default fallback data
            resume_data = resume.parsed_json or {}
            
            # Build tag replacement map
            exp_years = resume_data.get("experience_years") or getattr(user, 'experience_years', "") or ""
            # Robust cleanup: If it contains parentheses or verbose estimation text, attempt to strip it
            if "(" in str(exp_years):
                import re
                match = re.search(r'(\d+)', str(exp_years))
                if match:
                    exp_years = match.group(1)

            tag_map = {
                "{{contact_name}}": contact.name or "",
                "{{job_title}}": contact.role or "",
                "{{company}}": contact.company or "",
                "{{experience_years}}": exp_years,
                "{{skills}}": resume_data.get("skills") or getattr(user, 'skills', "") or "",
                "{{education}}": resume_data.get("education") or "",
                "{{recent_role}}": resume_data.get("recent_role") or "",
                "{{top_projects}}": resume_data.get("top_projects") or "",
                "{{certifications}}": resume_data.get("certifications") or "",
                "{{linkedin}}": user.linkedin_url or "",
                "{{github}}": user.github_url or "",
                "{{portfolio}}": getattr(user, 'portfolio_url', "") or "",
                "{{user_name}}": user.full_name or "",
                "{{user_email}}": user.email or "",
                "{{user_phone}}": user.phone or "",
            }

            # Fill template tags natively
            subject = template.subject
            body = template.body_text
            
            # We want to smartly remove sentences that contain tags with NO data
            # Doing this via LLM is safest to maintain grammar and punctuation.
            missing_tags = [
                tag for tag, val in tag_map.items() 
                if (not val or str(val).strip() == "") and (tag in subject or tag in body)
            ]
            
            if missing_tags and settings.gemini_api_keys:
                fallback_prompt = f"""You are a precise email text processor.
The following email template contains un-handled double-bracket variables.
The specific variables listed in MISSING_TAGS have no user data available.

CRITICAL INSTRUCTIONS:
1. You must CAREFULLY delete or rewrite ONLY the specific clause, sentence, or phrase that relied on the missing variables listed below.
2. If a variable is missing, you must also remove any introductory or descriptive phrases associated with it (e.g., "My portfolio, which includes {{portfolio}}," should be deleted entirely if {{portfolio}} is missing).
3. DO NOT modify, resolve, or remove ANY OTHER `{{{{variables}}}}` present in the text. You must output all other `{{{{variables}}}}` EXACTLY as they appear in the original template.
4. If the subject contains the missing tag, modify the subject.
5. Fix any resulting orphaned punctuation (e.g., double spaces, trailing commas, or weird periods).
6. Do not invent replacement fake names or data. Just structure the sentence around the gap.

MISSING_TAGS: {', '.join(missing_tags)}

SUBJECT_TEMPLATE:
{subject}

BODY_TEMPLATE:
{body}

Return STRICTLY valid JSON ONLY:
{{
  "subject": "<Cleaned Subject line>",
  "body_text": "<Cleaned Body text>"
}}
"""
                try:
                    from app.services.llm import call_llm
                    import json
                    # Force temperature=0 for deterministic proofreading
                    cleaned_str = await call_llm(fallback_prompt, settings, is_json=True, temperature=0.0)
                    cleaned_data = json.loads(cleaned_str, strict=False)
                    subject = cleaned_data.get("subject", subject)
                    body = cleaned_data.get("body_text", body)
                except Exception as e:
                    logger.warning(f"Fallback cleaner failed: {e}. Defaulting to string replacement.")

            # Do final standard replacement for all tags (both valid and any remaining missing ones)
            for tag, value in tag_map.items():
                subject = subject.replace(tag, str(value) if value else "")
                body = body.replace(tag, str(value) if value else "")

            # Resolve Disk-based Resume Attachment using absolute path from settings
            UPLOAD_DIR = settings.UPLOAD_DIR
            file_path = UPLOAD_DIR / f"{resume.id}_{resume.filename}"
            has_attachment = file_path.exists()
            logger.info(f"Checking for resume at {file_path}. Exists: {has_attachment}")
            attachment_data = None
            if has_attachment:
                with open(file_path, "rb") as f:
                    attachment_data = f.read()

            msg = MIMEMultipart()
            msg['From'] = settings.smtp_username or "user@example.com"
            msg['To'] = contact.email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))
            
            if has_attachment:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment_data)
                encoders.encode_base64(part)
                clean_filename = resume.filename
                part.add_header("Content-Disposition", f"attachment; filename={clean_filename}")
                msg.attach(part)
            
            port = settings.smtp_port or 587
            try:
                if getattr(settings, 'use_gmail_for_send', False) and getattr(settings, 'gmail_access_token', None) and getattr(settings, 'gmail_refresh_token', None):
                    from app.services.gmail_service import GmailService
                    gmail_service = GmailService(settings.gmail_access_token, settings.gmail_refresh_token)
                    gmail_service.send_email(contact.email, subject, body, attachment_data=attachment_data if has_attachment else None, attachment_filename=resume.filename if has_attachment else None)
                    success_msg = f"Successfully sent cold mail to {contact.email} via Gmail"
                else:
                    server = smtplib.SMTP(settings.smtp_server, port)
                    server.starttls()
                    server.login(settings.smtp_username, settings.smtp_password)
                    server.send_message(msg)
                    server.quit()
                    success_msg = f"Successfully sent cold mail to {contact.email} via SMTP"
                
                log_succ = ActionLog(user_id=user_id, action_type="cold_mail", status="success", message=success_msg)
                db.add(log_succ)
                await db.commit()
                logger.info(success_msg)
            except Exception as e:
                logger.error(f"SMTP sending failed: {e}")
                log_err = ActionLog(user_id=user_id, action_type="cold_mail", status="failed", message=f"SMTP Failed: {str(e)}")
                db.add(log_err)
                await db.commit()

        except Exception as e:
            logger.exception(f"Cold mail engine failed: {e}")
            log_sys_err = ActionLog(user_id=user_id, action_type="cold_mail", status="failed", message=f"System Failed: {str(e)}")
            db.add(log_sys_err)
            await db.commit()

@celery_app.task(name="run_cold_mail_task")
def run_cold_mail_task(user_id: int, contact_id: int, template_id: int, resume_id: int):
    asyncio.run(run_cold_mail_async(user_id, contact_id, template_id, resume_id))

async def run_automated_discovery_async():
    """
    Hands-off scheduled task to constantly scrape predefined boards and grow the global database.
    Since this is automated globally, we'll arbitrarily use the first admin/system user's API key.
    """
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Starting Daily Automated Job Discovery")
            
            # Get an active user with Gemini Key (System/Admin) to use as a fallback identifier
            # (Though we no longer strictly need the key for localized scraping)
            stmt = select(UserSetting)
            settings = (await db.execute(stmt)).scalars().first()

            TARGET_URLS = [
                "https://remoteok.com/remote-software-engineer-jobs",
                "https://news.ycombinator.com/jobs"
            ]

            headers = {'User-Agent': 'Mozilla/5.0'}
            total_added = 0
            
            import re
            
            for url in TARGET_URLS:
                try:
                    response = requests.get(url, headers=headers, timeout=15)
                    soup = BeautifulSoup(response.content, 'lxml')
                    
                    dataList = []
                    
                    # Localized DOM Parsing Heuristics
                    job_elements = soup.find_all(['h2', 'h3', 'a', 'td', 'div'], string=re.compile(r'(Engineer|Developer|Manager|Designer|Lead|Data|Scientist)', re.I))
                    
                    for el in job_elements[:15]:
                        title = el.get_text(strip=True)
                        if len(title) > 5 and len(title) < 100: # reasonable title length
                            dataList.append({
                                "title": title,
                                "company": "Discovered via Localized Discovery",
                                "location": "Remote",
                                "description": "Autodiscovered role using local DOM scraping.",
                                "source_url": url
                            })
                            
                    
                    for item in dataList:
                        title = item.get("title", "Unknown")
                        company = item.get("company", "Unknown")
                        description = item.get("description", "")
                        combined_text = f"Title: {title}\nCompany: {company}\nDescription: {description}"
                        from app.services.job_ingestion import model as sentence_model
                        embedding = sentence_model.encode(combined_text).tolist()

                        job = JobPosting(
                            source="auto_discovery",
                            title=title,
                            company=company,
                            location=item.get("location"),
                            description=description,
                            embedding=embedding,
                            source_url=item.get("source_url", url)
                        )
                        db.add(job)
                    
                    await db.commit()
                    total_added += len(dataList)
                    logger.info(f"Automated discovery scraped {len(dataList)} jobs from {url}")
                except Exception as loop_e:
                    logger.warning(f"Failed to scrape {url} during automated discovery: {loop_e}")

            logger.info(f"Daily Automated Discovery complete. Added {total_added} global jobs.")
            
        except Exception as e:
            logger.exception(f"Automated Job Discovery failed: {e}")

@celery_app.task(name="run_automated_discovery_task")
def run_automated_discovery_task():
    asyncio.run(run_automated_discovery_async())

async def run_daily_match_alerts_async():
    """
    Evaluates new jobs against all users' resumes and sends a custom digest.
    """
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Starting Daily Match Alerts execution.")
            yesterday = datetime.utcnow() - timedelta(days=1)
            
            # Fetch all new jobs
            stmt = select(JobPosting).where(JobPosting.created_at >= yesterday)
            new_jobs = (await db.execute(stmt)).scalars().all()
            if not new_jobs:
                logger.info("No new jobs to match today.")
                return
                
            # Fetch all users
            users = (await db.execute(select(User))).scalars().all()
            
            for user in users:
                try:
                    # Get user settings
                    settings = (await db.execute(select(UserSetting).where(UserSetting.user_id == user.id))).scalars().first()
                    if not settings or not settings.gemini_api_keys or not settings.smtp_server:
                        continue
                        
                    # Get their resumes
                    resumes = (await db.execute(select(Resume).where(Resume.user_id == user.id))).scalars().all()
                    if not resumes: continue
                    
                    import numpy as np
                    
                    # Stage 1: Vector-Based Fast Retrieval (Top 20)
                    user_embedding = None
                    if resumes and resumes[0].embedding:
                        user_embedding = np.array(resumes[0].embedding)
                    
                    shortlisted_jobs = new_jobs
                    
                    if user_embedding is not None and len(new_jobs) > 0:
                        job_scores = []
                        for j in new_jobs:
                            if j.embedding:
                                j_emb = np.array(j.embedding)
                                # Cosine similarity
                                similarity = np.dot(user_embedding, j_emb) / (np.linalg.norm(user_embedding) * np.linalg.norm(j_emb))
                                job_scores.append((similarity, j))
                            else:
                                job_scores.append((0.0, j))
                        
                        job_scores.sort(key=lambda x: x[0], reverse=True)
                        shortlisted_jobs = [item[1] for item in job_scores[:20]]
                    else:
                        shortlisted_jobs = new_jobs[:20]

                    # Consolidate their resume text
                    full_resume_text = "\n".join([r.raw_text for r in resumes if r.raw_text])[:20000]
                    if not full_resume_text: continue
                    
                    # Stage 2: Local Heuristic Reranking
                    import spacy
                    try:
                        nlp = spacy.load("en_core_web_sm")
                    except OSError:
                        nlp = spacy.blank("en")
                        
                    doc_resume = nlp(full_resume_text.lower())
                    resume_keywords = {token.lemma_ for token in doc_resume if not token.is_stop and token.is_alpha}
                    
                    final_matches = []
                    
                    for job in shortlisted_jobs:
                        doc_job = nlp((job.title + " " + job.description).lower()[:5000])
                        job_keywords = {token.lemma_ for token in doc_job if not token.is_stop and token.is_alpha}
                        
                        if not job_keywords:
                            overlap_ratio = 0
                        else:
                            overlap_ratio = len(resume_keywords.intersection(job_keywords)) / float(len(job_keywords))
                        
                        if overlap_ratio > 0.15: # Minimum 15% overlap required
                            final_matches.append({
                                "job_id": job.id,
                                "match_score": overlap_ratio * 100,
                                "why_it_matches": f"Strong semantic alignment with {int(overlap_ratio * 100)}% keyword overlap."
                            })
                            
                    final_matches.sort(key=lambda x: x["match_score"], reverse=True)
                    matches = final_matches[:5]
                    
                    if not matches:
                        continue
                        
                    # Build email
                    html_body = f"<h2>Your Daily Job Matches ({datetime.now().strftime('%b %d')})</h2>"
                    html_body += "<p>Our Autonomous Discovery agent found these roles tailored to your profile:</p><ul>"
                    
                    for match in matches:
                        job_id = match.get("job_id")
                        reason = match.get("why_it_matches")
                        job = next((j for j in new_jobs if j.id == job_id), None)
                        if job:
                            html_body += f"<li><strong>{job.company} - {job.title}</strong>: {reason}<br><a href='{job.source_url}'>View Details</a></li>"
                            
                    html_body += "</ul><p>Login to your framework dashboard to dispatch the Auto-Apply Agent.</p>"

                    # Send Email
                    msg = MIMEMultipart('alternative')
                    msg['From'] = settings.smtp_username
                    msg['To'] = user.email
                    msg['Subject'] = f"Top {len(matches)} AI-Scored Job Matches"
                    msg.attach(MIMEText(html_body, 'html'))
                    
                    port = settings.smtp_port or 587
                    server = smtplib.SMTP(settings.smtp_server, port)
                    server.starttls()
                    server.login(settings.smtp_username, settings.smtp_password)
                    server.send_message(msg)
                    server.quit()
                    
                    logger.info(f"Sent daily match alert to {user.email}")
                    
                except Exception as loop_e:
                    logger.warning(f"Failed to process daily alerts for user {user.id}: {loop_e}")

            logger.info("Daily Match Alerts completed.")
            
        except Exception as e:
            logger.exception(f"Daily match alerts failed: {e}")

@celery_app.task(name="run_daily_match_alerts_task")
def run_daily_match_alerts_task():
    asyncio.run(run_daily_match_alerts_async())

async def run_user_configured_scraping_async():
    """
    Periodic task to scrape user-configured URLs.
    Checks UserSetting for 'scrape_urls' and kicks off individual scraping tasks.
    """
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Starting periodic user-configured scraping check.")
            
            stmt = select(UserSetting).where(UserSetting.scrape_urls.is_not(None))
            settings_list = (await db.execute(stmt)).scalars().all()
            
            total_tasks_queued = 0
            for setting in settings_list:
                if not setting.scrape_urls:
                    continue
                
                # Check frequency based on setting.scrape_frequency_hours.
                # For a full implementation, we'd need a last_scraped_at timestamp in UserSetting.
                # For now, we queue jobs for all valid URLs.
                urls = setting.scrape_urls if isinstance(setting.scrape_urls, list) else []
                for url in urls:
                    run_scraping_agent_task.delay(setting.user_id, url, "jobs")
                    total_tasks_queued += 1
                    
            logger.info(f"Queued {total_tasks_queued} user scraping tasks.")
        except Exception as e:
            logger.exception(f"Failed to queue user configured scraping tasks: {e}")

@celery_app.task(name="run_user_configured_scraping_task")
def run_user_configured_scraping_task():
    asyncio.run(run_user_configured_scraping_async())

async def run_scheduled_cold_mail_async():
    """
    Periodic task to automatically send cold emails to new contacts for users who opted in.
    """
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Starting scheduled cold mail cycle.")
            
            stmt = select(UserSetting).where(UserSetting.cold_mail_automation_enabled == True)
            active_settings = (await db.execute(stmt)).scalars().all()
            
            for setting in active_settings:
                # Basic throttle tracking can be added here
                limit = getattr(setting, 'daily_cold_mail_limit', 5)
                
                # Find unsent contacts
                # In robust approach, we'd check action_logs or a "emailed_at" field.
                # Assuming basic fallback if model lacks it
                limit_stmt = select(ScrapedContact).limit(limit)
                contacts = (await db.execute(limit_stmt)).scalars().all()
                if not contacts:
                    continue
                
                # Pick best template & resume randomly or via fast logic (LLM selection inside the task takes too long for the loop, queue individual selections instead)
                default_template = (await db.execute(select(EmailTemplate).limit(1))).scalars().first()
                default_resume = (await db.execute(select(Resume).where(Resume.user_id == setting.user_id).limit(1))).scalars().first()
                
                if default_template and default_resume:
                    for contact in contacts:
                        run_cold_mail_task.delay(setting.user_id, contact.id, default_template.id, default_resume.id)
                        
            logger.info("Finished scheduling cold mail cycle.")
        except Exception as e:
            logger.exception(f"Scheduled cold mail failed: {e}")

@celery_app.task(name="run_scheduled_cold_mail_task")
def run_scheduled_cold_mail_task():
    asyncio.run(run_scheduled_cold_mail_async())
