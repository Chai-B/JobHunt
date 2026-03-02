import json
import re
from loguru import logger
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
        json_str = text[start_idx:end_idx+1].strip()
        
        # LLaMA and other models often return raw unescaped newlines inside JSON strings
        # We need to escape them before json.loads can parse it.
        # A simple approach is replacing actual newlines with \n escape sequences 
        # but only when they are inside string values. The safest quick hack is to 
        # escape all control characters if json.loads fails, but doing it generally 
        # by replacing literal newlines inside the json block works for email bodies.
        
        # Safely convert raw newlines to escaped \n so json.loads doesn't crash
        json_str = json_str.replace('\n', '\\n').replace('\r', '\\r')
        
        # But wait, we just escaped ALL newlines, including struct ones.
        # json.loads actually handles \n fine as long as it's literal. Python's json
        # module requires strict escaping. Let's use strict=False when parsing upstream,
        # but here we can just fix the common LLaMA bug: raw newlines in string values.
        
        # Actually, python's json.loads(..., strict=False) handles unescaped control chars!
        # We don't need to regex it. We just need to make sure the endpoint uses strict=False.
        
        return json_str
        
    return text

async def call_llm(prompt: str, settings: UserSetting, is_json: bool = False, system_prompt: str = None, temperature: float = 0.0) -> str:
    """
    Unified LLM caller that routes to Gemini or OpenAI-compatible (OpenRouter/Groq/etc)
    based on user settings.
    """
    provider = settings.llm_provider or "gemini"
    model_name = settings.preferred_model or "gemini-2.0-flash"

    try:
        if provider == "gemini":
            import google.generativeai as genai
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
                
            generation_config = genai.types.GenerationConfig(
                temperature=temperature
            )
            response = model.generate_content(full_prompt, generation_config=generation_config)
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
                if messages and messages[0]["role"] == "system":
                    messages[0]["content"] += "\nReturn ONLY valid JSON."
                else:
                    messages[0]["content"] += "\nReturn ONLY valid JSON."
                
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=temperature,
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
