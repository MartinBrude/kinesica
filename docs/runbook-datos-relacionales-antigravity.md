# Runbook — datos relacionales (para Antigravity / staging)

**Branch:** `feature/datos-relacionales`  
**Plan:** [plan-refactor-datos-relacionales.md](plan-refactor-datos-relacionales.md)  
**Baseline:** [baseline-datos-relacionales.md](baseline-datos-relacionales.md)  
**Mapa de código:** [codigo-datos-relacionales.md](codigo-datos-relacionales.md)  
**Etapa 7:** [etapa7-whatsapp-encuestas.md](etapa7-whatsapp-encuestas.md)  
**Etapa 8:** [etapa8-config-gastos.md](etapa8-config-gastos.md)  
**Etapa 9:** [etapa9-integridad-referencial.md](etapa9-integridad-referencial.md)  
**Etapa 10:** [etapa10-retiro-compatibilidad.md](etapa10-retiro-compatibilidad.md)  
**Auditoría cutover (Antigravity):** [instructivo-antigravity-auditoria-cutover.md](instructivo-antigravity-auditoria-cutover.md)

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

Esperado: `001`…`014` applied (… FKs `013`, marcador compat `014`; `ensure_*` siguen ON).

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

Tablas: fichas, lista_espera, interacciones, recordatorios, `paciente_contactos`, `*_profesional_id`, `turnos`, `recordatorios_turno_id`.

Solo:

```bash
php admin/api/backfill_relational.php --only=paciente_contactos,fichas_profesional_id --apply --token="$INSTALL_TOKEN"

# Etapa 6: primero turnos, luego link turno_id
php admin/api/backfill_relational.php --only=turnos,recordatorios_turno_id --apply --token="$INSTALL_TOKEN"

# Etapa 7: conversaciones + encuestas JSON→DB
php admin/api/backfill_relational.php --only=interaccion_estado,encuestas --apply --token="$INSTALL_TOKEN"

# Etapa 8: contactos profesionales + settings slices + gastos
php admin/api/backfill_relational.php --only=profesionales_contactos,configuraciones,gastos --apply --token="$INSTALL_TOKEN"
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

Activar `enforce_fk` **solo** tras mig 013 + backup/restore OK + humo FK (etapa 9).

## 5. Humo funcional

- Alta/edición paciente → filas en `paciente_contactos`
- Guardar ficha → `paciente_id` / `profesional_id` si match; respuesta con `version`
- Segundo save con `version` vieja → **409** `ficha_version_conflict`
- Lista espera / WhatsApp / recordatorios muestran nombre canónico si hay ID
- Listar campaña → filas en `turnos` por `calendar_event_id` (si mig 006 aplicada)
- Ingest recordatorio con event id → `turno_id` set
- Admin booking / backup book → fila en `turnos`
- `POST turnos.php` cancel → turno cancelled + pending recordatorios skipped
- Redeploy GAS con `mirrorTurnoToAdmin` (Script property opcional `TURNOS_MIRROR_URL`)
- Encuesta pública → fila en `encuestas` (y JSON espejo)
- `POST interacciones.php` `link_paciente` vincula hilo huérfano
- Guardar settings/horarios/fees/Clara → filas en `configuraciones` + `auditoria_cambios`
- CRUD gastos → filas en `gastos` (+ JSON espejo)
- DELETE paciente → soft-delete (`deleted_at`); hard-delete bloqueado por FK si se intenta en SQL
- Con `enforce_fk`: ficha con `paciente_id` inválido → 422
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

- Activar `REL_ENFORCE_FK` en prod sin backup/restore + audit limpio
- DROP columnas `telefono` / `fichas.profesional` (post-Go; mig 015+)
- NOT NULL masivo sin 100 % backfill
- Unificar Clara SQLite
- Fusionar DNI/teléfono ambiguos en automático

Tras auditoría: veredicto en `docs/audit-antigravity-cutover.md`.
