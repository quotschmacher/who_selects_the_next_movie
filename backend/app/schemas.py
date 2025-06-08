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

class UserOut(BaseModel):
    id: int
    vorname: str
    name: str
    registrierungsdatum: datetime
    aenderungsdatum: datetime
    profilbild: Optional[str]


    class Config:
        orm_mode = True
