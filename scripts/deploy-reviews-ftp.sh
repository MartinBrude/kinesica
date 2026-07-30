#!/usr/bin/env bash
# Upload review assets (+ home HTML cache-bust) to Hostinger via FTP/FTPS.
# Env: FTP_HOST, FTP_USER, FTP_PASS, optional FTP_REMOTE_DIR, FTP_SECURE=true
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${FTP_HOST:-}" || -z "${FTP_USER:-}" || -z "${FTP_PASS:-}" ]]; then
  echo "HOSTINGER_FTP_HOST/USER/PASSWORD not set — skip deploy."
  exit 0
fi

REMOTE="${FTP_REMOTE_DIR:-.}"
REMOTE="${REMOTE#/}"
REMOTE="${REMOTE%/}"
[[ -z "$REMOTE" ]] && REMOTE="."

FILES=(
  js/reviews.min.js
  partials/google-reviews-data.js
  partials/google-reviews-data.min.js
  index.html
  en/index.html
  fr/index.html
  pt/index.html
)

PROTO="ftp"
CURL_OPTS=(--fail --silent --show-error --ftp-create-dirs)
if [[ "${FTP_SECURE:-}" == "true" || "${FTP_SECURE:-}" == "1" ]]; then
  PROTO="ftps"
  CURL_OPTS+=(--ssl-reqd)
fi

echo "Uploading ${#FILES[@]} file(s) to ${PROTO}://${FTP_HOST}/${REMOTE}/ …"
for rel in "${FILES[@]}"; do
  if [[ ! -f "$rel" ]]; then
    echo "Missing $rel — skip"
    continue
  fi
  remote_path="${REMOTE}/${rel}"
  [[ "$REMOTE" == "." ]] && remote_path="$rel"
  echo "  → $remote_path"
  curl "${CURL_OPTS[@]}" \
    --user "${FTP_USER}:${FTP_PASS}" \
    -T "$rel" \
    "${PROTO}://${FTP_HOST}/${remote_path}"
done
echo "Hostinger deploy done."
