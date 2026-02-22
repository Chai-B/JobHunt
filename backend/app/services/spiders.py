import os
import re
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional

try:
    from playwright.async_api import async_playwright
except ImportError:
    pass

import spacy
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Load spaCy NLP engine statically (lazy load)
_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model 'en_core_web_sm' not found. Ensure it was downloaded.")
            _nlp = spacy.blank("en") # fallback to blank tokenizer
    return _nlp

def extract_entities(text: str) -> Dict[str, set]:
    """Use spaCy NER to find orgs and locations from text block"""
    nlp = get_nlp()
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
    """Heuristics to identify if a short string is a likely job title"""
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

async def scrape_jobs_headless(url: str) -> List[Dict[str, Any]]:
    """
    Spins up Playwright, loads the JS-heavy career page, 
    and uses ML heuristics to extract job postings.
    """
    jobs = []
    logger.info(f"Starting headless scrape for: {url}")
    
    try:
        async with async_playwright() as p:
            # We use chromium, headless, and block media/images for speed
            browser = await p.chromium.launch(args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"])
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            
            # Block images and CSS
            await context.route("**/*", lambda route: route.continue_() if route.request.resource_type in ["document", "script", "xhr", "fetch"] else route.abort())
            
            page = await context.new_page()
            
            # Navigate and wait for network idle to ensure JS framework renders
            response = await page.goto(url, wait_until="networkidle", timeout=30000)
            
            if not response or not response.ok:
                logger.error(f"Failed to load URL {url}: {response.status if response else 'No response'}")
                await browser.close()
                return jobs
                
            # Allow a tiny bit more time for custom render loops
            await page.wait_for_timeout(2000)
            
            # Extract fully rendered HTML
            content = await page.content()
            await browser.close()
            
            # Parse HTML
            soup = BeautifulSoup(content, 'html.parser')
            
            # Strategy 1: JSON-LD (Always the best if it exists)
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
                                    "title": title,
                                    "company": company or "Unknown",
                                    "location": location or "Not specified",
                                    "description": BeautifulSoup(desc, 'html.parser').get_text(separator=' ', strip=True)[:500] if desc else title
                                })
                except Exception as e:
                    logger.debug(f"JSON-LD parse error: {e}")
                    
            if jobs:
                logger.info(f"Found {len(jobs)} jobs via JSON-LD on {url}")
                # Remove duplicates by title
                unique_jobs = {j['title'].lower(): j for j in jobs}.values()
                return list(unique_jobs)[:50]
                
            # Strategy 2: NLP/Heuristic DOM Traversal
            # Since JSON-LD failed, we parse tags (a, h2, h3, li, div) that look like job cards
            logger.info("Falling back to DOM Heuristics + NLP")
            
            # Finding typical job card containers
            for element in soup.find_all(['a', 'h2', 'h3', 'li', 'div']):
                text = element.get_text(separator=" ", strip=True)
                
                # Fast regex bailout
                if len(text) < 5 or len(text) > 300:
                    continue
                    
                # Often the element itself is the title, or it's a card containing title + location
                # We check the first distinct string
                parts = [p.strip() for p in text.split('\n') if p.strip()]
                if not parts:
                    continue
                    
                candidate_title = parts[0]
                if is_job_title(candidate_title):
                    # We found a job card! Let's use NLP on the whole text block to identify company/loc
                    entities = extract_entities(text)
                    
                    company = "Unknown"
                    location = "Not specified"
                    
                    if entities["orgs"]:
                        # Pick the first org, assuming it's the hiring company
                        company = list(entities["orgs"])[0]
                    if entities["locs"]:
                        location = list(entities["locs"])[0]
                    elif "remote" in text.lower():
                        location = "Remote"
                        
                    jobs.append({
                        "title": candidate_title[:200],
                        "company": company,
                        "location": location,
                        "description": text[:500]
                    })
                    
            # Deduplicate heuristics
            unique_jobs = {j['title'].lower(): j for j in jobs}.values()
            return list(unique_jobs)[:50]

    except Exception as e:
        logger.error(f"Playwright Scraper Error for {url}: {e}")
        return []
