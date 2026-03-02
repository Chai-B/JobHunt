import asyncio
import json
import numpy as np
from loguru import logger
from typing import Dict, Any

try:
    from playwright.async_api import async_playwright
except ImportError:
    pass

from app.db.models.setting import UserSetting
from app.services.job_ingestion import model as sentence_model # Re-use the all-MiniLM-L6-v2 transformer instance

def calculate_cosine_similarity(vec1, vec2):
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

async def fill_application_form(url: str, payload: Dict[str, Any], user_settings: UserSetting = None) -> str:
    """
    Simulates autonomous form filling without LLM token costs.
    1. Extracts interactable elements via JS.
    2. Uses local sentence-transformers to convert HTML Labels & IDs to vector embeddings.
    3. Compares label embeddings to Payload dictionary keys using Cosine Similarity.
    4. Automatically fills/targets fields exceeding a strict confidence boundary (>0.70).
    """
    logger.info(f"Attempting Local ML Auto-Fill for {url}")
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            response = await page.goto(url, wait_until="networkidle", timeout=30000)
            if not response or not response.ok:
                raise Exception(f"Failed to load URL {url}: {response.status if response else 'No response'}")
                
            await page.wait_for_timeout(3000)
            
            # Inject JS to deeply extract interactable elements securely
            extract_script = """
            () => {
                const interactables = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')).map(el => {
                    let label = "";
                    if (el.labels && el.labels.length > 0) label = el.labels[0].innerText;
                    else if (el.id) {
                        const labelEl = document.querySelector(`label[for="${el.id}"]`);
                        if (labelEl) label = labelEl.innerText;
                    }
                    
                    let selector = "";
                    if (el.id) selector = `#${el.id}`;
                    else if (el.name) selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
                    else {
                        selector = `${el.tagName.toLowerCase()}[type="${el.type}"]`; 
                    }

                    return {
                        tag: el.tagName.toLowerCase(),
                        type: el.type || '',
                        name: el.name || '',
                        id: el.id || '',
                        placeholder: el.placeholder || '',
                        label: label.trim(),
                        selector: selector
                    };
                });
                return interactables.filter(i => i.selector && i.type !== 'submit' && i.type !== 'button' && i.type !== 'file');
            }
            """
            fields_data = await page.evaluate(extract_script)
            
            if not fields_data:
                await browser.close()
                return "Failed: No valid input fields identified on the DOM."
                
            logger.info(f"Extracted {len(fields_data)} form fields from DOM. Pre-computing payload vectors...")
            
            # Embed the generated answer keys
            payload_keys = list(payload.keys())
            if not payload_keys:
                await browser.close()
                return "Failed: AI Payload provided no answer keys."
                
            # e.g., mapping "first_name" -> [0.01, 0.05, ...]
            key_embeddings = sentence_model.encode([k.replace("_", " ") for k in payload_keys])
            
            actions = []
            
            for field in fields_data:
                # The semantic signal for what this field represents
                semantic_target = field['label'] if field['label'] else field['name']
                if not semantic_target:
                    continue
                    
                field_embedding = sentence_model.encode([semantic_target])[0]
                
                best_score = 0.0
                best_key = None
                
                for idx, k_emb in enumerate(key_embeddings):
                    score = calculate_cosine_similarity(field_embedding, k_emb)
                    if score > best_score:
                        best_score = score
                        best_key = payload_keys[idx]
                        
                # 0.70 is a reasonable heuristic threshold for Semantic similarity on STS engines
                if best_score > 0.70 and best_key:
                    logger.debug(f"Mapped DOM Field '{semantic_target}' to Key '{best_key}' (Score: {best_score:.2f})")
                    actions.append({
                        "selector": field['selector'],
                        "value": str(payload[best_key]),
                        "action": "fill" if field['tag'] in ['input', 'textarea'] else "select"
                    })

            fields_filled = 0
            for action_obj in actions:
                selector = action_obj["selector"]
                value = action_obj["value"]
                action_type = action_obj["action"]
                
                try:
                    locator = page.locator(selector).first
                    if action_type == "fill":
                        await locator.fill(value)
                        fields_filled += 1
                    elif action_type == "select":
                        await locator.select_option(value)
                        fields_filled += 1
                        
                except Exception as eval_err:
                    logger.debug(f"Could not interact with field natively {selector}: {eval_err}")
                    continue
            
            await browser.close()
            return f"Successfully accessed form. Local ML mapped and executed {fields_filled} accurate inputs out of {len(fields_data)} available fields autonomously."
            
    except Exception as e:
        logger.error(f"Playwright Form Filler Exception: {e}")
        return f"Agent failure: {e}"
