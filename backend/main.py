from datetime import datetime
from typing import Optional
import os, uuid

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel, Field, create_engine, Session, select
from pydantic_settings import BaseSettings
import httpx

class Settings(BaseSettings):
    TMDB_API_KEY: Optional[str] = None
    CORS_ORIGINS: str = "http://localhost:3000"
    # default to SQLite file in the working dir
    DATABASE_URL: str = "sqlite:///./db.sqlite"

settings = Settings()

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=connect_args)

# Models
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    position: int = Field(default=0, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class WatchEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    picker_user_id: int = Field(index=True)
    movie_id: str
    title: str
    search_url: Optional[str] = None
    poster_url: Optional[str] = None
    watched_at: datetime = Field(default_factory=datetime.utcnow)

app = FastAPI(title="Movie Night API (Local)")
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def init_db():
    SQLModel.metadata.create_all(engine)
    # seed users if empty
    with Session(engine) as s:
        any_user = s.exec(select(User)).first()
        if not any_user:
            s.add(User(name="Alex", email="alex@local", position=0))
            s.add(User(name="Sam", email="sam@local", position=1))
            s.add(User(name="Kim", email="kim@local", position=2))
            s.commit()

@app.on_event("startup")
def on_startup():
    init_db()

def compute_next_user_id(session: Session) -> Optional[int]:
    users = session.exec(select(User).order_by(User.position.asc(), User.id.asc())).all()
    if not users:
        return None
    last = session.exec(select(WatchEvent).order_by(WatchEvent.watched_at.desc())).first()
    if not last:
        return users[0].id
    ids = [u.id for u in users]
    try:
        idx = ids.index(last.picker_user_id)
        next_idx = (idx + 1) % len(ids)
    except ValueError:
        next_idx = 0
    return ids[next_idx]

@app.get("/health")
def health():
    with Session(engine) as s:
        s.exec(select(User).limit(1))
    return {"ok": True}

# Upload avatar
@app.post("/upload/avatar")
async def upload_avatar(file: UploadFile = File(...)):
    ok_types = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
    if file.content_type not in ok_types:
        raise HTTPException(400, "unsupported file type")
    name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}{ok_types[file.content_type]}"
    path = os.path.join("uploads", name)
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"url": f"/uploads/{name}"}

# Users
@app.get("/users")
def list_users():
    with Session(engine) as s:
        items = s.exec(select(User).order_by(User.position.asc(), User.id.asc())).all()
        return {"items": items}

@app.post("/users")
def add_user(user: dict):
    name = (user.get("name") or "").strip()
    email = user.get("email")
    avatar_url = user.get("avatar_url")
    if not name:
        raise HTTPException(400, "name required")
    with Session(engine) as s:
        maxpos = s.exec(select(User.position).order_by(User.position.desc())).first()
        nextpos = (maxpos or 0) + 1 if maxpos is not None else 0
        u = User(name=name, email=email, avatar_url=avatar_url, position=nextpos)
        s.add(u)
        s.commit()
        s.refresh(u)
        return {"id": u.id, "name": u.name, "email": u.email, "avatar_url": u.avatar_url, "position": u.position}

@app.patch("/users/{user_id}")
def update_user(user_id: int, payload: dict):
    with Session(engine) as s:
        u = s.get(User, user_id)
        if not u:
            raise HTTPException(404, "not found")
        if "name" in payload and (payload["name"] or "").strip():
            u.name = payload["name"].strip()
        if "email" in payload:
            u.email = payload["email"]
        if "avatar_url" in payload:
            u.avatar_url = payload["avatar_url"]
        s.commit()
        s.refresh(u)
        return {"id": u.id, "name": u.name, "email": u.email, "avatar_url": u.avatar_url, "position": u.position}

@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    with Session(engine) as s:
        u = s.get(User, user_id)
        if not u:
            raise HTTPException(404, "not found")
        s.delete(u)
        s.commit()
        return {"ok": True}

@app.post("/users/reorder")
def reorder_users(payload: dict):
    order = payload.get("order")
    if not isinstance(order, list) or not all(isinstance(i, int) for i in order):
        raise HTTPException(400, "order must be [id, id, ...]")
    with Session(engine) as s:
        users = {u.id: u for u in s.exec(select(User)).all()}
        for pos, uid in enumerate(order):
            u = users.get(uid)
            if u:
                u.position = pos
        s.commit()
        return {"ok": True}

# Robust TMDb search (fallback to mock on errors)
@app.get("/movies/search2")
async def search_movies2(q: str, mode: str = "title"):
    def mock_results(q: str, mode: str):
        base = [
            {"id": "tmdb:movie:123", "title": "Inception", "year": 2010, "overview": "A thief who steals corporate secrets...", "poster": "", "kind": "movie"},
            {"id": "tmdb:movie:456", "title": "The Matrix", "year": 1999, "overview": "A computer hacker learns...", "poster": "", "kind": "movie"},
            {"id": "tmdb:movie:789", "title": "Se7en", "year": 1995, "overview": "Two detectives hunt a serial killer...", "poster": "", "kind": "movie"},
        ]
        if mode == "actor":
            return base
        ql = (q or "").lower()
        return [m for m in base if ql in m["title"].lower()]

    if not settings.TMDB_API_KEY:
        return {"results": mock_results(q, mode)}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if mode == "actor":
                r = await client.get(
                    "https://api.themoviedb.org/3/search/person",
                    params={"api_key": settings.TMDB_API_KEY, "query": q, "language": "de-DE"},
                )
                r.raise_for_status()
                people = r.json().get("results", [])
                results = []
                if people:
                    pid = people[0].get("id")
                    cr = await client.get(
                        f"https://api.themoviedb.org/3/person/{pid}/movie_credits",
                        params={"api_key": settings.TMDB_API_KEY, "language": "de-DE"},
                    )
                    cr.raise_for_status()
                    movies = cr.json().get("cast", [])
                    movies = sorted(movies, key=lambda x: x.get("popularity", 0) or 0, reverse=True)[:20]
                    for m in movies:
                        results.append(
                            {
                                "id": f"tmdb:movie:{m.get('id')}",
                                "title": m.get("title") or m.get("original_title") or "",
                                "year": (m.get("release_date") or "")[:4],
                                "overview": m.get("overview") or "",
                                "poster": f"https://image.tmdb.org/t/p/w185{m.get('poster_path')}" if m.get("poster_path") else "",
                                "kind": "movie",
                            }
                        )
                return {"results": results}

            movie_resp = await client.get(
                "https://api.themoviedb.org/3/search/movie",
                params={"api_key": settings.TMDB_API_KEY, "query": q, "include_adult": "false", "language": "de-DE"},
            )
            movie_resp.raise_for_status()
            movie_results = movie_resp.json().get("results", [])

            tv_results = []
            try:
                tv_resp = await client.get(
                    "https://api.themoviedb.org/3/search/tv",
                    params={"api_key": settings.TMDB_API_KEY, "query": q, "include_adult": "false", "language": "de-DE"},
                )
                tv_resp.raise_for_status()
                tv_results = tv_resp.json().get("results", [])
            except httpx.HTTPError as tv_error:
                print(f"[TMDb error] {tv_error!r} - tv search skipped")

            combined = []
            for m in movie_results:
                combined.append(
                    (
                        float(m.get("popularity") or 0),
                        {
                            "id": f"tmdb:movie:{m.get('id')}",
                            "title": m.get("title") or m.get("original_title") or "Unbekannter Titel",
                            "year": (m.get("release_date") or "")[:4],
                            "overview": m.get("overview") or "",
                            "poster": f"https://image.tmdb.org/t/p/w185{m.get('poster_path')}" if m.get("poster_path") else "",
                            "kind": "movie",
                        },
                    )
                )
            for t in tv_results:
                combined.append(
                    (
                        float(t.get("popularity") or 0),
                        {
                            "id": f"tmdb:tv:{t.get('id')}",
                            "title": t.get("name") or t.get("original_name") or "Unbekannte Serie",
                            "year": (t.get("first_air_date") or "")[:4],
                            "overview": t.get("overview") or "",
                            "poster": f"https://image.tmdb.org/t/p/w185{t.get('poster_path')}" if t.get("poster_path") else "",
                            "kind": "tv",
                        },
                    )
                )

            combined.sort(key=lambda item: item[0], reverse=True)
            results = [item[1] for item in combined[:20]]
            return {"results": results}
    except httpx.HTTPError as e:
        print(f"[TMDb error] {e!r} - fallback to mock")

    return {"results": mock_results(q, mode)}

# Create event
@app.post("/movies/select")
def select_movie(payload: dict):
    picker_user_id = payload.get("picker_user_id")
    title = payload.get("title") or "Unbekannter Titel"
    movie_id = str(payload.get("movie_id") or "")
    watched_at = payload.get("watched_at")
    search_url = payload.get("search_url")
    poster_url = payload.get("poster_url")
    if not picker_user_id:
        raise HTTPException(400, "picker_user_id required")
    if not movie_id:
        raise HTTPException(400, "movie_id required")
    with Session(engine) as s:
        if not s.get(User, picker_user_id):
            raise HTTPException(400, "picker_user_id invalid")
        ts = datetime.fromisoformat(watched_at) if watched_at else datetime.utcnow()
        ev = WatchEvent(
            picker_user_id=picker_user_id,
            movie_id=movie_id,
            title=title,
            search_url=search_url,
            poster_url=poster_url,
            watched_at=ts
        )
        s.add(ev)
        s.commit()
        s.refresh(ev)
        return {"ok": True, "id": ev.id}

# Watchlog
@app.get("/watchlog")
def watchlog(limit: int = 50):
    limit = max(1, min(limit, 500))
    with Session(engine) as s:
        rows = s.exec(select(WatchEvent).order_by(WatchEvent.watched_at.desc()).limit(limit)).all()
        items = []
        for r in rows:
            u = s.get(User, r.picker_user_id)
            items.append({
                "id": r.id,
                "title": r.title,
                "movie_id": r.movie_id,
                "watched_at": r.watched_at.isoformat(),
                "picker_name": u.name if u else "unbekannt",
                "search_url": r.search_url,
                "poster_url": r.poster_url,
                "is_placeholder": (r.movie_id == "placeholder")
            })
        return {"items": items}

# Rotation
@app.get("/rotation/next")
def rotation_next():
    with Session(engine) as s:
        next_id = compute_next_user_id(s)
        if next_id is None:
            return {"next": None}
        u = s.get(User, next_id)
        return {"next": {"id": u.id, "name": u.name, "avatar_url": u.avatar_url}}

@app.post("/rotation/confirm")
def rotation_confirm(payload: dict | None = None):
    payload = payload or {}
    with Session(engine) as s:
        picker_id = payload.get("picker_user_id") or compute_next_user_id(s)
        if picker_id is None:
            raise HTTPException(400, "no users in rotation")
        watched_at_raw = payload.get("watched_at")
        if watched_at_raw:
            if len(watched_at_raw) == 10:
                ts = datetime.fromisoformat(watched_at_raw + "T00:00:00")
            else:
                ts = datetime.fromisoformat(watched_at_raw)
        else:
            ts = datetime.utcnow()
        title = payload.get("title") or "Platzhalter -- Auswahl folgt"
        ev = WatchEvent(picker_user_id=picker_id, movie_id="placeholder", title=title, search_url=None, poster_url=None, watched_at=ts)
        s.add(ev)
        s.commit()
        s.refresh(ev)
        return {"ok": True, "id": ev.id}

# Edit & delete
@app.patch("/watchevents/{event_id}")
def update_watchevent(event_id: int, payload: dict):
    with Session(engine) as s:
        ev = s.get(WatchEvent, event_id)
        if not ev:
            raise HTTPException(404, "not found")
        if "picker_user_id" in payload:
            pid = payload.get("picker_user_id")
            if pid and not s.get(User, pid):
                raise HTTPException(400, "picker_user_id invalid")
            ev.picker_user_id = pid or ev.picker_user_id
        if "watched_at" in payload and payload.get("watched_at"):
            wa = payload.get("watched_at")
            try:
                if isinstance(wa, str) and len(wa) == 10:
                    ev.watched_at = datetime.fromisoformat(wa + "T00:00:00")
                else:
                    ev.watched_at = datetime.fromisoformat(wa) if isinstance(wa, str) else wa
            except Exception:
                raise HTTPException(400, "invalid watched_at")
        if "title" in payload and payload.get("title"):
            ev.title = payload["title"]
        if "movie_id" in payload and payload.get("movie_id"):
            ev.movie_id = str(payload["movie_id"])
        if "search_url" in payload:
            ev.search_url = payload["search_url"]
        if "poster_url" in payload:
            ev.poster_url = payload["poster_url"]
        s.commit()
        s.refresh(ev)
        return {"ok": True}

@app.delete("/watchevents/{event_id}")
def delete_watchevent(event_id: int):
    with Session(engine) as s:
        ev = s.get(WatchEvent, event_id)
        if not ev:
            raise HTTPException(404, "not found")
        s.delete(ev)
        s.commit()
        return {"ok": True}


