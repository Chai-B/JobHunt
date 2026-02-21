from pydantic import BaseModel


class ScraperJobRequest(BaseModel):
    target_url: str
    target_type: str # "jobs" or "contacts"

class ColdMailDispatchRequest(BaseModel):
    contact_id: int
    template_id: int
    resume_id: int
