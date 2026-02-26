from typing import Any, List
import io
import csv
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi.responses import StreamingResponse
import pandas as pd

from app.api import deps
from app.db.models.user import User
from app.db.models.contact import ScrapedContact
from app.schemas.contact import ScrapedContactCreate, ScrapedContactRead
from loguru import logger

router = APIRouter()

@router.get("/", response_model=List[ScrapedContactRead])
async def list_contacts(
    db: AsyncSession = Depends(deps.get_personal_db),
    skip: int = 0,
    limit: int = 200,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    # We load contacts globally since ScrapedContact currently isn't user-specific,
    # but in a personal DB environment, this loads from their personal DB.
    res = await db.execute(select(ScrapedContact).order_by(ScrapedContact.created_at.desc()).offset(skip).limit(limit))
    return res.scalars().all()

@router.post("/", response_model=ScrapedContactRead)
async def create_contact(
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    contact_in: ScrapedContactCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    res = await db.execute(select(ScrapedContact).where(ScrapedContact.email == contact_in.email))
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Contact with this email already exists")
        
    db_obj = ScrapedContact(**contact_in.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.post("/bulk")
async def create_contacts_bulk(
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    contacts_in: List[ScrapedContactCreate],
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Bulk create contacts with deduplication."""
    if not contacts_in:
        return {"message": "No contacts provided", "saved": 0}
        
    # Get existing emails
    emails = [c.email for c in contacts_in]
    stmt = select(ScrapedContact.email).where(ScrapedContact.email.in_(emails))
    res = await db.execute(stmt)
    existing_emails = set(res.scalars().all())
    
    new_objs = []
    for c in contacts_in:
        if c.email not in existing_emails:
            new_objs.append(ScrapedContact(**c.model_dump()))
            existing_emails.add(c.email) # Avoid duplicates in the input list itself
            
    if new_objs:
        db.add_all(new_objs)
        await db.commit()
        
    return {"message": f"Successfully processed {len(contacts_in)} contacts", "saved": len(new_objs)}

@router.put("/{contact_id}", response_model=ScrapedContactRead)
async def update_contact(
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    contact_id: int,
    contact_in: ScrapedContactCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    res = await db.execute(select(ScrapedContact).where(ScrapedContact.id == contact_id))
    db_obj = res.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    update_data = contact_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
        
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.delete("/{contact_id}")
async def delete_contact(
    *,
    db: AsyncSession = Depends(deps.get_personal_db),
    contact_id: int,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    res = await db.execute(select(ScrapedContact).where(ScrapedContact.id == contact_id))
    db_obj = res.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    await db.delete(db_obj)
    await db.commit()
    return {"status": "success"}

@router.post("/import")
async def import_contacts(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_personal_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Import contacts via CSV or Excel"""
    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Invalid file format. Must be CSV or Excel.")
            
        # Standardize columns to lowercase, strip whitespace
        df.columns = [str(col).lower().strip() for col in df.columns]
        
        # Look for required 'email' column
        email_col = next((col for col in df.columns if 'email' in col), None)
        if not email_col:
            raise HTTPException(status_code=400, detail="Could not find an 'Email' column in the uploaded file.")
            
        # Optional columns mapping
        name_col = next((col for col in df.columns if 'name' in col), None)
        company_col = next((col for col in df.columns if 'company' in col or 'org' in col), None)
        role_col = next((col for col in df.columns if 'role' in col or 'title' in col), None)
        
        imported_count = 0
        skipped_count = 0
        
        # Load existing emails to deduplicate
        existing_emails = set()
        res = await db.execute(select(ScrapedContact.email))
        for row in res.scalars().all():
            existing_emails.add(row.lower().strip())
            
        new_contacts = []
        for _, row in df.iterrows():
            email = str(row[email_col]).strip().lower()
            if pd.isna(row[email_col]) or not email or '@' not in email:
                skipped_count += 1
                continue
                
            if email in existing_emails:
                skipped_count += 1
                continue
                
            contact_data = {
                "email": email,
                "name": str(row[name_col]).strip() if name_col and pd.notna(row[name_col]) else None,
                "company": str(row[company_col]).strip() if company_col and pd.notna(row[company_col]) else None,
                "role": str(row[role_col]).strip() if role_col and pd.notna(row[role_col]) else None,
                "source_url": "Imported File",
                "is_verified": False
            }
            new_contacts.append(ScrapedContact(**contact_data))
            existing_emails.add(email)
            imported_count += 1
            
        if new_contacts:
            db.add_all(new_contacts)
            await db.commit()
            
        return {"imported": imported_count, "skipped": skipped_count}
        
    except Exception as e:
        logger.error(f"Contact import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export")
async def export_contacts(
    db: AsyncSession = Depends(deps.get_personal_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Export all contacts as CSV"""
    res = await db.execute(select(ScrapedContact).order_by(ScrapedContact.created_at.desc()))
    contacts = res.scalars().all()
    
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["Name", "Email", "Role", "Company", "Verified", "Date Added"])
    
    for c in contacts:
        writer.writerow([
            c.name or "", 
            c.email, 
            c.role or "", 
            c.company or "", 
            "Yes" if c.is_verified else "No",
            c.created_at.strftime("%Y-%m-%d") if c.created_at else ""
        ])
        
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=contacts_export_{datetime.now().strftime('%Y%m%d')}.csv"
    return response
