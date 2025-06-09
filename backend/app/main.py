from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models, database
from .routes import router

app = FastAPI(docs_url="/swagger", openapi_url="/swagger.json")

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
