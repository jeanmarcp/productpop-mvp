#!/usr/bin/env python3
"""
parse-reply.py — small helper for check-replies.sh.

Reads himalaya message JSON (--output json) on stdin, picks out the fields we
need, decides if a message is a "reply to outreach" (subject match OR sender
in the founder-network-shortlist.csv), and emits one line per match to stdout
in a stable, easy-to-parse key=value format. The shell script glues these
lines to file writes and Paperclip API comments.

Design choices:
- Stdlib only (no pip deps). The shell side can shell-escape safely.
- One line per message, fields separated by U+001F (unit separator), so
  unusual characters in the body never break parsing.
- The Message-ID is the dedupe key. We refuse to emit a message with an empty
  Message-ID (treated as unprocessable).
- The "is reply?" decision is conservative: if we can't positively match, we
  emit nothing. False negatives are recoverable; false positives spam CMO.

Usage:
  himalaya -o json envelope list --page-size 50 \
    | python3 scripts/parse-reply.py \
        --csv productpop-mvp/data/founder-network-shortlist.csv \
        --state /home/paperclip/productpop-mvp/.check-replies.state.json
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

SEP = "\x1f"

# Subject prefixes used in the T1/T2/T3 templates (see OUTREACH_TEMPLATES.md).
# If a subject starts with one of these (case-insensitive, "Re:" stripped), we
# treat it as a reply. T2 is "Re: <T1 subject>". T3 is a fresh subject.
SUBJECT_PATTERNS = [
    r"^re:\s*quick question about\b",
    r"^re:\s*one small favour\b",
    r"^quick question about\b",
    r"^one small favour\b",
]


def _strip_re_prefix(subject: str) -> str:
    s = subject.strip()
    while s.lower().startswith("re:"):
        s = s[3:].lstrip()
    return s


def _subject_matches(subject: str) -> bool:
    s = _strip_re_prefix(subject)
    return any(re.match(p, s, flags=re.IGNORECASE) for p in SUBJECT_PATTERNS)


def _load_known_senders(csv_path: Path) -> set[str]:
    if not csv_path.exists():
        return set()
    out: set[str] = set()
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = (row.get("email") or "").strip().lower()
            if email:
                out.add(email)
    return out


def _extract_addr(from_header: str) -> str:
    # himalaya gives something like "Name <addr@x>" or just "addr@x".
    m = re.search(r"<([^>]+)>", from_header or "")
    addr = (m.group(1) if m else (from_header or "")).strip()
    return addr.lower()


def _slug(sender: str) -> str:
    base = sender.split("@", 1)[0] if "@" in sender else sender
    base = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    return base or "unknown"


def _read_state(state_path: Path) -> dict:
    if not state_path.exists():
        return {"seen_message_ids": [], "index": 0}
    try:
        return json.loads(state_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"seen_message_ids": [], "index": 0}


def _write_state(state_path: Path, state: dict) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = state_path.with_suffix(state_path.suffix + ".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    os.replace(tmp, state_path)


def _coerce_timestamp(raw: str | int | float | None) -> str:
    """Return ISO 8601 UTC string from whatever himalaya gives us."""
    if not raw:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    # himalaya v1.2.0 envelope JSON: date is RFC 3339 string.
    try:
        # Already ISO-ish?
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).astimezone(
            timezone.utc
        ).strftime("%Y-%m-%dT%H:%M:%SZ")
    except (TypeError, ValueError):
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _iter_messages(envelope_doc: dict | list) -> Iterable[dict]:
    """Yield message objects from whatever shape himalaya gives back."""
    if isinstance(envelope_doc, list):
        for m in envelope_doc:
            if isinstance(m, dict):
                yield m
        return
    if isinstance(envelope_doc, dict):
        for key in ("messages", "envelopes", "items", "results", "data"):
            if key in envelope_doc and isinstance(envelope_doc[key], list):
                for m in envelope_doc[key]:
                    if isinstance(m, dict):
                        yield m
                return
        # Single envelope case.
        if "id" in envelope_doc or "message_id" in envelope_doc:
            yield envelope_doc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, type=Path,
                        help="founder-network-shortlist.csv (may be empty)")
    parser.add_argument("--state", required=True, type=Path,
                        help="dedupe state JSON file")
    args = parser.parse_args()

    known = _load_known_senders(args.csv)
    state = _read_state(args.state)
    seen: set[str] = set(state.get("seen_message_ids") or [])

    try:
        raw = sys.stdin.read()
    except KeyboardInterrupt:
        return 130
    if not raw.strip():
        return 0
    try:
        doc = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"ERROR: cannot parse himalaya JSON: {e}", file=sys.stderr)
        return 2

    out_lines: list[str] = []
    new_seen: list[str] = list(seen)
    for msg in _iter_messages(doc):
        # himalaya envelope JSON fields (best-effort across versions).
        message_id = (
            msg.get("message_id")
            or msg.get("id")
            or msg.get("uid")
            or msg.get("Message-ID")
            or ""
        )
        if not message_id:
            continue
        if message_id in seen:
            continue
        from_header = (
            msg.get("from")
            or msg.get("sender")
            or msg.get("from_addr")
            or ""
        )
        if isinstance(from_header, list):
            from_header = from_header[0] if from_header else ""
        sender = _extract_addr(str(from_header))
        subject = (msg.get("subject") or msg.get("Subject") or "").strip()
        date = _coerce_timestamp(
            msg.get("date") or msg.get("internal_date") or msg.get("Date")
        )
        flags = msg.get("flags") or []
        if isinstance(flags, str):
            flags = [flags]
        is_unread = (
            "seen" not in [f.lower() if isinstance(f, str) else "" for f in flags]
        )
        body = (
            msg.get("preview")
            or msg.get("snippet")
            or msg.get("body")
            or ""
        )
        if isinstance(body, list):
            body = "\n".join(str(b) for b in body)
        body = str(body).strip()

        match_reason = ""
        if _subject_matches(subject):
            match_reason = "subject"
        elif sender in known:
            match_reason = "known_sender"
        elif sender.endswith("@gmail.com") and _subject_matches(subject):
            match_reason = "gmail_subject"
        if not match_reason:
            continue

        slug = _slug(sender)
        record = SEP.join([
            message_id,
            sender,
            subject,
            date,
            "1" if is_unread else "0",
            match_reason,
            slug,
            body.replace("\r\n", "\n"),
        ])
        out_lines.append(record)
        new_seen.append(message_id)

    # Cap the dedupe log so it doesn't grow forever. Keep last 2000 ids.
    new_seen = new_seen[-2000:]
    state["seen_message_ids"] = new_seen
    state["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    _write_state(args.state, state)

    sys.stdout.write("\n".join(out_lines))
    if out_lines:
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
