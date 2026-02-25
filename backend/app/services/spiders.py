import os
import re
import json
import logging
from typing import List, Dict, Any

try:
    from playwright.async_api import async_playwright
except ImportError:
    pass

import spacy
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Lazy load spaCy engine
_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy 'en_core_web_sm' missing. Run: python -m spacy download en_core_web_sm")
            _nlp = spacy.blank("en")
    return _nlp

def extract_entities(text: str) -> Dict[str, set]:
    """Extract Orgs and Locations using local ML NER"""
    nlp = get_nlp()
    # Spacy max length guard
    if len(text) > 100000:
        text = text[:100000]
    doc = nlp(text)
    orgs = set()
    locs = set()
    for ent in doc.ents:
        if ent.label_ == "ORG" and len(ent.text) > 2:
            orgs.add(ent.text.strip())
        elif ent.label_ in ("GPE", "LOC") and len(ent.text) > 2:
            locs.add(ent.text.strip())
    return {"orgs": orgs, "locs": locs}

def is_job_title(text: str) -> bool:
    """Fast local heuristic for detecting job titles."""
    text = text.lower().strip()
    if len(text) < 5 or len(text) > 80:
        return False
        
    keywords = [
        "engineer", "developer", "manager", "designer", "director", "specialist",
        "vp", "president", "associate", "analyst", "representative", "coordinator",
        "intern", "lead", "architect", "consultant", "technician", "administrator",
        "writer", "recruiter", "executive"
    ]
    return any(kw in text for kw in keywords)

async def scrape_jobs_headless(url: str, user_settings=None) -> List[Dict[str, Any]]:
    """
    Cost-free, high-speed local scraping sequence:
    1. Fast Playwright DOM snapshot
    2. Try Schema.org JSON-LD parsing (Industry Standard)
    3. Fallback to DOM traversal + spaCy local ML Entity Recognition
    NO LLM TOKEN USAGE.
    """
    jobs = []
    logger.info(f"Starting Local ML Scrape for: {url}")
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"])
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            
            # Block heavy assets for speed
            await context.route("**/*", lambda route: route.continue_() if route.request.resource_type in ["document", "script", "xhr", "fetch"] else route.abort())
            
            page = await context.new_page()
            response = await page.goto(url, wait_until="networkidle", timeout=30000)
            
            if not response or not response.ok:
                logger.error(f"Failed to load URL {url}: {response.status if response else 'No response'}")
                await browser.close()
                return jobs
                
            await page.wait_for_timeout(2000)
            content = await page.content()
            await browser.close()
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # --- STRATEGY 1: JSON-LD (Perfect Accuracy, 0 Cost) ---
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
                        if 'JobPosting' in item_type:
                            title = str(item.get('title') or item.get('name', '')).strip()
                            org = item.get('hiringOrganization', {})
                            company = str(org.get('name', '')) if isinstance(org, dict) else ''
                            
                            loc = item.get('jobLocation', {})
                            location = ''
                            if isinstance(loc, dict):
                                addr = loc.get('address', {})
                                if isinstance(addr, dict):
                                    location = str(addr.get('addressLocality', ''))
                            
                            desc = str(item.get('description', ''))
                            
                            if title:
                                jobs.append({
                                    "title": title[:200],
                                    "company": company[:200] or "Unknown Company",
                                    "location": location[:200] or "Not specified",
                                    "description": BeautifulSoup(desc, 'html.parser').get_text(separator=' ', strip=True)[:1000] if desc else title
                                })
                except Exception as eval_e:
                    logger.debug(f"JSON-LD pass skipped: {eval_e}")
                    
            if jobs:
                unique_jobs = {j['title'].lower(): j for j in jobs}.values()
                logger.info(f"Successfully extracted {len(unique_jobs)} via schema.org JSON-LD.")
                return list(unique_jobs)[:50]
                
            # --- STRATEGY 2: Local ML DOM Traversal (High Accuracy, 0 Cost) ---
            logger.info("JSON-LD failed. Falling back to Local ML (spaCy) DOM parser.")
            
            for element in soup.find_all(['a', 'h2', 'h3', 'li', 'div', 'article']):
                text = element.get_text(separator=" ", strip=True)
                
                if len(text) < 10 or len(text) > 800:
                    continue
                    
                parts = [p.strip() for p in text.split('\n') if p.strip()]
                if not parts:
                    continue
                    
                candidate_title = parts[0]
                if is_job_title(candidate_title):
                    entities = extract_entities(text)
                    
                    company = "Unknown Company"
                    location = "Not specified"
                    
                    if entities["orgs"]:
                        company = list(entities["orgs"])[0]
                    if entities["locs"]:
                        location = list(entities["locs"])[0]
                    elif "remote" in text.lower():
                        location = "Remote"
                        
                    jobs.append({
                        "title": candidate_title[:200],
                        "company": company[:200],
                        "location": location[:200],
                        "description": text[:1000]
                    })
                    
            unique_jobs = {j['title'].lower(): j for j in jobs}.values()
            logger.info(f"Successfully extracted {len(unique_jobs)} via local heuristics.")
            return list(unique_jobs)[:50]

    except Exception as e:
        logger.error(f"Playwright Scraper Error for {url}: {e}")
        return []
