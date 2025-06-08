from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    vorname = Column(String, nullable=False)
    name = Column(String, nullable=False)
    registrierungsdatum = Column(DateTime, default=datetime.utcnow)
    aenderungsdatum = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    profilbild = Column(String, nullable=True)  # base64-codiertes Bild
