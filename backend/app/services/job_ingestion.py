from abc import ABC, abstractmethod
from typing import Dict, Any, List
from loguru import logger
from sentence_transformers import SentenceTransformer

# Shared model
model = SentenceTransformer('all-MiniLM-L6-v2')

class BaseJobAdapter(ABC):
    @abstractmethod
    def fetch_jobs(self, **kwargs) -> List[Dict[str, Any]]:
        pass

    def process_job(self, job_data: dict) -> dict:
        """
        Takes raw job data, normalizes it, and builds embeddings.
        Returns data ready to be inserted into Database JobPosting model.
        """
        title = job_data.get("title", "")
        company = job_data.get("company", "")
        description = job_data.get("description", "")
        
        combined_text = f"Title: {title}\nCompany: {company}\nDescription: {description}"
        embedding = model.encode(combined_text).tolist()
        
        return {
            "source": self.__class__.__name__,
            "title": title,
            "company": company,
            "description": description,
            "embedding": embedding,
            "metadata_json": job_data.get("metadata", {})
        }

class ManualJobAdapter(BaseJobAdapter):
    """
    Simple adapter to allow users to manually paste job details.
    """
    def fetch_jobs(self, title: str, company: str, description: str, **kwargs) -> List[Dict[str, Any]]:
        logger.info(f"Ingesting manual job: {title} at {company}")
        return [{
            "title": title,
            "company": company,
            "description": description,
            "metadata": {}
        }]
