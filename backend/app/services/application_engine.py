from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.models.application import Application

class ApplicationEngine:
    """
    Handles state transitions and safety constraints for the Auto-Apply system.
    """
    
    VALID_STATES = ["discovered", "shortlisted", "prepared", "submitted", "acknowledged", "responded", "closed"]
    
    # Define allowed forward transitions (strict state machine)
    ALLOWED_TRANSITIONS = {
        "discovered": ["shortlisted", "closed"],
        "shortlisted": ["prepared", "closed"],
        "prepared": ["submitted", "closed"],
        "submitted": ["acknowledged", "responded", "closed"],
        "acknowledged": ["responded", "closed"],
        "responded": ["closed"],
        "closed": ["shortlisted"] # Allow reopening
    }

    @staticmethod
    def validate_transition(current_status: str, new_status: str):
        if new_status not in ApplicationEngine.VALID_STATES:
            raise HTTPException(status_code=400, detail=f"Invalid state: {new_status}")
            
        if new_status not in ApplicationEngine.ALLOWED_TRANSITIONS.get(current_status, []):
            # We allow arbitrary moves backwards for manual overrides right now, 
            # but log a warning if it violates strict forward transitions.
            logger.warning(f"Non-standard transition from '{current_status}' to '{new_status}'")
            return False
            
        return True

    @staticmethod
    async def update_status(db: AsyncSession, app_record: Application, new_status: str) -> Application:
        """Safely transition application state."""
        
        # 1. Validation rule checks
        ApplicationEngine.validate_transition(app_record.status, new_status)
        
        # 2. Side Effects
        if new_status == "submitted" and app_record.status != "submitted":
            # Safety check: Prevent application if no resume attached (simulated constraint)
            if not app_record.resume_id:
                raise HTTPException(status_code=400, detail="Cannot submit without a selected resume")
            app_record.applied_at = datetime.now(timezone.utc)
            
        # 3. Apply
        logger.info(f"Application {app_record.id} transitioning {app_record.status} -> {new_status}")
        app_record.status = new_status
        db.add(app_record)
        await db.commit()
        await db.refresh(app_record)
        
        return app_record
