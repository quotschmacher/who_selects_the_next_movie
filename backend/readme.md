## DevContainer

- zum Zeitpunkt der Erstellung war pydantic noch nicht mit Python 3.13 kompatibel - es kam zu Fehlern beim Setup

## App starten

`uvicorn app.main:app --reload`

## Alembic DB Migration

### 📦 Alembic installieren

```bash
pip install alembic
```

### 📁 Alembic initialisieren

Im Huaptverzeichnis des Projekts:

```bash
alembic init alembic
```

Das erzeugt:

- einen Ordner alembic/
- eine Konfigurationsdatei alembic.ini

### ⚙️ alembic.ini konfigurieren

Öffne alembic.ini und ändere die Zeile:

```ini
sqlalchemy.url = sqlite:///./users.db
```

Das ist der Pfad zu deiner SQLite-Datenbank.

### 🧠 env.py anpassen

In alembic/env.py:

- Importiere dein SQLAlchemy-Base-Objekt:
```python
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models import Base
target_metadata = Base.metadata
```

### ✍️ Migration erstellen

Wenn du z. B. deine users-Tabelle migrieren willst:

```bash
alembic revision --autogenerate -m "create users table
```

Das erzeugt eine Datei in alembic/versions/ mit dem SQL-Code für die Migration.

### 🚀 Migration anwenden

```bash
alembic upgrade head
```

Damit wird die Migration ausgeführt und die Datenbankstruktur erstellt oder aktualisiert.
