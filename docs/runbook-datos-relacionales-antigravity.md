# Runbook — datos relacionales (para Antigravity / staging)

**Branch:** `feature/datos-relacionales`  
**Plan:** [plan-refactor-datos-relacionales.md](plan-refactor-datos-relacionales.md)  
**Baseline:** [baseline-datos-relacionales.md](baseline-datos-relacionales.md)

Flags productivos siguen en **false** hasta activarlos en staging. No hace falta prod live: copia restaurada alcanza.

## 0. Preflight

```bash
git checkout feature/datos-relacionales
npm run admin:test          # incluye verify-relational-*
# Backup MariaDB + admin/api/data/ (ver backups-y-recuperacion.md)
# Restaurar SQL en DB de staging / local
# Apuntar config (KINESICA_ADMIN_CONFIG o private/admin-config.php) a esa DB
```

Token = `install_token` de config.

## 1. Migraciones

```bash
php admin/api/migrate.php --status --token="$INSTALL_TOKEN"
php admin/api/migrate.php --dry-run --token="$INSTALL_TOKEN"
php admin/api/migrate.php --token="$INSTALL_TOKEN"
```

Esperado: `001`…`005` applied (`paciente_contactos`, IDs nullable, version/deleted_at, `profesionales` seed norberto/maria).

## 2. Auditoría (read-only)

```bash
php admin/api/audit_relational.php --token="$INSTALL_TOKEN" \
  --out=docs/audit-report.json --md=docs/audit-report.md
```

Revisar `summary` + `manual_review`. **No fusionar** desde el informe.

## 3. Backfill (dry-run → apply)

```bash
php admin/api/backfill_relational.php --dry-run --token="$INSTALL_TOKEN" \
  --out=docs/backfill-dry.json

php admin/api/backfill_relational.php --apply --token="$INSTALL_TOKEN" \
  --out=docs/backfill-apply.json
```

Tablas: fichas, lista_espera, interacciones, recordatorios, `paciente_contactos`, `*_profesional_id`.

Solo:

```bash
php admin/api/backfill_relational.php --only=paciente_contactos,fichas_profesional_id --apply --token="$INSTALL_TOKEN"
```

## 4. Activar flags en staging (settings)

En `admin/api/data/settings.json` (o API settings):

```json
"relational_flags": {
  "write_ids": true,
  "read_ids": true,
  "enforce_fk": false
}
```

O env: `KINESICA_REL_WRITE_IDS=1` / `KINESICA_REL_READ_IDS=1`.

**No** activar `enforce_fk` aún.

## 5. Humo funcional

- Alta/edición paciente → filas en `paciente_contactos`
- Guardar ficha → `paciente_id` / `profesional_id` si match; respuesta con `version`
- Segundo save con `version` vieja → **409** `ficha_version_conflict`
- Lista espera / WhatsApp / recordatorios muestran nombre canónico si hay ID
- Mirar `admin/api/data/rel_unlinked.jsonl` y `rel_read_fallback.jsonl`

## 6. Re-auditoría

```bash
php admin/api/audit_relational.php --token="$INSTALL_TOKEN" \
  --out=docs/audit-report-post.json --md=docs/audit-report-post.md
```

Comparar huérfanos / fallback vs informe previo.

## Rollback rápido

1. `relational_flags.* = false` (o quitar env)
2. Columnas/IDs se conservan; la app vuelve a legacy
3. No borrar tablas nuevas sin backup

## Qué NO hacer todavía

- `REL_ENFORCE_FK` / FOREIGN KEY obligatorias
- Borrar columnas `telefono` / `profesional` texto
- Unificar Clara SQLite
- Fusionar DNI/teléfono ambiguos en automático
