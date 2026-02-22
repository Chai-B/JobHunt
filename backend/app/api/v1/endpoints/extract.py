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
    text = req.text
    if not text or len(text) < 10:
        return ExtractResponse(entities=[])
        
    entities = []
    
    # 1. Contact Extraction Heuristics
    email_matches = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    phone_matches = re.findall(r'(\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})', text)
    
    if email_matches or phone_matches:
        nlp = get_nlp()
        doc = nlp(text[:2000]) # Scan beginning for names
        name = ""
        company = ""
        
        for ent in doc.ents:
            if ent.label_ == "PERSON" and not name:
                name = ent.text.strip()
            elif ent.label_ == "ORG" and not company:
                company = ent.text.strip()
                
        # We classify this block as a Contact
        for email in set(email_matches):
            entities.append(
                ExtractedEntity(
                    type="contact",
                    confidence=0.9,
                    data={
                        "name": name,
                        "email": email,
                        "company": company,
                        "phone": phone_matches[0] if phone_matches else None
                    }
                )
            )
            
    # 2. Job Posting Extraction Heuristics
    # Check if this text structure looks like a job description
    lines = [L.strip() for L in text.split('\n') if L.strip()]
    if len(lines) > 5 and not email_matches:
        # It's a block of text without an email. Might be a job.
        candidate_title = lines[0]
        if is_job_title(candidate_title) or "requirements" in text.lower() or "responsibilities" in text.lower():
            nlp = get_nlp()
            doc = nlp(text[:2000])
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
                    confidence=0.85,
                    data={
                        "title": candidate_title[:200],
                        "company": company or "Unknown",
                        "location": location or "Not specified",
                        "description": text[:2000]
                    }
                )
            )
            
    return ExtractResponse(entities=entities)
