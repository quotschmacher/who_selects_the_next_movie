# Movie Night – SQLite im Repo

- **SQLite-Datei:** `backend/db.sqlite` (Devcontainer) bzw. `./data/db.sqlite` (Prod, bind mount – kein named volume).
- **Uploads:** liegen im Repo (`backend/uploads`) bzw. in `./uploads` (Prod).

## Devcontainer
1. `.devcontainer/docker-compose.yml` → `TMDB_API_KEY` (v3) beim Service **api** setzen (ohne Anführungszeichen).
2. VS Code → **Reopen in Container**.
3. Öffne `http://localhost:3000`.

> Die API schreibt nach `/workspaces/app/backend/db.sqlite`, das ist deine lokale Datei `backend/db.sqlite` im Projektordner.

## Produktion (ohne Nginx, ein Origin via Next-Rewrites)
```bash
docker compose -f docker-compose.prod.yml up -d --build
# Frontend: http://localhost
# API: via /api (Next-Rewrite an api:8000, intern)
# Datenhaltung: ./data/db.sqlite  (bind mount, kein Docker Volume)
# Uploads: ./uploads/
```

## Hinweis
Falls du wieder MySQL möchtest: einfach `DATABASE_URL` auf `mysql+pymysql://...` setzen und einen DB-Service ergänzen.
