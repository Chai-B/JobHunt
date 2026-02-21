import io
import fitz # PyMuPDF
import docx
from sentence_transformers import SentenceTransformer
from loguru import logger
import re

# Load the model lazily or at module level (better for workers)
model = SentenceTransformer('all-MiniLM-L6-v2')

def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        logger.error(f"Error extracting PDF: {e}")
    return text

def extract_text_from_docx(file_bytes: bytes) -> str:
    text = ""
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        logger.error(f"Error extracting DOCX: {e}")
    return text

def _compute_structural_score(text: str) -> float:
    """Basic heuristic: how well-structured is this resume?"""
    score = 0.0
    sections = ["experience", "education", "skills", "projects", "summary", "objective", "certifications"]
    text_lower = text.lower()
    found = sum(1 for s in sections if s in text_lower)
    score += min(found / 4.0, 1.0) * 0.5  # Up to 0.5 for section coverage
    
    # Check for bullet points / structured lists
    bullet_count = len(re.findall(r'[•\-\*]\s', text))
    score += min(bullet_count / 10.0, 1.0) * 0.3  # Up to 0.3 for bullets
    
    # Check for reasonable length
    word_count = len(text.split())
    if 150 <= word_count <= 2000:
        score += 0.2  # Ideal resume length
    elif word_count > 50:
        score += 0.1
    
    return round(min(score, 1.0), 2)

def _compute_semantic_score(text: str) -> float:
    """Basic heuristic: how content-rich is this resume?"""
    text_lower = text.lower()
    action_verbs = ["developed", "managed", "led", "built", "designed", "implemented", 
                    "created", "improved", "achieved", "delivered", "launched", "optimized"]
    verb_count = sum(1 for v in action_verbs if v in text_lower)
    
    # Check for quantified achievements
    number_count = len(re.findall(r'\d+[%+]|\$\d+|\d+\s*(users|customers|clients|projects|years)', text_lower))
    
    score = min(verb_count / 5.0, 1.0) * 0.5 + min(number_count / 3.0, 1.0) * 0.5
    return round(min(score, 1.0), 2)

def parse_and_embed_resume(file_bytes: bytes, filename: str) -> dict:
    """
    Extracts text based on extension, and generates an embedding.
    Returns a dict with raw_text and the embedding vector.
    """
    ext = filename.split(".")[-1].lower()
    
    if ext == "pdf":
        raw_text = extract_text_from_pdf(file_bytes)
    elif ext in ["docx", "doc"]:
        raw_text = extract_text_from_docx(file_bytes)
    else:
        # Fallback for text/markdown
        raw_text = file_bytes.decode('utf-8', errors='ignore')
        
    if not raw_text.strip():
        raise ValueError("Could not extract any text from the document.")

    logger.info(f"Extracted {len(raw_text)} characters from {filename}. Generating embedding...")
    
    # Truncate for embedding - MiniLM-L6-v2 has 256 token window, ~8000 chars is plenty
    embed_text = raw_text[:8000]
    embedding = model.encode(embed_text).tolist()
    
    structural_score = _compute_structural_score(raw_text)
    semantic_score = _compute_semantic_score(raw_text)
    
    logger.info(f"Resume {filename}: structural={structural_score}, semantic={semantic_score}")
    
    return {
        "raw_text": raw_text,
        "embedding": embedding,
        "structural_score": structural_score,
        "semantic_score": semantic_score
    }

