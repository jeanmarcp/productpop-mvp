#!/usr/bin/env bash
# scripts/uninstall-cron.sh — remove the 15-min check-replies schedule.
# Symmetric counterpart to install-cron.sh.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_NAME="productpop-check-replies.service"
TIMER_NAME="productpop-check-replies.timer"
SERVICE_FILE="$SYSTEMD_USER_DIR/$SERVICE_NAME"
TIMER_FILE="$SYSTEMD_USER_DIR/$TIMER_NAME"

# systemd
if command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1; then
  systemctl --user disable --now "$TIMER_NAME" 2>/dev/null || true
  rm -f "$TIMER_FILE" "$SERVICE_FILE"
  systemctl --user daemon-reload
  echo "OK: systemd timer + service removed"
fi

# crontab
if command -v crontab >/dev/null 2>&1; then
  TMP="$(mktemp)"
  crontab -l 2>/dev/null | grep -v 'productpop-check-replies' > "$TMP" || true
  crontab "$TMP" 2>/dev/null || true
  rm -f "$TMP"
  echo "OK: crontab entry removed"
fi
