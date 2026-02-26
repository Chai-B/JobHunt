from app.db.base import Base
from app.db.models import user, resume, template, scraper, job, contact, application, setting, action_log
print("Loaded models:", len(Base.metadata.tables.keys()))
