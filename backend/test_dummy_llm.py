import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.services.llm import call_llm
from app.db.models.setting import UserSetting

async def main():
    settings = UserSetting(
        llm_provider="openai",
        openai_api_key="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",
        llm_base_url="https://openrouter.ai/api/v1",
        preferred_model="meta-llama/llama-3.1-8b-instruct"
    )
    
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
    try:
        res = await call_llm(prompt, settings, is_json=True)
        print("\n--- RAW RESULT ---")
        print(res)
        
        import json
        print("\n--- PARSING WITH STRICT=FALSE ---")
        parsed = json.loads(res, strict=False)
        print("✅ SUCCESS")
        print(parsed)
    except Exception as e:
        import traceback
        print(f"\n❌ JSON PARSE FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(main())
