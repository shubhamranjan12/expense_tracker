# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Spec

An expense tracker that:
- Tracks expenses entered **day-wise**, taking two inputs per entry: a **reason** for the spend and an **amount**.
- Supports **filtering expenses by a particular day**.
- Uses **SQLite3** as the database initially (chosen for simplicity; intended to be swappable for a scalable backend later).

## Project layout

A Django 5.2 project (Python 3.10) scaffolded at the repo root:
- `manage.py` — Django management entry point.
- `expense_tracker/` — project config package (`settings.py`, `urls.py`, `wsgi.py`, `asgi.py`).
- `expenses/` — the application; holds the `Expense` model, DRF serializer/viewset, and admin. Registered in `INSTALLED_APPS`.
- `templates/index.html` — the single-page web frontend (served by Django; configured via `TEMPLATES['DIRS']`).
- `static/css/style.css`, `static/js/app.js` — frontend assets (configured via `STATICFILES_DIRS`).
- `db.sqlite3` — local SQLite database (the spec's chosen backend; keep DB config swappable for later scaling).
- `requirements.txt` — pinned dependencies (`Django`, `djangorestframework`, `drf-spectacular`).
- `.venv/` — the in-repo virtualenv to use for all commands.

The core feature lives in the `expenses` app: an `Expense` model (`date` + `reason` + `amount`, with an indexed day-only `DateField` and a positive `DecimalField` for money), exposed as a DRF `ModelViewSet`.

### Design notes / decided trade-offs
- **`Expense` uses a plain auto-increment integer PK — keep it.** Making `date` the primary key was considered and rejected: a PK must be unique, so it would cap the table at one expense per day, which breaks the "multiple day-wise entries" spec. Per-date sequential ids (id nested under date) were also rejected — they require a per-day counter, adding write contention/race conditions for no benefit. Integer-PK lookups are O(log n) and do not degrade at scale, so `/api/expenses/{id}/` is the correct detail route.
- **`amount` is a `DecimalField`, never a float** — money must avoid binary rounding error; it carries a `MinValueValidator` so amounts stay positive.
- The day filter is a `?date=` query param (bookmarkable), not a nested route.

## API

REST API built with Django REST Framework, mounted under `/api/`:
- `GET/POST /api/expenses/` — list (newest first) / create. List accepts `?date=YYYY-MM-DD` to filter to one day.
- `GET/PUT/PATCH/DELETE /api/expenses/{id}/` — retrieve / update / delete a single expense.

### API docs (drf-spectacular)
OpenAPI 3 schema and interactive docs:
- `GET /api/schema/` — OpenAPI 3 spec (YAML).
- `GET /api/schema/swagger-ui/` — interactive Swagger UI.
- `GET /api/schema/redoc/` — ReDoc docs.

Generate a static spec file with `.venv/bin/python manage.py spectacular --file openapi.yaml` (add `--validate` to check it). The `?date=` filter is documented on the list operation via `@extend_schema_view` in `expenses/views.py`.

## Frontend

A single-page web UI served by Django at `GET /` (route in `expense_tracker/urls.py`, wrapped in `ensure_csrf_cookie` so the page sets the `csrftoken` cookie).

- **Stack:** vanilla HTML/CSS/JS — no build step, no framework. Served as Django static files on the **same origin** as the API, so no CORS config is needed.
- **It is a thin client over the REST API.** `static/js/app.js` does `fetch()` calls to `/api/expenses/`; all validation/business rules stay in the API (the JS only mirrors errors the API returns). Do not move logic into the frontend.
- **Features:** add expense, list (newest first), filter by day (`?date=`), client-side daily total, inline edit (`PATCH`), delete (with confirm). Unsafe requests send the `X-CSRFToken` header read from the cookie.
- **Why so light:** the web UI is a secondary surface; a native Android app is the planned primary API client. See `code_plan.txt` for the API-readiness items (pagination, auth, `/api/v1/` versioning) that future clients will need.

## Environment & commands

Use the in-repo `.venv` for everything (activate with `source .venv/bin/activate`, or call `.venv/bin/python` / `.venv/bin/pip` directly).

- **One-command setup + run: `./run.sh`** (optional `host:port` arg, e.g. `./run.sh 0.0.0.0:8080`). Creates `.venv` if missing, installs `requirements.txt`, applies migrations, then starts the dev server. Use this for a quick start; the individual commands below are for finer-grained work.
- Install deps: `.venv/bin/pip install -r requirements.txt`
- Run dev server: `.venv/bin/python manage.py runserver`
- System check: `.venv/bin/python manage.py check`
- Make / apply migrations: `.venv/bin/python manage.py makemigrations` then `.venv/bin/python manage.py migrate`
- Run tests: `.venv/bin/python manage.py test` (single app/case: `.venv/bin/python manage.py test expenses.tests.SomeTestCase`)
- Django shell: `.venv/bin/python manage.py shell`

When adding dependencies, install into `.venv` and pin them in `requirements.txt` so the dependency set stays reproducible.
