# Línea base — refactor datos relacionales (etapa 0)

**Status:** Draft  
**Branch:** `feature/datos-relacionales`  
**Fecha:** 2026-11-06  
**Plan:** [plan-refactor-datos-relacionales.md](plan-refactor-datos-relacionales.md)

## Objetivo de esta línea base

Inventario de fuentes, DDL en requests y consumidores externos **antes** de activar escrituras por ID (`REL_WRITE_IDS`). Sin cambio funcional de negocio en esta etapa.

## Fuentes de verdad actuales

| Dato | Almacén | Notas |
|------|---------|--------|
| Pacientes | MariaDB `pacientes` | Identidad de facto: `telefono` UNIQUE |
| Lista de espera | MariaDB `lista_espera` | `paciente_telefono` + `paciente_nombre` |
| Fichas clínicas | MariaDB `fichas.payload` JSON | `profesional` texto (username) |
| WhatsApp eventos | MariaDB `interaccion_eventos` | Clave `event_key`; vínculo por `wa_id` |
| Recordatorios | MariaDB `recordatorio_eventos` | Clave `event_key`; `calendar_event_id` |
| Settings / horarios / Clara | `admin/api/data/settings.json` | Lock de archivo |
| Gastos / encuestas / errores | JSON en `admin/api/` | Fuera del MVP clínico |
| Agenda turnos | Google Calendar | Sin tabla local aún |
| Bot Clara | SQLite + n8n (VPS) | Fuera del MVP; ver backups |

## DDL dinámico en requests (`ensure_*`)

| Función | Archivo | Tablas |
|---------|---------|--------|
| `ensure_pacientes_tables` | `pacientes_helpers.php` | `pacientes`, `lista_espera` (+ ALTER columnas) |
| `interacciones_ensure_schema` | `lib_interacciones_store.php` | `interaccion_eventos`, `interaccion_estado` |
| `recordatorios_ensure_schema` | `lib_recordatorios_store.php` | `recordatorio_eventos` |
| `ensure_login_codes` / attempts | `lib_codes.php`, `lib_attempts.php` | auth |
| `ensure_users_role_column` | `lib_auth.php` | `users.role` |
| `install.php` (CLI) | `install.php` | users, fichas, pacientes, lista_espera |

**Meta etapa 2+:** DDL productivo solo vía `php admin/api/migrate.php`. Los `ensure_*` conservan puente de columnas nullable hasta etapa 10.

## Endpoints / escrituras relevantes

| Endpoint | Lee | Escribe |
|----------|-----|---------|
| `pacientes.php` | pacientes | upsert / teléfono / dedupe |
| `fichas.php` | fichas | payload + sync pacientes |
| `interacciones.php` | eventos | append eventos / estado |
| `recordatorios.php` | eventos | ingest n8n |
| `horarios.php` / `settings.php` | settings.json | settings.json |
| `campana_turnos.php` | pacientes + GAS | pacientes |
| `encuestas.php` / `gastos.php` / `errores.php` | JSON | JSON |
| `backup.php` | MariaDB | dump SQL |

## Consumidores externos

| Sistema | Contrato actual | Notas MVP |
|---------|-----------------|-----------|
| n8n / Clara | webhooks, `wa_id`, nombres, calendar ids | No unificar SQLite en este branch |
| Google Calendar | eventos consultorio | Espejo local = etapa 6 |
| GAS campaña turnos | `webhook_secret` / `gas_api_secret` | Match por teléfono hoy |
| Sitio estático SEO | `scripts/*-content.mjs` | Fuera de alcance |

## Migraciones en este branch (etapa 2–3 scaffold)

Runner: `admin/api/lib_migrations.php` + CLI `admin/api/migrate.php`.

| ID | Efecto |
|----|--------|
| `001_paciente_contactos` | Tabla `paciente_contactos` |
| `002_rel_nullable_ids` | `paciente_id` / `profesional_id` / `turno_id` nullable |
| `003_pacientes_version_deleted` | `deleted_at`, `version` en pacientes |
| `004_fichas_version` | `version` en fichas |

Flags (default `false`): `relational_flags` en settings o env `KINESICA_REL_WRITE_IDS` / `READ_IDS` / `ENFORCE_FK`.

## Auditoría (etapa 1)

Script read-only: `php admin/api/audit_relational.php` (también `npm run admin:audit`).

```bash
# Enmascarado (default) — resumen a stdout
php admin/api/audit_relational.php --token="$INSTALL_TOKEN"

# Informe persistido
php admin/api/audit_relational.php --token="$INSTALL_TOKEN" \
  --out=docs/audit-report.json \
  --md=docs/audit-report.md

# Solo en máquina local / copia: PII completo
php admin/api/audit_relational.php --token="$INSTALL_TOKEN" --full-pii --out=/tmp/kinesica-audit-full.json
```

No fusiona ni borra. Clasifica: candidatos a fusión, teléfonos compartidos, DNI duplicados, fichas huérfanas, lista/WA sin paciente, `event_key` duplicados, lista de revisión manual + reglas.

Tests sintéticos: `node scripts/verify-relational-audit.mjs`.

## Comandos de verificación

```bash
npm run admin:lint
node scripts/verify-relational-migrations.mjs
node scripts/verify-relational-audit.mjs
npm run admin:test
```

Producción (cuando corresponda, con backup previo):

```bash
php admin/api/migrate.php --status --token="$INSTALL_TOKEN"
php admin/api/migrate.php --dry-run --token="$INSTALL_TOKEN"
php admin/api/migrate.php --token="$INSTALL_TOKEN"
```

## Checklist etapa 0 (pendiente operativo)

- [ ] Backup MariaDB restaurado en copia de prueba
- [ ] Copia de `admin/api/data/` guardada
- [ ] Respuestas de referencia (pacientes/fichas/horarios) archivadas
- [ ] `npm run admin:test` en verde en esta branch
- [ ] Ventana acordada antes del primer `migrate.php` en Hostinger

## Checklist etapa 1 (auditoría)

- [ ] Correr `audit_relational.php` contra **copia** de producción (no hace falta `--full-pii` para el resumen)
- [ ] Guardar JSON + MD del informe
- [ ] Revisar `manual_review` y clasificar excepciones
- [ ] No fusionar ni borrar hasta reglas explícitas por caso

## Escritura de IDs (etapa 3, flag off por defecto)

Código: `lib_relational_resolve.php`. Con `relational_flags.write_ids` o `KINESICA_REL_WRITE_IDS=1`:

- Fichas, lista de espera, interacciones y recordatorios intentan persistir `paciente_id`.
- Ambiguo / sin match → `paciente_id` null + línea en `admin/api/data/rel_unlinked.jsonl` (sin PII completa).
- `profesional_id` queda null hasta existir tabla `profesionales`.
- Legacy (teléfono/nombre/`wa_id`) sigue funcionando con el flag en `false`.

## Backfill de filas existentes

CLI: `php admin/api/backfill_relational.php` (`npm run admin:backfill`).

```bash
# Siempre primero dry-run (no escribe)
php admin/api/backfill_relational.php --dry-run --token="$INSTALL_TOKEN" \
  --out=docs/backfill-report.json

# Aplicar solo matches inequívocos (paciente_id IS NULL)
php admin/api/backfill_relational.php --apply --token="$INSTALL_TOKEN" \
  --out=docs/backfill-report-apply.json

# Tablas puntuales
php admin/api/backfill_relational.php --dry-run --only=fichas,lista_espera --token="$INSTALL_TOKEN"
```

- No requiere `REL_WRITE_IDS` (usa `ignore_flag` en el resolver).
- No toca filas ambiguas ni ya linkeadas.
- Idempotente: segunda pasada → `updated: 0`.
- Orden sugerido post-migrate: audit → backfill dry-run → backfill apply → audit de nuevo.

## Lecturas con REL_READ_IDS (etapa 3)

Código: `lib_relational_read.php`. Con `relational_flags.read_ids` o `KINESICA_REL_READ_IDS=1`:

- **Fichas** (`GET fichas`): overlay de `nombre`/`dni`/contacto desde `pacientes` si hay `paciente_id`.
- **Lista de espera**: overlay de `paciente_nombre` / `paciente_telefono` canónicos.
- **Interacciones / recordatorios**: priorizan nombre (y email/tel) del directorio por `paciente_id`.
- Sin ID o ID huérfano → fallback legacy + línea en `admin/api/data/rel_read_fallback.jsonl`.
- Con flag en `false` (default) el comportamiento es idéntico al anterior.

## paciente_contactos

Tabla (migración `001`): varios teléfonos/emails por paciente; un `es_principal` por tipo.

- Sync en altas/ediciones: `lib_relational_contactos.php` desde `telefono` / `email` (principal) y `contacto_*` (secundarios).
- Backfill: `php admin/api/backfill_relational.php --only=paciente_contactos --dry-run|--apply`
- Resolve de `paciente_id` también consulta contactos (útil si el tel legacy quedó desfasado).
- Sin UNIQUE global de teléfono: compartidos siguen siendo revisión manual.

## Profesionales + version de fichas

- Migración `005_profesionales`: seed `norberto` / `maria`.
- Backfill: `--only=fichas_profesional_id,lista_espera_profesional_id`.
- Fichas GET incluyen `version`; POST con `version` obsoleta → **409** (`ficha_version_conflict`). Clientes sin `version` siguen pudiendo guardar.
- Runbook cocinado: [runbook-datos-relacionales-antigravity.md](runbook-datos-relacionales-antigravity.md).
