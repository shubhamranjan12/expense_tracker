#!/usr/bin/env bash
#
# build.sh — Render build command for the Expense Tracker.
#
# Installs dependencies, gathers static files for WhiteNoise, and applies
# migrations. Note: the SQLite database lives on Render's ephemeral filesystem,
# so it is recreated on every deploy (data does not persist across deploys).
set -euo pipefail

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input
