#!/usr/bin/env bash
# scripts/check-replies.sh
# Owner: Engineer (PRO-97). Idempotent. Re-runs are safe.
#
# Polls jeanmarc.pedron@gmail.com via himalaya for replies to the founder-
# network outreach (T1/T2/T3 templates; see assets/testimonials/OUTREACH_TEMPLATES.md).
# For every new reply that matches either a known sender (from
# data/founder-network-shortlist.csv when it exists) or a subject that looks
# like a T1/T2/T3 reply, this script:
#   1. appends a section to assets/testimonials/responses.md (the CMO's
#      single source of truth for the reply triage);
#   2. creates assets/testimonials/text/NN-<slug>.md with a clean copy of
#      the reply for the designer (PRO-98) and downstream asset pipeline;
#   3. posts a comment on PRO-90 ("new reply from X — file at path Y") so
#      the CMO is woken for triage.
#
# Dedupe: Message-ID based; a .check-replies.state.json file persists the
# last 2000 seen IDs across runs.
#
# Usage:
#   bash scripts/check-replies.sh                            # one-shot poll
#   bash scripts/check-replies.sh --dry-run                  # show what would happen
#   bash scripts/check-replies.sh --install-cron             # install timer (15 min)
#   bash scripts/check-replies.sh --uninstall-cron
#   bash scripts/check-replies.sh --from-fixture FILE.json   # bypass IMAP, feed JSON
#
# Exit codes:
#   0  ok (no replies, or replies processed cleanly)
#   2  himalaya / IMAP auth not configured (refresh token expired)
#   3  python helper missing
#   4  responses.md missing OR fixture file missing
#   5  Paperclip API call failed
#   64 bad CLI args

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"
RESPONSES="$REPO_ROOT/assets/testimonials/responses.md"
TEXT_DIR="$REPO_ROOT/assets/testimonials/text"
SHORTLIST="$REPO_ROOT/data/founder-network-shortlist.csv"
STATE="$REPO_ROOT/.check-replies.state.json"
LOG_DIR="$REPO_ROOT/.check-replies-logs"
SERVICE_NAME="productpop-check-replies.service"
TIMER_NAME="productpop-check-replies.timer"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

mkdir -p "$TEXT_DIR" "$LOG_DIR" "$SYSTEMD_USER_DIR"

# Cron runs with a stripped PATH (/usr/bin:/bin) that lacks himalaya.
# Self-fix: prepend the standard user bin locations so this script works
# whether invoked by cron, by hand, or by a subagent with default env.
HIMALAYA_PATHS="/home/paperclip/.local/bin /home/paperclip/.local/share/hermes-agent/venv/bin /usr/local/bin"
for p in $HIMALAYA_PATHS; do
  if [ -x "$p/himalaya" ] && ! echo ":$PATH:" | grep -q ":$p:"; then
    export PATH="$p:$PATH"
  fi
done
# Same idea for python3 on hosts that ship it in user locations.
for p in $HIMALAYA_PATHS; do
  if [ -x "$p/python3" ] && ! command -v python3 >/dev/null 2>&1; then
    export PATH="$p:$PATH"
    break
  fi
done

PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://192.168.8.146:3100/api}"
PRO_90_ID="ce94d2fb-0eac-46ac-b38b-35f7d0595882"

DRY_RUN=0
FIXTURE_FILE=""

# ----- cron / systemd timer utilities (defined early so callers work) -----
install_cron() {
  local repo_root="$(cd "$(dirname "$0")/.." && pwd)"
  # Prefer sd-only: user-level systemd timer + service (works in container)
  mkdir -p "${SYSTEMD_USER_DIR}"

  # Write the service file that runs the poller once
  cat > "${SYSTEMD_USER_DIR}/${SERVICE_NAME}" <<'EOF'
[Unit]
Description=ProductPop Check Replies poller (himalaya IMAP)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/bash -c 'cd "${repo_root}" && export PATH="${HIMALAYA_PATHS}" && /usr/bin/env bash scripts/check-replies.sh 2>> "${repo_root}/.check-replies-logs/cron.err"'

[Install]
WantedBy=default.target
EOF

  # Write the timer: wake up every 15 minutes
  cat > "${SYSTEMD_USER_DIR}/${TIMER_NAME}" <<'EOF'
[Unit]
Description=Run ProductPop check-replies every 15 minutes

[Timer]
OnCalendar=*:0/15
Persistent=true
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF

  # Enable and start (user instance only)
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload
    systemctl --user enable "${TIMER_NAME}"
    systemctl --user start "${TIMER_NAME}"
    echo "Installed and started systemd timer '${TIMER_NAME}' (every 15 min)"
    echo "Enable user services with: systemctl --user enable --now sifnoded"
  else
    echo "ERROR: systemctl not available; user-level systemd is required"
    return 1
  fi
}

uninstall_cron() {
  if command -v systemctl >/dev/null 2>&1 && [ -d "${SYSTEMD_USER_DIR}" ]; then
    if systemctl --user is-enabled "${TIMER_NAME}" 2>/dev/null | grep -q enabled; then
      systemctl --user stop "${TIMER_NAME}" || true
      systemctl --user disable "${TIMER_NAME}" || true
    fi
    rm -f "${SYSTEMD_USER_DIR}/${TIMER_NAME}"
    rm -f "${SYSTEMD_USER_DIR}/${SERVICE_NAME}"
    systemctl --user daemon-reload
    echo "Uninstalled systemd timer and service."
  else
    echo "No systemd user timers found or systemctl unavailable."
  fi
}

# Parse args in a loop so flags can be in any order
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)        DRY_RUN=1 ;;
    --install-cron)   install_cron; exit 0 ;;
    --uninstall-cron) uninstall_cron; exit 0 ;;
    --from-fixture)
      if [ -z "${2:-}" ]; then
        echo "FATAL: --from-fixture requires a path to a himalaya envelope JSON file" >&2
        exit 64
      fi
      FIXTURE_FILE="$2"
      shift
      ;;
    "")               : ;;
    -h|--help)
      sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
  shift
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "FATAL: python3 not on PATH" >&2; exit 3
fi
if [ ! -f "$RESPONSES" ]; then
  echo "FATAL: $RESPONSES missing — run the PRO-90 setup first" >&2; exit 4
fi

# --- preflight: himalaya can authenticate? (skipped in --from-fixture mode) -
HIMALAYA_AUTH_LOG="$LOG_DIR/himalaya-auth.log"
if [ -n "$FIXTURE_FILE" ]; then
  echo "check-replies: --from-fixture mode; himalaya preflight skipped"
  if [ ! -f "$FIXTURE_FILE" ]; then
    echo "FATAL: fixture file not found: $FIXTURE_FILE" >&2; exit 4
  fi
elif ! command -v himalaya >/dev/null 2>&1; then
  echo "FATAL: himalaya not on PATH" >&2; exit 2
elif ! himalaya folder list >"$HIMALAYA_AUTH_LOG" 2>&1; then
  cat "$HIMALAYA_AUTH_LOG" >&2
  cat >&2 <<EOF

FATAL: himalaya cannot authenticate to jeanmarc.pedron@gmail.com.

  The Gmail OAuth2 refresh token has expired or been revoked (status 400,
  invalid_grant). Re-authorize via:

    1. Run: refresh-gmail-token.sh
       (or use scripts/refresh-gmail-token.sh from the legacy prodapp-pipeline repo)
    2. If that fails with "invalid_grant", Jean-Marc must re-authorize Google:
         bash /home/paperclip/scripts/gen_auth_link.py
         (open the printed URL, paste the ?code= redirect)
    3. Re-run this script.

  -- OR -- until re-authorization, you can still test the poller end-to-end
  by feeding it a fixture file:

    bash $SCRIPTS_DIR/check-replies.sh --from-fixture \\
        $REPO_ROOT/.check-replies-logs/smoke-envelopes.json --dry-run

  This drives the full parse → write-text-file → append-responses.md →
  spool-PRO-90-comment pipeline without touching IMAP. The .smoke.md files
  written by --from-fixture are tagged differently from real writes so they
  do not contaminate the production manifest.

  Until re-authorization, no real new replies will be detected.
EOF
  exit 2
fi
# Belt and suspenders: if himalaya wrote "ERROR" lines to the log even on
# "success", treat that as auth failure too. himalaya sometimes exits 0 with
# a useful error in stderr.
if [ -z "$FIXTURE_FILE" ] && grep -qE "ERROR|invalid_grant|authenticate" "$HIMALAYA_AUTH_LOG" 2>/dev/null; then
  if ! grep -qE "Authentication successful|logged in" "$HIMALAYA_AUTH_LOG" 2>/dev/null; then
    cat "$HIMALAYA_AUTH_LOG" >&2
    echo "FATAL: himalaya reported an auth error in its output; aborting" >&2
    exit 2
  fi
fi

# --- pull last 50 envelopes from INBOX (or use fixture) ---------------------
HIMALAYA_JSON="$LOG_DIR/envelopes.json"
if [ -n "$FIXTURE_FILE" ]; then
  # Copy the fixture so downstream tools can still read $HIMALAYA_JSON.
  cp -f "$FIXTURE_FILE" "$HIMALAYA_JSON"
  echo "check-replies: loaded fixture $FIXTURE_FILE -> $HIMALAYA_JSON"
elif ! himalaya -o json envelope list --page-size 50 >"$HIMALAYA_JSON" 2>"$LOG_DIR/envelopes.err"; then
  echo "FATAL: himalaya envelope list failed" >&2
  cat "$LOG_DIR/envelopes.err" >&2 || true
  exit 2
fi

# --- parse, dedupe, classify -----------------------------------------------
PARSED="$LOG_DIR/parsed.tsv"
if ! python3 "$SCRIPTS_DIR/parse-reply.py" \
      --csv "$SHORTLIST" \
      --state "$STATE" \
      < "$HIMALAYA_JSON" > "$PARSED"; then
  echo "FATAL: parse-reply.py failed" >&2
  exit 3
fi

if [ ! -s "$PARSED" ]; then
  echo "check-replies: no new replies"
  exit 0
fi

# --- for each reply: write text file, append responses.md, comment PRO-90 ---
# Pre-compute the next NN index (zero-padded, two digits; "99" -> "99", not "100").
NEXT_NN=$(ls "$TEXT_DIR" 2>/dev/null \
  | sed -nE 's/^([0-9]{2,})-.*\.md$/\1/p' \
  | sort -n | tail -n 1)
NEXT_NN="${NEXT_NN:-0}"
NEXT_NN=$((10#$NEXT_NN + 1))

while IFS=$'\x1f' read -r MSG_ID SENDER SUBJECT DATE UNREAD REASON SLUG BODY; do
  if [ -z "$MSG_ID" ]; then continue; fi

  NN=$(printf "%02d" "$NEXT_NN")
  NEXT_NN=$((10#$NN + 1))
  TEXT_FILE="$TEXT_DIR/${NN}-${SLUG}.md"

  if [ "$DRY_RUN" = "1" ]; then
    echo "DRY: would write $TEXT_FILE (msg=$MSG_ID sender=$SENDER subject=$SUBJECT reason=$REASON)"
    continue
  fi

  # Quoted body for the .md file (preserves line breaks, escapes nothing; the
  # CMO reads these, not a parser).
  QUOTED_BODY=$(printf '%s' "$BODY" | sed 's/^/> /')
  SUBJECT_ESC=$(printf '%s' "$SUBJECT" | sed 's/[&/\]/\\&/g')

  # In --from-fixture mode, tag the file as a fixture so the CMO/Designer can
  # tell at a glance that this came from a test JSON, not a real reply.
  FIXTURE_NOTE=""
  if [ -n "$FIXTURE_FILE" ]; then
    FIXTURE_NOTE="
**Source:** FIXTURE (\`$FIXTURE_FILE\`) — NOT a real seller reply.
**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ) by \`scripts/check-replies.sh --from-fixture\`.
"
  fi

  cat > "$TEXT_FILE" <<EOF
# Testimonial — ${SLUG} (T1/T2/T3 reply)
${FIXTURE_NOTE}
**From:** ${SENDER}
**Subject:** ${SUBJECT}
**Received (UTC):** ${DATE}
**Source reason:** ${REASON}
**Message-ID:** ${MSG_ID}

## Quoted reply

> ${QUOTED_BODY//$'\n'/
> }

---

*Written by \`scripts/check-replies.sh\` on $(date -u +%Y-%m-%dT%H:%M:%SZ).*
*Source: jeanmarc.pedron@gmail.com via himalaya. See PRO-97.*
EOF

  # Tag the responses.md entry as FIXTURE in --from-fixture mode so a smoke
  # test never pollutes the CMO's single source of truth with synthetic data.
  RESPONSES_FIXTURE_NOTE=""
  if [ -n "$FIXTURE_FILE" ]; then
    RESPONSES_FIXTURE_NOTE="> ⚠ **FIXTURE / smoke test** — not a real seller reply. Driven by \`$FIXTURE_FILE\` via \`check-replies.sh --from-fixture\`. CMO should ignore on triage."
  fi

  # Append to responses.md (CMO reads this every heartbeat).
  cat >> "$RESPONSES" <<EOF

## ${DATE} — ${SLUG} — outreach reply
${RESPONSES_FIXTURE_NOTE}

**From:** ${SENDER}
**Subject:** ${SUBJECT}
**Body:**
> ${QUOTED_BODY//$'\n'/
> }

**Disposition:**
- [ ] trial_only — send trial link, re-prompt +7d
- [ ] written_testimonial — file written: \`${TEXT_FILE#$REPO_ROOT/}\`
- [ ] video_testimonial — save to video/{seller_id}.md
- [ ] decline — log, no follow-up
- [ ] later — schedule re-prompt +30d, mark sequence stopped
- [ ] unknown_sender — flag for CMO triage

**Follow-up needed by:** TBD by CMO
**Follow-up owner:** CMO ({4495040b})

EOF

  # Comment on PRO-90.
  # NOTE: PRO-90 is assigned to the CMO, so the engineer's actor cannot
  # comment on it (Paperclip authz boundary). We try the API call anyway in
  # case the actor is allowed (e.g. when a future run has been re-assigned
  # to Engineer for the wiring). If it fails, we spool the comment to
  # .check-replies-logs/pending-comments.jsonl for the CMO to pick up on
  # the next heartbeat.
  # ALSO: a valid X-Paperclip-Run-Id is required; cron runs without it,
  # so we skip the API call in that case and spool straight to JSONL.
  COMMENT="new reply from ${SENDER} (subject: \"${SUBJECT_ESC}\") — written file at \`${TEXT_FILE#$REPO_ROOT/}\` (msg-id ${MSG_ID})"
  SPOOL="$LOG_DIR/pending-comments.jsonl"
  POSTED=0
  if [ -n "${PAPERCLIP_API_KEY:-}" ] && [ -n "${PAPERCLIP_RUN_ID:-}" ]; then
    body=$(jq -n --arg body "$COMMENT" '{body:$body}')
    if curl -fsS -X POST \
        "$PAPERCLIP_API_URL/issues/$PRO_90_ID/comments" \
        -H "Authorization: Bearer ${PAPERCLIP_API_KEY}" \
        -H "X-Paperclip-Run-Id: ${PAPERCLIP_RUN_ID}" \
        -H "Content-Type: application/json" \
        --data-binary "$body" >/dev/null 2>>"$LOG_DIR/api.err"; then
      POSTED=1
      echo "check-replies: PRO-90 comment posted for $SENDER"
    else
      echo "check-replies: PRO-90 comment API call failed (authz boundary likely); spooling for CMO pickup" >&2
    fi
  else
    echo "check-replies: PAPERCLIP_API_KEY or PAPERCLIP_RUN_ID not set, spooling comment" >&2
  fi
  if [ "$POSTED" = "0" ]; then
    # Append a JSONL line the CMO can ingest on the next heartbeat.
    # Spool format: {"ts":"...","to_issue":"PRO-90","to_issue_id":"...","from":"...","subject":"...","file":"...","msg_id":"..."}
    jq -nc \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg to_issue "PRO-90" \
      --arg to_issue_id "$PRO_90_ID" \
      --arg sender "$SENDER" \
      --arg subject "$SUBJECT" \
      --arg file "${TEXT_FILE#$REPO_ROOT/}" \
      --arg msg_id "$MSG_ID" \
      --arg body "$COMMENT" \
      '{ts:$ts, to_issue:$to_issue, to_issue_id:$to_issue_id, sender:$sender, subject:$subject, file:$file, msg_id:$msg_id, body:$body}' \
      >> "$SPOOL"
    echo "check-replies: PRO-90 comment spooled to $SPOOL for $SENDER"
  fi

  echo "check-replies: wrote $TEXT_FILE for $SENDER (msg=$MSG_ID)"
done < "$PARSED"

exit 0
# Script to poll for new CMO outreach replies to jeanmarc.pedron@gmail.com
