import json
import re
from loguru import logger
import google.generativeai as genai
from openai import AsyncOpenAI
from app.db.models.setting import UserSetting

def _extract_json_content(text: str) -> str:
    """Extract JSON from a potentially chatty model response."""
    text = text.strip()
    # Find markdown blocks first
    match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```', text)
    if match:
        return match.group(1).strip()
        
    # Fallback to finding the first { or [ and last } or ]
    start_idx = -1
    end_idx = -1
    
    first_brace = text.find('{')
    first_bracket = text.find('[')
    
    if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
        start_idx = first_brace
        end_idx = text.rfind('}')
    elif first_bracket != -1:
        start_idx = first_bracket
        end_idx = text.rfind(']')
        
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        return text[start_idx:end_idx+1].strip()
        
    return text

async def call_llm(prompt: str, settings: UserSetting, is_json: bool = False, system_prompt: str = None) -> str:
    """
    Unified LLM caller that routes to Gemini or OpenAI-compatible (OpenRouter/Groq/etc)
    based on user settings.
    """
    provider = settings.llm_provider or "gemini"
    model_name = settings.preferred_model or "gemini-2.0-flash"

    try:
        if provider == "gemini":
            if not settings.gemini_api_keys:
                raise ValueError("Gemini API key is required but not set in Settings.")
            
            api_key = settings.gemini_api_keys.split(",")[0].strip()
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            
            # Gemini doesn't use standard system prompts natively in generate_content
            # so we prepend it to the user prompt if provided
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"
                
            response = model.generate_content(full_prompt)
            raw = response.text.strip()
            
            if is_json:
                raw = _extract_json_content(raw)
            return raw
            
        elif provider == "openai":
            if not settings.openai_api_key:
                raise ValueError("Custom LLM API key is required but not set in Settings.")
                
            client_kwargs = {
                "api_key": settings.openai_api_key.strip()
            }
            if settings.llm_base_url:
                client_kwargs["base_url"] = settings.llm_base_url.strip()
                
            client = AsyncOpenAI(**client_kwargs)
            
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            # Use structure output formatting if requested and URL supports it natively (OpenAI)
            # For max compatibility with OpenRouter/etc, we just instruct it in the prompt instead
            # to avoid unsupported schema errors on random models.
            if is_json and "json" not in prompt.lower():
                messages[0]["content"] += "\nReturn ONLY valid JSON."
                
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.7,
            )
            
            raw = response.choices[0].message.content.strip()
            
            if is_json:
                raw = _extract_json_content(raw)
            return raw
            
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")
            
    except Exception as e:
        logger.error(f"LLM Call failed ({provider}): {str(e)}")
        raise
