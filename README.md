# Expense Tracker

A day-wise expense tracker built step-by-step on my YouTube channel. A
[Django REST Framework](https://www.django-rest-framework.org/) API — with
auto-generated OpenAPI docs (Swagger / ReDoc) via
[drf-spectacular](https://drf-spectacular.readthedocs.io/) — backed by SQLite,
plus a lightweight vanilla-JS frontend for adding, filtering-by-day, editing,
and deleting expenses. **API-first by design**, with a native Android client
planned as the next build.

## Features

- Add an expense with a **reason** and an **amount**, dated **day-wise**.
- **Filter** the list to a single day (`?date=YYYY-MM-DD`).
- Per-day **total**, inline **edit**, and **delete** — all from the web UI.
- `Decimal`-safe amounts (no floating-point money bugs), constrained positive.
- Interactive API docs out of the box (Swagger UI + ReDoc).

## Tech stack

- **Backend:** Python 3.10, Django 5.2, Django REST Framework
- **API docs:** drf-spectacular (OpenAPI 3)
- **Database:** SQLite (swappable for a scalable backend later)
- **Frontend:** vanilla HTML / CSS / JS — no build step, served by Django on the
  same origin as the API (so no CORS setup needed)

## Quick start

```bash
./run.sh
```

This creates the virtualenv if needed, installs dependencies, applies
migrations, and starts the dev server. Then open
**http://127.0.0.1:8000/**.

Pass a custom host/port if you like:

```bash
./run.sh 0.0.0.0:8080
```

### Manual setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

## API

Mounted under `/api/`:

| Method                     | Endpoint               | Description                                              |
| -------------------------- | ---------------------- | ------------------------------------------------------- |
| `GET`                      | `/api/expenses/`       | List expenses (newest first); `?date=YYYY-MM-DD` filters to one day |
| `POST`                     | `/api/expenses/`       | Create an expense (`reason`, `amount`, optional `date`) |
| `GET`                      | `/api/expenses/{id}/`  | Retrieve a single expense                               |
| `PUT` / `PATCH` / `DELETE` | `/api/expenses/{id}/`  | Update / delete a single expense                        |

### API docs

- `GET /api/schema/` — OpenAPI 3 spec (YAML)
- `GET /api/schema/swagger-ui/` — interactive Swagger UI
- `GET /api/schema/redoc/` — ReDoc

## Project layout

```
expense_tracker/   # Django project config (settings, urls, wsgi/asgi)
expenses/          # the app: Expense model, DRF serializer/viewset, admin, tests
templates/         # index.html — the single-page web UI
static/            # css/style.css, js/app.js
manage.py
run.sh             # one-command setup + run
requirements.txt
```

## Running the tests

```bash
.venv/bin/python manage.py test
```

## Notes

- `SECRET_KEY` in `expense_tracker/settings.py` is a development placeholder and
  `DEBUG=True` — **do not use these as-is in production**. Generate a fresh key
  and load it (plus production settings) from the environment before deploying.
- This repo is a learning/demo project recorded for YouTube; see `code_plan.txt`
  and `frontend_plan.txt` for the design notes and the API-readiness items
  (pagination, auth, `/api/v1/` versioning) planned for future clients.

## License

See [LICENSE](LICENSE).
