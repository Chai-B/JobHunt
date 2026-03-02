import re
from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from loguru import logger

from app.api import deps
from app.db.models.user import User
from app.schemas.extract import ExtractRequest, ExtractResponse, ExtractedEntity
from app.services.spiders import get_nlp, is_job_title

router = APIRouter()

# Common free email providers — domain extraction from these is meaningless
_FREE_EMAIL_DOMAINS = frozenset({
    "gmail", "outlook", "hotmail", "yahoo", "protonmail", "aol", "icloud",
    "mail", "zoho", "yandex", "live", "msn", "fastmail", "tutanota",
})

# Expanded role keywords for heuristic detection
_ROLE_KEYWORDS = frozenset({
    "recruiter", "hr", "manager", "engineer", "developer", "founder", "ceo",
    "vp", "lead", "director", "designer", "analyst", "scientist", "architect",
    "consultant", "coordinator", "specialist", "intern", "associate", "president",
    "cto", "cfo", "coo", "partner", "advisor", "head", "principal", "senior",
    "staff", "professor", "researcher", "product", "program", "marketing",
    "sales", "executive", "officer", "talent", "acquisition",
})

_EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')


def _detect_delimiter(line: str) -> str | None:
    """Detect the most likely delimiter in a line."""
    # Priority: tab > pipe > comma > multi-space
    if '\t' in line:
        return '\t'
    if '|' in line:
        return '|'
    # Comma — but only if it's not inside an email address
    email_stripped = _EMAIL_RE.sub('', line)
    if ',' in email_stripped:
        return ','
    if '    ' in line:
        return r'\s{2,}'
    return None


def _split_line(line: str, delimiter: str | None) -> list[str]:
    """Split a line by the detected delimiter."""
    if not delimiter:
        return [line.strip()]
    if delimiter == r'\s{2,}':
        return [p.strip() for p in re.split(r'\s{2,}', line) if p.strip()]
    return [p.strip() for p in line.split(delimiter) if p.strip()]


def _is_garbage_name(name: str) -> bool:
    """Check if a name string is likely garbage (URL, digits, too long)."""
    if not name:
        return True
    name = name.strip()
    if len(name) > 40 or len(name) < 2:
        return True
    if any(char.isdigit() for char in name):
        return True
    if any(x in name.lower() for x in [".com", "http", "www.", "@", ".org", ".io"]):
        return True
    return False


def _is_garbage_company(company: str) -> bool:
    """Check if a company string is likely garbage."""
    if not company:
        return True
    company = company.strip()
    if len(company) > 60 or len(company) < 2:
        return True
    if any(x in company.lower() for x in ["http://", "https://", "www."]):
        return True
    return False


def _detect_role_from_text(text: str) -> str:
    """Try to detect a role/title from a text chunk using keyword matching."""
    words = text.lower().split()
    for i, word in enumerate(words):
        clean = word.strip(",.;:-()[]")
        if clean in _ROLE_KEYWORDS:
            # Build a reasonable title: take up to 3 surrounding words
            start = max(0, i - 1)
            end = min(len(words), i + 3)
            return " ".join(words[start:end]).strip(",.;:-()[]").title()
    return ""


def _extract_company_from_domain(email: str) -> str:
    """Extract a company name from an email domain if it's not a free provider."""
    domain = email.split('@')[1].split('.')[0].lower()
    if domain in _FREE_EMAIL_DOMAINS:
        return ""
    return domain.capitalize()


def _calculate_confidence(email: str, name: str, company: str, role: str) -> float:
    """Calculate extraction confidence based on filled fields."""
    score = 0.3  # Base score for having a valid email
    if name:
        score += 0.25
    if company:
        score += 0.25
    if role:
        score += 0.2
    return round(min(score, 1.0), 2)


@router.post("/", response_model=ExtractResponse)
async def extract_from_text(
    *,
    req: ExtractRequest,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Universal text extractor supporting multiple delimiter formats:
    tab, pipe, comma, multi-space, and unstructured text.
    
    Uses email as an anchor point and infers surrounding columns.
    Falls back to spaCy NLP for unstructured text.
    """
    raw_lines = req.text.strip().split('\n')
    
    # Filter header rows and empty lines
    lines = []
    for L in raw_lines:
        stripped = L.strip()
        if not stripped:
            continue
        lower = stripped.lower()
        # Skip common header patterns
        if any(lower.startswith(h) for h in ['email\t', 'email,', 'email|', 'email name', 'name\t', 'name,']):
            continue
        if lower in ('email', 'name', 'company', 'role', 'title'):
            continue
        lines.append(stripped)
    
    entities = []
    seen_emails: set[str] = set()
    nlp = get_nlp()
    
    # Auto-detect delimiter from the first few lines that contain emails
    detected_delimiter = None
    for line in lines[:10]:
        if _EMAIL_RE.search(line):
            detected_delimiter = _detect_delimiter(line)
            if detected_delimiter:
                break
    
    for line in lines:
        email_match = _EMAIL_RE.search(line)
        if not email_match:
            continue
            
        email = email_match.group().lower()
        
        # Deduplicate
        if email in seen_emails:
            continue
        seen_emails.add(email)
        
        name = ""
        company = ""
        role = ""
        
        # Split line into parts using auto-detected delimiter
        parts = _split_line(line, detected_delimiter)
        
        if len(parts) >= 2:
            # Find which part contains the email
            email_idx = -1
            for i, p in enumerate(parts):
                if email in p.lower():
                    email_idx = i
                    break
            
            if email_idx != -1:
                # Gather non-email parts
                other_parts = [p for i, p in enumerate(parts) if i != email_idx and p.strip()]
                
                # Use heuristics to assign fields based on content analysis
                for part in other_parts:
                    part_clean = part.strip()
                    if not part_clean:
                        continue
                    
                    # Check if this part looks like a role
                    if not role and any(kw in part_clean.lower() for kw in _ROLE_KEYWORDS):
                        role = part_clean
                        continue
                    
                    # Check if this part looks like a company (usually title-case or all-caps, no spaces like names)
                    # Companies tend to have fewer spaces/words than names
                    if not company and not _is_garbage_company(part_clean):
                        # Heuristic: if it's one word or contains Inc/LLC/Ltd/Corp, it's a company
                        if any(x in part_clean for x in ["Inc", "LLC", "Ltd", "Corp", "Co.", "GmbH", "Technologies", "Solutions"]):
                            company = part_clean
                            continue
                    
                    # Default: assign to name first, then company, then role
                    if not name and not _is_garbage_name(part_clean):
                        name = part_clean
                    elif not company and not _is_garbage_company(part_clean):
                        company = part_clean
                    elif not role:
                        role = part_clean
        
        # NLP fallback for missing fields
        if not name or not company:
            try:
                doc = nlp(line)
                for ent in doc.ents:
                    if ent.label_ == "PERSON" and not name:
                        candidate = ent.text.strip()
                        if '@' not in candidate and not _is_garbage_name(candidate):
                            name = candidate
                    elif ent.label_ == "ORG" and not company:
                        candidate = ent.text.strip()
                        if not _is_garbage_company(candidate):
                            company = candidate
            except Exception:
                pass
        
        # Role detection fallback
        if not role:
            role = _detect_role_from_text(line)
        
        # Company fallback from email domain
        if not company:
            company = _extract_company_from_domain(email)
        
        # Must have at least email + company to be a useful lead
        if not company:
            continue
        
        # Final cleanup
        name = name.strip() if name else None
        company = company.strip()
        role = role.strip() if role else None
        
        confidence = _calculate_confidence(email, name or "", company, role or "")
        
        entities.append(
            ExtractedEntity(
                type="contact",
                confidence=confidence,
                data={
                    "email": email,
                    "name": name,
                    "company": company,
                    "role": role,
                }
            )
        )

    return ExtractResponse(entities=entities)
