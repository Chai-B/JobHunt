from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models.job_posting import JobPosting
from app.db.models.resume import Resume

async def find_best_resume_for_job(db: AsyncSession, job_id: int, user_id: int) -> dict:
    """
    Computes semantic similarity between a Job and all Resumes owned by the User.
    Uses pgvector's cosine distance (`<=>`).
    """
    # 1. Fetch the Job
    job_res = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = job_res.scalars().first()
    
    if not job or not job.embedding:
        return {"error": "Job not found or has no embedding"}
    
    # 2. Find Closest Resume using pgvector <=> operator (Distance)
    # Cosine distance: 0 is exactly same, 2 is opposite.
    # Score = 1 - (Distance / 2) to normalize 0-1 (higher is better)
    stmt = (
        select(Resume, Resume.embedding.cosine_distance(job.embedding).label("distance"))
        .where(Resume.user_id == user_id)
        .where(Resume.embedding.is_not(None))
        .order_by(Resume.embedding.cosine_distance(job.embedding))
        .limit(1)
    )
    
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        return {"error": "No valid resumes found for user"}
    
    resume, distance = row
    
    # Normalize: pgvector Cosine distance normally is 1 - Cosine Similarity
    # Meaning 0 = perfectly similar, 2 = exactly opposite.
    # We want a similarity score where 100% is best.
    similarity = 1 - (distance / 2.0)
    score = round(similarity * 100, 2)
    
    return {
        "best_resume_id": resume.id,
        "match_score": score
    }
