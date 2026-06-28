#!/usr/bin/env bash
#
# run.sh — set up and launch the Expense Tracker in one command.
#
# Usage:
#   ./run.sh                # set up, then run the dev server on 127.0.0.1:8000
#   ./run.sh 0.0.0.0:8080   # pass any host:port (or port) through to runserver
#
set -euo pipefail

# Always operate from the repo root (the directory this script lives in).
cd "$(dirname "$0")"

VENV=".venv"
PY="$VENV/bin/python"
PIP="$VENV/bin/pip"
ADDR="${1:-127.0.0.1:8000}"

# 1. Ensure the virtualenv exists.
if [ ! -x "$PY" ]; then
  echo ">> Creating virtualenv at $VENV"
  python3 -m venv "$VENV"
fi

# 2. Install / update pinned dependencies.
echo ">> Installing dependencies from requirements.txt"
"$PIP" install --quiet --upgrade pip
"$PIP" install --quiet -r requirements.txt

# 3. Apply database migrations.
echo ">> Applying database migrations"
"$PY" manage.py migrate --noinput

# 4. Launch the development server.
echo ">> Starting server at http://$ADDR  (Ctrl+C to stop)"
exec "$PY" manage.py runserver "$ADDR"
