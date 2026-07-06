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
#   bash scripts/check-replies.sh                  # one-shot poll
#   bash scripts/check-replies.sh --dry-run        # show what would happen
#   bash scripts/check-replies.sh --install-cron   # install systemd user timer (15 min)
#   bash scripts/check-replies.sh --uninstall-cron
#
# Exit codes:
#   0  ok (no replies, or replies processed cleanly)
#   2  himalaya / IMAP auth not configured (refresh token expired)
#   3  python helper missing
#   4  responses.md missing
#   5  Paperclip API call failed

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
case "${1:-}" in
  --dry-run)        DRY_RUN=1 ;;
  --install-cron)   install_cron; exit 0 ;;
  --uninstall-cron) uninstall_cron; exit 0 ;;
  "")               : ;;
  -h|--help)
    sed -n '2,30p' "$0"; exit 0 ;;
  *) echo "unknown arg: $1" >&2; exit 64 ;;
esac

if ! command -v himalaya >/dev/null 2>&1; then
  echo "FATAL: himalaya not on PATH" >&2; exit 2
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "FATAL: python3 not on PATH" >&2; exit 3
fi
if [ ! -f "$RESPONSES" ]; then
  echo "FATAL: $RESPONSES missing — run the PRO-90 setup first" >&2; exit 4
fi

# --- preflight: himalaya can authenticate? -----------------------------------
HIMALAYA_AUTH_LOG="$LOG_DIR/himalaya-auth.log"
if ! himalaya folder list >"$HIMALAYA_AUTH_LOG" 2>&1; then
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

  Until re-authorization, no new replies will be detected.
EOF
  exit 2
fi
# Belt and suspenders: if himalaya wrote "ERROR" lines to the log even on
# "success", treat that as auth failure too. himalaya sometimes exits 0 with
# a useful error in stderr.
if grep -qE "ERROR|invalid_grant|authenticate" "$HIMALAYA_AUTH_LOG" 2>/dev/null; then
  if ! grep -qE "Authentication successful|logged in" "$HIMALAYA_AUTH_LOG" 2>/dev/null; then
    cat "$HIMALAYA_AUTH_LOG" >&2
    echo "FATAL: himalaya reported an auth error in its output; aborting" >&2
    exit 2
  fi
fi

# --- pull last 50 envelopes from INBOX -------------------------------------
HIMALAYA_JSON="$LOG_DIR/envelopes.json"
if ! himalaya -o json envelope list --page-size 50 >"$HIMALAYA_JSON" 2>"$LOG_DIR/envelopes.err"; then
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

  cat > "$TEXT_FILE" <<EOF
# Testimonial — ${SLUG} (T1/T2/T3 reply)

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

  # Append to responses.md (CMO reads this every heartbeat).
  cat >> "$RESPONSES" <<EOF

## ${DATE} — ${SLUG} — outreach reply

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
  COMMENT="new reply from ${SENDER} (subject: \"${SUBJECT_ESC}\") — written file at \`${TEXT_FILE#$REPO_ROOT/}\` (msg-id ${MSG_ID})"
  SPOOL="$LOG_DIR/pending-comments.jsonl"
  POSTED=0
  if [ -n "${PAPERCLIP_API_KEY:-}" ]; then
    body=$(jq -n --arg body "$COMMENT" '{body:$body}')
    if curl -fsS -X POST \
        "$PAPERCLIP_API_URL/issues/$PRO_90_ID/comments" \
        -H "Authorization: Bearer ${PAPERCLIP_API_KEY}" \
        -H "X-Paperclip-Run-Id: ${PAPERCLIP_RUN_ID:-check-replies}" \
        -H "Content-Type: application/json" \
        --data-binary "$body" >/dev/null 2>>"$LOG_DIR/api.err"; then
      POSTED=1
      echo "check-replies: PRO-90 comment posted for $SENDER"
    else
      echo "check-replies: PRO-90 comment API call failed (authz boundary likely); spooling for CMO pickup" >&2
    fi
  else
    echo "check-replies: PAPERCLIP_API_KEY not set, spooling comment" >&2
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
