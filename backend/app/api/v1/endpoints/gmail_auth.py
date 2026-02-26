from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.deps import get_current_user, reusable_oauth2
from app.db.models.user import User
from app.db.models.setting import UserSetting
from app.core.config import settings
import google_auth_oauthlib.flow
from loguru import logger
from sqlalchemy import select
import os

# Google strictly injects 'openid' and profile scopes on authorization.
# We must disable oauthlib's strict scope equivalence checks to prevent 400 Bad Requests.
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

router = APIRouter()

SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
]

@router.get("/connect")
async def connect_gmail(request: Request, current_user: User = Depends(get_current_user), token: str = Depends(reusable_oauth2)):
    """
    Initiates the OAuth flow to connect a Gmail account.
    Returns the authorization URL.
    """
    if not hasattr(settings, "GOOGLE_CLIENT_ID") or not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured on server.")
        
    base_url = str(request.base_url).rstrip('/')
    if "localhost" not in base_url and "127.0.0.1" not in base_url and base_url.startswith("http://"):
        base_url = base_url.replace("http://", "https://")
        
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "project_id": "jobhunt-agent",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": getattr(settings, "GOOGLE_CLIENT_SECRET", ""),
            "redirect_uris": [f"{base_url}/api/v1/gmail/callback"]
        }
    }
    
    try:
        flow = google_auth_oauthlib.flow.Flow.from_client_config(
            client_config, scopes=SCOPES
        )
        
        # Needs to match the authorized redirect URI
        flow.redirect_uri = client_config["web"]["redirect_uris"][0]
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=token # Pass the JWT as state so we can read it on callback
        )
        
        return {"auth_url": authorization_url, "state": state}
    except Exception as e:
        logger.error(f"Failed to generate Google Auth URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Google OAuth configuration error: {str(e)}")

@router.get("/callback")
async def gmail_callback(request: Request, code: str, state: str, db: AsyncSession = Depends(get_db)):
    """
    Handles the OAuth callback from Google.
    `state` contains the user's JWT token.
    """
    if not code or not state:
        raise HTTPException(status_code=400, detail="No code or state provided.")
        
    current_user = await get_current_user(db=db, token=state)
        
    base_url = str(request.base_url).rstrip('/')
    if "localhost" not in base_url and "127.0.0.1" not in base_url and base_url.startswith("http://"):
        base_url = base_url.replace("http://", "https://")
        
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "project_id": "jobhunt-agent",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": getattr(settings, "GOOGLE_CLIENT_SECRET", ""),
            "redirect_uris": [f"{base_url}/api/v1/gmail/callback"]
        }
    }
    
    try:
        flow = google_auth_oauthlib.flow.Flow.from_client_config(
            client_config, scopes=SCOPES, state=state
        )
        flow.redirect_uri = client_config["web"]["redirect_uris"][0]
    except Exception as e:
        logger.error(f"Failed to configure Google Auth flow in callback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Google OAuth configuration error: {str(e)}")
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
        user_settings = (await db.execute(stmt)).scalars().first()
        
        if not user_settings:
            user_settings = UserSetting(user_id=current_user.id)
            db.add(user_settings)
            
        user_settings.gmail_access_token = credentials.token
        if credentials.refresh_token:
            user_settings.gmail_refresh_token = credentials.refresh_token
        user_settings.use_gmail_for_send = True
        
        await db.commit()
        
        await db.commit()
        
        # Return a clean 302 redirect back to the frontend dashboard settings page
        frontend_url = "http://localhost:3000"
        if hasattr(settings, "BACKEND_CORS_ORIGINS") and settings.BACKEND_CORS_ORIGINS:
            # Safely cast AnyHttpUrl to string and strip trailing slash
            frontend_url = str(settings.BACKEND_CORS_ORIGINS[0]).rstrip('/')
            
        return RedirectResponse(f"{frontend_url}/dashboard/settings?gmail=connected")
        
    except Exception as e:
        logger.error(f"Failed to fetch Google OAuth token: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Gmail: {str(e)}")
