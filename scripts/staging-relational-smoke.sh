#!/usr/bin/env bash
# Smoke staging — datos relacionales (NO toca prod).
#
# Requisitos:
#   export KINESICA_ADMIN_CONFIG=/ruta/admin-config-staging.php
#   export INSTALL_TOKEN='…'   # install_token del config staging
#
# Opcional restore (si tenés mysql client + dump):
#   export STAGING_DUMP=/ruta/kinesica-backup-YYYY-MM-DD.sql
#   export STAGING_MYSQL_ARGS='-h 127.0.0.1 -u USER -pPASS DBNAME'
#   (mejor: mysql_config_editor / prompt -p sin PASS en env)
#
# Docs: docs/checklist-staging-datos-relacionales.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "${KINESICA_ADMIN_CONFIG:-}" ]] || die "Definí KINESICA_ADMIN_CONFIG (config staging, no prod)."
[[ -f "$KINESICA_ADMIN_CONFIG" ]] || die "No existe KINESICA_ADMIN_CONFIG=$KINESICA_ADMIN_CONFIG"
[[ -n "${INSTALL_TOKEN:-}" ]] || die "Definí INSTALL_TOKEN (install_token del config staging)."

echo "== Config staging =="
echo "KINESICA_ADMIN_CONFIG=$KINESICA_ADMIN_CONFIG"
# Pista (sin imprimir password): nombre de DB desde el PHP si es legible
if command -v php >/dev/null 2>&1; then
  php -r '
    $c = require getenv("KINESICA_ADMIN_CONFIG");
    $n = $c["db"]["name"] ?? "?";
    echo "db.name=" . $n . PHP_EOL;
    if (stripos((string)$n, "stg") === false && stripos((string)$n, "staging") === false && stripos((string)$n, "test") === false) {
      fwrite(STDERR, "AVISO: db.name no parece staging. Abortá si es producción.\n");
    }
  ' || true
fi

if [[ -n "${STAGING_DUMP:-}" ]]; then
  [[ -f "$STAGING_DUMP" ]] || die "STAGING_DUMP no existe: $STAGING_DUMP"
  [[ -n "${STAGING_MYSQL_ARGS:-}" ]] || die "Con STAGING_DUMP hace falta STAGING_MYSQL_ARGS (ej. '-h 127.0.0.1 -u u -p db')."
  echo "== Restore dump → staging =="
  echo "mysql $STAGING_MYSQL_ARGS < $STAGING_DUMP"
  # shellcheck disable=SC2086
  mysql $STAGING_MYSQL_ARGS < "$STAGING_DUMP"
  echo "Restore OK."
fi

echo "== npm run admin:test =="
npm run admin:test

echo "== migrate --status =="
php admin/api/migrate.php --status --token="$INSTALL_TOKEN"

echo "== migrate --dry-run =="
php admin/api/migrate.php --dry-run --token="$INSTALL_TOKEN"

if [[ "${STAGING_MIGRATE_APPLY:-}" == "1" ]]; then
  echo "== migrate APPLY (STAGING_MIGRATE_APPLY=1) =="
  php admin/api/migrate.php --token="$INSTALL_TOKEN"
else
  echo "(Omitido migrate apply. Para aplicarlo: STAGING_MIGRATE_APPLY=1 $0)"
fi

if [[ "${STAGING_AUDIT:-}" == "1" ]]; then
  echo "== audit =="
  mkdir -p docs
  php admin/api/audit_relational.php --token="$INSTALL_TOKEN" \
    --out=docs/audit-report-staging.json --md=docs/audit-report-staging.md
fi

echo ""
echo "OK smoke staging (código + dry-run)."
echo "Siguiente: checklist humo UI → docs/checklist-staging-datos-relacionales.md §E"
