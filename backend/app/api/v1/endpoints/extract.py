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
    lines = [L.strip() for L in req.text.split('\n') if L.strip() and not L.startswith('Email\tName')]
    entities = []
    nlp = get_nlp()
    
    for line in lines:
        # Detect separators: Tab is most common for copy-paste from sheets
        parts = []
        if '\t' in line:
            parts = [p.strip() for p in line.split('\t') if p.strip()]
        elif '    ' in line: # Multiple spaces
            parts = [p.strip() for p in re.split(r'\s{2,}', line) if p.strip()]
            
        email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', line)
        if not email_match:
            continue
            
        email = email_match.group()
        name = ""
        company = ""
        role = ""
        
        # If we have structured parts, use positional logic (heuristics based on user sample)
        # User Sample: Email [tab] Company [tab] Name [tab] Role
        if len(parts) >= 2:
            # Check if first part is email
            if email in parts[0]:
                if len(parts) >= 2: company = parts[1]
                if len(parts) >= 3: name = parts[2]
                if len(parts) >= 4: role = parts[3]
            else:
                # Find email index
                idx = next((i for i, p in enumerate(parts) if email in p), -1)
                if idx != -1:
                    # Look around email
                    if idx + 1 < len(parts): company = parts[idx+1]
                    if idx + 2 < len(parts): name = parts[idx+2]
                    if idx + 3 < len(parts): role = parts[idx+3]

        # NLP Fallback for missing fields or unstructured lines
        if not company or not name:
            doc = nlp(line)
            for ent in doc.ents:
                if ent.label_ == "PERSON" and not name:
                    # Ensure person name doesn't contain @ (not an email)
                    if '@' not in ent.text: name = ent.text.strip()
                elif ent.label_ == "ORG" and not company:
                    company = ent.text.strip()
                    
        # Role Detection Heuristics (if still missing)
        if not role:
            role_keywords = ["Recruiter", "HR", "Manager", "Engineer", "Developer", "Founder", "CEO", "VP", "Lead"]
            for part in parts:
                if any(kw.lower() in part.lower() for kw in role_keywords):
                    role = part
                    break

        # Mandatory Field Enforcement: Company fallback from domain
        if not company:
            domain = email.split('@')[1].split('.')[0].capitalize()
            if domain not in ["Gmail", "Outlook", "Hotmail", "Yahoo", "Protonmail"]:
                company = domain

        # Final Clean-up: If still no company, this row is likely low value/invalid
        if not email or not company:
            continue

        entities.append(
            ExtractedEntity(
                type="contact",
                confidence=0.95,
                data={
                    "email": email,
                    "name": name or None,
                    "company": company,
                    "role": role or None,
                }
            )
        )

    return ExtractResponse(entities=entities)
