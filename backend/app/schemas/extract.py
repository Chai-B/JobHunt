from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ExtractRequest(BaseModel):
    text: str

class ExtractedEntity(BaseModel):
    type: str # "contact" or "job"
    confidence: float
    data: Dict[str, Any]
    
class ExtractResponse(BaseModel):
    entities: List[ExtractedEntity]
