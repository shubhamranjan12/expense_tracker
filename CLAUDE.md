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

The core feature lives in the `expenses` app: an `Expense` model (`date` + `reason` + `amount`, with an indexed day-only `DateField` and a positive `DecimalField` for money), exposed as a DRF `ModelViewSet`. The model also has an `auto_now_add` `created_at` used as the secondary sort key.

`date` defaults to `timezone.localdate` (today), so it is **optional on create** — POST without a `date` and the entry is filed under today. `id`/`created_at` are read-only in the serializer.

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
- Run tests: `.venv/bin/python manage.py test` (single case: `.venv/bin/python manage.py test expenses.tests.ExpenseAPITests`). Tests are DRF `APITestCase`s in `expenses/tests.py` that exercise the API end-to-end (create, today-default, list, day-filter, positive-amount validation).
- Django shell: `.venv/bin/python manage.py shell`

When adding dependencies, install into `.venv` and pin them in `requirements.txt` so the dependency set stays reproducible.

## Deployment (Render)

Deployed as a Render Blueprint from `render.yaml` (single `web` service):
- **Build:** `./build.sh` — `pip install`, `collectstatic`, `migrate`.
- **Start:** `gunicorn expense_tracker.wsgi:application`.
- **Static files** are served by **WhiteNoise** (middleware right after `SecurityMiddleware`; `CompressedManifestStaticFilesStorage`), collected into `STATIC_ROOT = staticfiles/` (gitignored). Templates must reference assets via `{% static %}` so the hashed manifest names resolve.
- **Settings are env-driven** (`expense_tracker/settings.py`): `SECRET_KEY`, `DEBUG` (defaults False), `ALLOWED_HOSTS` (comma-separated; Render's `RENDER_EXTERNAL_HOSTNAME` is appended automatically and added to `CSRF_TRUSTED_ORIGINS`). The hardcoded values remain only as local-dev fallbacks. With `DEBUG=False` the app forces HTTPS (`SECURE_SSL_REDIRECT`, secure cookies, HSTS, `SECURE_PROXY_SSL_HEADER` for Render's TLS-terminating proxy); these are skipped when `manage.py test` runs (the `TESTING` guard) since the test runner also sets `DEBUG=False`.
- **Caveat — SQLite is ephemeral on Render:** the DB file lives on the instance's disk, so **data resets on every redeploy/restart**. This is an accepted trade-off for now; the swap to a persistent backend (Postgres via `dj-database-url`) is the future upgrade path noted in the spec.

To simulate production locally: `DEBUG=False ALLOWED_HOSTS=127.0.0.1 SECRET_KEY=… .venv/bin/gunicorn expense_tracker.wsgi:application` (send `X-Forwarded-Proto: https` to bypass the SSL redirect over plain HTTP). Validate prod settings with `.venv/bin/python manage.py check --deploy`.
