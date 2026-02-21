import io
import fitz # PyMuPDF
import docx
from sentence_transformers import SentenceTransformer
from loguru import logger

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
    
    # Generate embedding
    embedding = model.encode(raw_text).tolist()
    
    # Future Phase: Generate Structural/Semantic metrics here
    
    return {
        "raw_text": raw_text,
        "embedding": embedding,
        "structural_score": 0.0, # Placeholder
        "semantic_score": 0.0 # Placeholder
    }
