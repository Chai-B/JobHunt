from fastapi import APIRouter
from app.api.v1.endpoints import auth, resumes, jobs, templates, applications, users, settings, scraper, logs, contacts, extract, gmail_auth

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(applications.router, prefix="/applications", tags=["applications"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(scraper.router, prefix="/scraper", tags=["scraper"])
api_router.include_router(logs.router, prefix="/logs", tags=["logs"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["contacts"])
api_router.include_router(extract.router, prefix="/extract", tags=["extract"])
api_router.include_router(gmail_auth.router, prefix="/gmail", tags=["gmail"])
