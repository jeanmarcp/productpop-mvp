#!/usr/bin/env bash
# scripts/install-cron.sh — wire scripts/check-replies.sh to a 15-min timer.
# Owned by Engineer (PRO-97). Two backends supported:
#   - systemd user timer (preferred, no sudo, survives reboots, observable via
#     systemctl --user status)
#   - crontab fallback if systemd --user is not available on this host.
#
# Idempotent: re-running replaces the previous install cleanly.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"
SERVICE_NAME="productpop-check-replies.service"
TIMER_NAME="productpop-check-replies.timer"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_FILE="$SYSTEMD_USER_DIR/$SERVICE_NAME"
TIMER_FILE="$SYSTEMD_USER_DIR/$TIMER_NAME"

mkdir -p "$SYSTEMD_USER_DIR"

write_systemd_units() {
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ProductPop: poll jeanmarc.pedron@gmail.com for outreach replies
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
Environment=PAPERCLIP_API_URL=${PAPERCLIP_API_URL:-http://192.168.8.146:3100/api}
Environment=PAPERCLIP_API_KEY=${PAPERCLIP_API_KEY:-}
Environment=PAPERCLIP_RUN_ID=${PAPERCLIP_RUN_ID:-cron-check-replies}
ExecStart=/usr/bin/env bash $SCRIPTS_DIR/check-replies.sh
StandardOutput=append:$REPO_ROOT/.check-replies-logs/timer.out
StandardError=append:$REPO_ROOT/.check-replies-logs/timer.err
Nice=10

[Install]
WantedBy=default.target
EOF

  cat > "$TIMER_FILE" <<EOF
[Unit]
Description=Run ProductPop check-replies every 15 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
AccuracySec=1min
Persistent=true
Unit=$SERVICE_NAME

[Install]
WantedBy=timers.target
EOF
}

enable_systemd() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 1
  fi
  if ! systemctl --user status >/dev/null 2>&1; then
    return 1
  fi
  write_systemd_units
  systemctl --user daemon-reload
  systemctl --user enable "$TIMER_NAME"
  systemctl --user start "$TIMER_NAME"
  return 0
}

enable_crontab() {
  if ! command -v crontab >/dev/null 2>&1; then
    echo "FATAL: neither systemd --user nor crontab is available" >&2
    exit 1
  fi
  TMP="$(mktemp)"
  crontab -l 2>/dev/null | grep -v 'productpop-check-replies' > "$TMP" || true
  cat >> "$TMP" <<EOF
# ProductPop check-replies (PRO-97): poll jeanmarc.pedron@gmail.com every 15 min
PAPERCLIP_API_URL=${PAPERCLIP_API_URL:-http://192.168.8.146:3100/api}
*/15 * * * * /usr/bin/env bash $SCRIPTS_DIR/check-replies.sh >> $REPO_ROOT/.check-replies-logs/cron.out 2>> $REPO_ROOT/.check-replies-logs/cron.err
EOF
  crontab "$TMP"
  rm -f "$TMP"
}

echo "Installing ProductPop check-replies (15-min poll)..."
if enable_systemd; then
  echo "OK: systemd user timer installed: $TIMER_NAME"
  echo "  status: systemctl --user status $TIMER_NAME"
  echo "  next run: systemctl --user list-timers $TIMER_NAME"
  echo "  logs:    journalctl --user -u $SERVICE_NAME -n 50"
  echo "  uninstall: $SCRIPTS_DIR/install-cron.sh --uninstall"
else
  echo "systemd --user unavailable, falling back to crontab..."
  enable_crontab
  echo "OK: crontab entry installed (every 15 min)"
  echo "  list:   crontab -l | grep check-replies"
  echo "  uninstall: $SCRIPTS_DIR/install-cron.sh --uninstall"
fi
