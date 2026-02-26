import re
from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from loguru import logger

from app.api import deps
from app.db.models.user import User
from app.schemas.extract import ExtractRequest, ExtractResponse, ExtractedEntity
from app.services.spiders import get_nlp, is_job_title

router = APIRouter()

@router.post("/", response_model=ExtractResponse)
async def extract_from_text(
    *,
    req: ExtractRequest,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    lines = [L.strip() for L in text.split('\n') if L.strip() and not L.startswith('Email\tName')]
    entities = []
    nlp = get_nlp()
    
    # Pre-process for global entities if text is short, but prioritize row-based
    is_mostly_rows = any('\t' in line or '::' in line or len(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', line)) > 0 for line in lines[:5])

    for line in lines:
        # 1. Contact Extraction per row
        email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', line)
        linkedin_match = re.search(r'https?://(?:www\.)?linkedin\.com/in/[\w-]+', line)
        
        if email_match or linkedin_match:
            doc = nlp(line)
            name = ""
            company = ""
            
            for ent in doc.ents:
                if ent.label_ == "PERSON" and not name:
                    name = ent.text.strip()
                elif ent.label_ == "ORG" and not company:
                    company = ent.text.strip()
            
            # Sanitization: Fix common NER mistakes for Name/Company
            if name and (is_job_title(name) or "@" in name or "." in name):
                name = ""
            
            # Fallback for Company if missing
            if not company and email_match:
                domain = email_match.group().split('@')[1].split('.')[0].capitalize()
                if domain not in ["Gmail", "Outlook", "Hotmail", "Yahoo", "Protonmail"]:
                    company = domain

            data = {
                "email": email_match.group() if email_match else None,
                "linkedin": linkedin_match.group() if linkedin_match else None,
                "name": name or None,
                "company": company or None,
            }
            
            if data["email"] or data["linkedin"]:
                entities.append(
                    ExtractedEntity(
                        type="contact",
                        confidence=0.95 if data["email"] and data["company"] else 0.7,
                        data=data
                    )
                )
            continue

        # 2. Job Posting Detection (only for blocks that don't look like contact rows)
        if len(line) > 50 and (is_job_title(line) or "requirements" in text.lower()):
            doc = nlp(line[:500])
            company = ""
            location = ""
            for ent in doc.ents:
                if ent.label_ == "ORG" and not company:
                    company = ent.text.strip()
                elif ent.label_ in ("GPE", "LOC") and not location:
                    location = ent.text.strip()
            
            entities.append(
                ExtractedEntity(
                    type="job",
                    confidence=0.8,
                    data={
                        "title": line[:200],
                        "company": company or "Unknown",
                        "location": location or "Not specified",
                        "description": text[:1000]
                    }
                )
            )

    return ExtractResponse(entities=entities)
