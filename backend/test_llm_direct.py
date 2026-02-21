import asyncio
import os
import sys

# Add backend directory to sys.path so 'app' can be imported
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.orm import selectinload
from sqlalchemy import select
from app.db.session import AsyncSessionLocal

# Import models
from app.db.models import user, setting, resume, job_posting, action_log, scraper, application
from app.services.llm import call_llm

async def main():
    async with AsyncSessionLocal() as db:
        settings = (await db.execute(select(setting.UserSetting))).scalars().first()
        if not settings:
            print("No settings found in DB.")
            return

        prompt = """Generate a professional email template for follow_up.
The template MUST use these placeholder variables (use double curly brackets):
- {{user_name}} - sender's name
- {{company}} - target company name
Return STRICTLY as JSON with these fields:
{
    "name": "A short template name (max 5 words)",
    "subject": "Email subject line using variables",
    "body_text": "Full email body using variables. Use line breaks for paragraphs."
}
"""
        print(f"Provider: {settings.llm_provider}")
        print(f"Model: {settings.preferred_model}")
        
        try:
            res = await call_llm(prompt, settings, is_json=True)
            print("\n--- RAW JSON RESULT FROM call_llm ---")
            print(res)
            
            import json
            parsed = json.loads(res)
            print("\n--- PARSED DICT ---")
            print(parsed)
            print("✅ SUCCESS")
        except Exception as e:
            import traceback
            print(f"\n❌ ERROR: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
