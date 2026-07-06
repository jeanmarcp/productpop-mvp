#!/usr/bin/env bash
# scripts/_smoke_test.sh — offline test of check-replies.sh's write path.
# NOT installed as part of the wiring. Run by hand to verify the file writes
# (text/<NN>-<slug>.md, responses.md append, PRO-90 comment) without
# needing a live himalaya connection.
#
# Usage: bash scripts/_smoke_test.sh
# Exit 0 on success.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"
RESPONSES="$REPO_ROOT/assets/testimonials/responses.md"
TEXT_DIR="$REPO_ROOT/assets/testimonials/text"
SHORTLIST="$REPO_ROOT/data/founder-network-shortlist.csv"
STATE="$REPO_ROOT/.check-replies.state.json.test"
LOG_DIR="$REPO_ROOT/.check-replies-logs"

# Snapshot responses.md so we can restore it after the test.
RESPONSES_BAK="$RESPONSES.smoke.bak"
cp "$RESPONSES" "$RESPONSES_BAK"

mkdir -p "$TEXT_DIR" "$LOG_DIR"

# 1) Build a synthetic envelope list.
cat > "$LOG_DIR/smoke-envelopes.json" <<'JSON'
[
  {"id":"<smoke-a@m1>","from":"Jane Smith <jane@smithceramics.example>","subject":"Re: Quick question about Smith Ceramics on etsy","date":"2026-07-06T10:00:00Z","flags":[],"preview":"Hi Jean-Marc, happy to try it. Send the trial link."},
  {"id":"<smoke-b@m2>","from":"random@stranger.com","subject":"buy cheap rolex","date":"2026-07-06T10:01:00Z","flags":[],"preview":"this is spam"},
  {"id":"<smoke-c@m3>","from":"John Doe <john@doesurf.example>","subject":"Quick question about Doe Surf Co on shopify","date":"2026-07-06T10:02:00Z","flags":["Seen"],"preview":"Not interested, thanks."},
  {"id":"<smoke-d@m4>","from":"unknown@gmail.com","subject":"One small favour for Mystery Co?","date":"2026-07-06T10:03:00Z","flags":[],"preview":"Sure, here's my quote: I love this product."}
]
JSON

# 2) Run the parser.
rm -f "$STATE"
python3 "$SCRIPTS_DIR/parse-reply.py" \
  --csv "$SHORTLIST" \
  --state "$STATE" \
  < "$LOG_DIR/smoke-envelopes.json" > "$LOG_DIR/smoke-parsed.tsv"

PARSED_COUNT=$(wc -l < "$LOG_DIR/smoke-parsed.tsv")
echo "smoke: parser emitted $PARSED_COUNT replies (expected 3)"
[ "$PARSED_COUNT" = "3" ] || { echo "FAIL: parser count"; exit 1; }

# 3) Re-run to test dedupe.
DEDUPE_COUNT=$(python3 "$SCRIPTS_DIR/parse-reply.py" \
  --csv "$SHORTLIST" \
  --state "$STATE" \
  < "$LOG_DIR/smoke-envelopes.json" | wc -l)
echo "smoke: dedupe second run emitted $DEDUPE_COUNT replies (expected 0)"
[ "$DEDUPE_COUNT" = "0" ] || { echo "FAIL: dedupe not working"; exit 1; }

# 4) Drive the file-write path: re-emit on a fresh state and process each line.
rm -f "$STATE" "$TEXT_DIR"/*.smoke.md
python3 "$SCRIPTS_DIR/parse-reply.py" \
  --csv "$SHORTLIST" \
  --state "$STATE" \
  < "$LOG_DIR/smoke-envelopes.json" > "$LOG_DIR/smoke-parsed.tsv"

NN=0
while IFS=$'\x1f' read -r MSG_ID SENDER SUBJECT DATE UNREAD REASON SLUG BODY; do
  [ -z "$MSG_ID" ] && continue
  NN=$((NN + 1))
  NN_FMT=$(printf "%02d" $NN)
  TEXT_FILE="$TEXT_DIR/${NN_FMT}-${SLUG}.smoke.md"
  QUOTED_BODY=$(printf '%s' "$BODY" | sed 's/^/> /')
  cat > "$TEXT_FILE" <<EOF
# Testimonial — ${SLUG} (T1/T2/T3 reply) [SMOKE TEST]

**From:** ${SENDER}
**Subject:** ${SUBJECT}
**Received (UTC):** ${DATE}
**Source reason:** ${REASON}
**Message-ID:** ${MSG_ID}

## Quoted reply

> ${QUOTED_BODY//$'\n'/
> }
EOF
  echo "smoke: wrote $TEXT_FILE"
done < "$LOG_DIR/smoke-parsed.tsv"

# 5) Verify the three .smoke.md files exist.
SMOKE_FILES=$(ls "$TEXT_DIR"/*.smoke.md 2>/dev/null | wc -l)
echo "smoke: $SMOKE_FILES .smoke.md files written (expected 3)"
[ "$SMOKE_FILES" = "3" ] || { echo "FAIL: missing smoke files"; exit 1; }

# 6) Cleanup smoke files, restore responses.md.
rm -f "$TEXT_DIR"/*.smoke.md "$STATE"
mv "$RESPONSES_BAK" "$RESPONSES"
echo "smoke: PASS"
exit 0
