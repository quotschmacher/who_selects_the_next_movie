import os
import zipfile

# Verzeichnisstruktur erstellen
os.makedirs("fastapi-backend/app", exist_ok=True)

# requirements.txt erstellen
with open("fastapi-backend/requirements.txt", "w") as f:
    f.write("fastapi==0.110.0\n")
    f.write("uvicorn==0.29.0\n")
    f.write("sqlalchemy==2.0.30\n")
    f.write("pydantic==2.7.1\n")
    f.write("alembic==1.7.7\n")
    f.write("typer==0.4.0\n")

# __init__.py erstellen
with open("fastapi-backend/app/__init__.py", "w") as f:
    f.write("")

# database.py erstellen
with open("fastapi-backend/app/database.py", "w") as f:
    f.write("""\
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./users.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
""")

# models.py erstellen
with open("fastapi-backend/app/models.py", "w") as f:
    f.write("""\
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
""")

# schemas.py erstellen
with open("fastapi-backend/app/schemas.py", "w") as f:
    f.write("""\
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    vorname: str
    name: str
    profilbild: Optional[str] = None  # base64-String

class UserCreate(UserBase):
    pass

class UserUpdate(UserBase):
    pass

class UserOut(UserBase):
    id: int
    registrierungsdatum: datetime
    aenderungsdatum: datetime

    class Config:
        orm_mode = True
""")

# routes.py erstellen
with open("fastapi-backend/app/routes.py", "w") as f:
    f.write("""\
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas
from .database import SessionLocal

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Benutzer anlegen
@router.post("/api/users", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = models.User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Alle Benutzer abrufen
@router.get("/api/users", response_model=List[schemas.UserOut])
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

# Einzelnen Benutzer abrufen
@router.get("/api/users/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    return user

# Benutzer aktualisieren
@router.put("/api/users/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user

# Benutzer löschen
@router.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    db.delete(user)
    db.commit()
    return {"detail": "Benutzer gelöscht"}
""")

# main.py erstellen
with open("fastapi-backend/app/main.py", "w") as f:
    f.write("""\
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models, database
from .routes import router

app = FastAPI()

# Datenbanktabellen erstellen
models.Base.metadata.create_all(bind=database.engine)

# CORS für Angular
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
""")

# seed_users.json erstellen
with open("fastapi-backend/seed_users.json", "w") as f:
    f.write("""\
[
  {
    "vorname": "Anna",
    "name": "Musterfrau",
    "profilbild": null,
    "registrierungsdatum": "2025-06-01 12:00:00",
    "aenderungsdatum": "2025-06-01 12:00:00"
  },
  {
    "vorname": "Max",
    "name": "Mustermann",
    "profilbild": null,
    "registrierungsdatum": "2025-06-02 14:30:00",
    "aenderungsdatum": "2025-06-02 14:30:00"
  }
]
""")

# app.py erstellen
with open("fastapi-backend/app.py", "w") as f:
    f.write("""\
import typer
import json
from datetime import datetime
from app.database import SessionLocal
from app.models import User

app = typer.Typer()

def seed_from_json(json_file: str):
    db = SessionLocal()
    try:
        with open(json_file, "r", encoding="utf-8") as f:
            users = json.load(f)
        for u in users:
            user = User(
                vorname=u["vorname"],
                name=u["name"],
                profilbild=u.get("profilbild"),
                registrierungsdatum=datetime.strptime(u["registrierungsdatum"], "%Y-%m-%d %H:%M:%S"),
                aenderungsdatum=datetime.strptime(u["aenderungsdatum"], "%Y-%m-%d %H:%M:%S")
            )
            db.add(user)
        db.commit()
        print("Seed erfolgreich ausgeführt.")
    finally:
        db.close()

@app.command()
def seed(json_file: str):
    seed_from_json(json_file)

if __name__ == "__main__":
    app()
""")

# ZIP-Datei erstellen
with zipfile.ZipFile("fastapi-backend.zip", "w") as zipf:
    for root, dirs, files in os.walk("fastapi-backend"):
        for file in files:
            zipf.write(os.path.join(root, file))

print("ZIP-Datei 'fastapi-backend.zip' wurde erfolgreich erstellt.")

