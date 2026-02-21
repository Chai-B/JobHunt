import asyncio
from loguru import logger
from sqlalchemy import select

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

def _find_job_containers(soup):
    """Find job listing containers by common CSS class patterns."""
    jobs = []
    seen = set()
    selectors = [
        ('div', {'class': _re.compile(r'job|posting|listing|position|vacancy|career|opening', _re.I)}),
        ('li', {'class': _re.compile(r'job|posting|listing|position|vacancy|career|opening', _re.I)}),
        ('article', {}),
        ('tr', {'class': _re.compile(r'job|posting|listing|position', _re.I)}),
    ]
    for tag, attrs in selectors:
        for el in soup.find_all(tag, attrs, limit=50):
            title_el = el.find(['h1', 'h2', 'h3', 'h4', 'a'])
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 5 or len(title) > 200:
                continue
            tk = title.lower().strip()
            if tk in seen:
                continue
            seen.add(tk)
            full_text = el.get_text(separator=' ', strip=True)
            company, location = "Unknown", "Not specified"
            for sub in el.find_all(['span', 'div', 'p', 'small'], limit=10):
                sub_text, cls = sub.get_text(strip=True), ' '.join(sub.get('class', []))
                if _re.search(r'company|employer|org', cls, _re.I) and sub_text:
                    company = sub_text[:100]
                elif _re.search(r'location|city|place|region', cls, _re.I) and sub_text:
                    location = sub_text[:100]
            if company == "Unknown":
                for sub in el.find_all(['span', 'p', 'div', 'small'], limit=8):
                    s = sub.get_text(strip=True)
                    if s and s != title and 3 < len(s) < 60 and not _re.search(r'(apply|submit|save|ago|posted)', s, _re.I):
                        company = s; break
            jobs.append({"title": title, "company": company, "location": location,
                         "description": full_text[:500] or title})
    return jobs

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

def _parse_generic_jobs(soup, url: str):
    """Enhanced generic parser: JSON-LD → container patterns → heading heuristics."""
    all_jobs = []
    all_jobs.extend(_parse_json_ld_jobs(soup))
    if len(all_jobs) < 5:
        existing = {j['title'].lower().strip() for j in all_jobs}
        for j in _find_job_containers(soup):
            if j['title'].lower().strip() not in existing:
                all_jobs.append(j); existing.add(j['title'].lower().strip())
    if len(all_jobs) < 3:
        seen = {j['title'].lower().strip() for j in all_jobs}
        for el in soup.find_all(['h1', 'h2', 'h3', 'h4', 'a'], limit=100):
            title = el.get_text(strip=True)
            if not title or len(title) < 8 or len(title) > 200: continue
            tk = title.lower().strip()
            if tk in seen: continue
            if not _re.search(r'(engineer|developer|manager|designer|lead|scientist|analyst|architect|specialist|director|intern|consultant|backend|frontend|full.?stack|devops|data|product|marketing|sales|support|qa|writer|recruiter)', title, _re.I): continue
            seen.add(tk)
            parent = el.find_parent(['div', 'li', 'article', 'section', 'tr'])
            desc, company = "", ""
            if parent:
                desc = parent.get_text(separator=' ', strip=True)[:300]
                for sib in parent.find_all(['span', 'p', 'small', 'div'], limit=5):
                    s = sib.get_text(strip=True)
                    if s and s != title and len(s) < 60 and not _re.search(r'(Apply|Submit|Save|Posted|ago)', s, _re.I):
                        company = s; break
            all_jobs.append({"title": title, "company": company or "Unknown",
                             "location": "Not specified", "description": desc or title})
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
            
            response = _fetch_page(target_url)
            soup = BeautifulSoup(response.content, 'lxml')
            dataList = []
            
            if target_type == "jobs":
                url_lower = target_url.lower()
                if 'remoteok.com' in url_lower:
                    dataList = _parse_remoteok_jobs(soup)
                elif 'news.ycombinator.com' in url_lower or 'ycombinator.com/jobs' in url_lower:
                    dataList = _parse_hackernews_jobs(soup)
                elif 'weworkremotely.com' in url_lower:
                    dataList = _parse_weworkremotely_jobs(soup)
                else:
                    dataList = _parse_generic_jobs(soup, target_url)
                
                # If few results, crawl linked job pages
                if len(dataList) < 5:
                    sub_urls = _crawl_for_job_links(soup, target_url)
                    existing_t = {j['title'].lower().strip() for j in dataList}
                    for sub_url in sub_urls[:5]:
                        try:
                            sub_resp = _fetch_page(sub_url, retries=1, timeout=10)
                            sub_soup = BeautifulSoup(sub_resp.content, 'lxml')
                            for j in _parse_generic_jobs(sub_soup, sub_url):
                                if j['title'].lower().strip() not in existing_t:
                                    j['source_url'] = sub_url
                                    dataList.append(j)
                                    existing_t.add(j['title'].lower().strip())
                        except Exception:
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
                    db.add(JobPosting(source="scraper", title=item.get("title", "Unknown"),
                                     company=item.get("company", "Unknown"), location=item.get("location"),
                                     description=item.get("description", ""),
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
            model = genai.GenerativeModel('gemini-1.5-pro') # Using Pro for complex reasoning
            
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
                
            form_payload = json.loads(raw_json_str)
            
            # Simulate dispatch
            logger.info(f"Generated auto-apply payload for app {app_id}")
            
            app_record.status = "submitted"
            app_record.notes = json.dumps(form_payload, indent=2)
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

            if not settings.gemini_api_keys:
                logger.error("No Gemini key configured for cold mail personalization.")
                return
                
            if not settings.smtp_server or not settings.smtp_username or not settings.smtp_password:
                logger.error("Missing SMTP Configuration in User Settings.")
                return

            # Add Gemini customization
            api_key = settings.gemini_api_keys.split(",")[0].strip()
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            user_profile = f"Name: {user.full_name}, Bio: {user.bio} LinkedIn: {user.linkedin_url}"
            resume_text = resume.raw_text[:15000] if resume.raw_text else ""
            
            prompt = f"""
            Personalize this generic email template for the recipient.
            
            RECIPIENT CONTACT:
            Name: {contact.name or 'Unknown'}
            Role: {contact.role or 'Unknown'}
            Company: {contact.company or 'Unknown'}
            
            SENDER PROFILE:
            {user_profile}
            Resume Text: {resume_text}
            
            TEMPLATE SUBJECT: {template.subject}
            TEMPLATE BODY: {template.body_text}
            
            Instructions:
            1. Replace all placeholders in the template with actual details.
            2. Sound professional, natural, and persuasive.
            3. Keep the spirit of the original template.
            
            Output strictly as JSON:
            {{
                "subject": "Personalized Subject Line",
                "body": "Personalized email body text formatted nicely with linebreaks"
            }}
            """
            
            ai_response = model.generate_content(prompt)
            raw_json_str = ai_response.text
            if raw_json_str.startswith('```json'):
                raw_json_str = raw_json_str.split('```json')[1].split('```')[0].strip()
            elif raw_json_str.startswith('```'):
                raw_json_str = raw_json_str.split('```')[1].split('```')[0].strip()
                
            email_data = json.loads(raw_json_str)
            
            # Send via SMTP
            msg = MIMEMultipart()
            msg['From'] = settings.smtp_username
            msg['To'] = contact.email
            msg['Subject'] = email_data["subject"]
            msg.attach(MIMEText(email_data["body"], 'plain'))
            
            port = settings.smtp_port or 587
            try:
                server = smtplib.SMTP(settings.smtp_server, port)
                server.starttls()
                server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(msg)
                server.quit()
                
                log_succ = ActionLog(user_id=user_id, action_type="cold_mail", status="success", message=f"Successfully dispatched cold mail to {contact.email}")
                db.add(log_succ)
                await db.commit()
                logger.info(f"Successfully sent cold mail to {contact.email}")
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
                        job = JobPosting(
                            source="auto_discovery",
                            title=item.get("title", "Unknown"),
                            company=item.get("company", "Unknown"),
                            location=item.get("location"),
                            description=item.get("description", ""),
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
                    
                    # Consolidate their resume text
                    full_resume_text = "\n".join([r.raw_text for r in resumes if r.raw_text])[:20000]
                    if not full_resume_text: continue
                    
                    # Use Gemini to find matches
                    api_key = settings.gemini_api_keys.split(",")[0].strip()
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-1.5-flash')
                    
                    job_descriptions = "\n".join([f"[{j.id}] {j.title} at {j.company}: {j.description[:500]}" for j in new_jobs])
                    
                    prompt = f"""
                    You are an expert technical recruiter matching candidates to jobs.
                    
                    CANDIDATE RESUME:
                    {full_resume_text}
                    
                    NEW JOBS IN THE LAST 24H:
                    {job_descriptions}
                    
                    Task: Select the top 3 best matching jobs for this candidate.
                    Return ONLY a JSON array of objects. Each object should have:
                    - job_id (int)
                    - why_it_matches (1 short sentence)
                    
                    If NO jobs match their profile, return [].
                    """
                    
                    ai_res = model.generate_content(prompt)
                    raw_json_str = ai_res.text.strip()
                    if raw_json_str.startswith('```json'):
                        raw_json_str = raw_json_str.split('```json')[1].split('```')[0].strip()
                    elif raw_json_str.startswith('```'):
                        raw_json_str = raw_json_str.split('```')[1].split('```')[0].strip()
                        
                    matches = json.loads(raw_json_str)
                    
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
