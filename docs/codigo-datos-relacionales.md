# Mapa de código — refactor datos relacionales

**Branch:** `feature/datos-relacionales`  
**Docs relacionadas:** [plan](plan-refactor-datos-relacionales.md) · [baseline](baseline-datos-relacionales.md) · [runbook Antigravity](runbook-datos-relacionales-antigravity.md) · [etapa 7](etapa7-whatsapp-encuestas.md) · [etapa 8](etapa8-config-gastos.md) · [etapa 9](etapa9-integridad-referencial.md) · [etapa 10](etapa10-retiro-compatibilidad.md) · [auditoría cutover](instructivo-antigravity-auditoria-cutover.md)

Este documento describe **qué hace cada archivo** del refactor (etapas 0–10). Flags productivos default `false`. FKs mig `013` aplican en MariaDB tras migrate; tras mig `014` los puentes DDL en request quedan off.

## Diagrama de capas

```text
CLI (solo token + CLI)
  migrate.php          → lib_migrations.php + migrations/*.php (001…014+)
  audit_relational.php → lib_relational_audit.php
  backfill_relational.php → lib_relational_backfill.php
    (+ contactos / profesionales / turnos / encuestas / config / gastos)

Runtime admin (HTTP)
  flags                → lib_relational_flags.php
  resolve IDs          → lib_relational_resolve.php
  contactos            → lib_relational_contactos.php
  profesionales        → lib_relational_profesionales.php
  turnos sombra        → lib_relational_turnos.php
  lecturas enrich      → lib_relational_read.php
  config / auditoría   → lib_relational_config.php
  gastos               → lib_relational_gastos.php
  integridad FK        → lib_relational_integrity.php

Puntos de enganche (código existente)
  fichas.php / fichas_ops.php
  pacientes.php / pacientes_ops.php
  settings / horarios / kinesica_settings_storage.php
  gastos_io.php / gastos.php
  profesionales_sync.php
  campana_turnos.php
  lib_interacciones_store.php / lib_interacciones_view.php
  lib_recordatorios_store.php / lib_recordatorios_view.php
  pacientes_helpers.php (puente ensure_* columnas)
```

## Inventario de archivos nuevos

| Archivo | Rol |
|---------|-----|
| [`admin/api/lib_migrations.php`](../admin/api/lib_migrations.php) | Runner versionado; helpers `table/column/index`; **no** DDL desde requests HTTP |
| [`admin/api/migrate.php`](../admin/api/migrate.php) | CLI migraciones (`--status`, `--dry-run`, `--token`) |
| [`admin/api/migrations/001_*.php`](../admin/api/migrations/) … `005_*.php` | DDL incremental idempotente |
| [`admin/api/lib_relational_flags.php`](../admin/api/lib_relational_flags.php) | `write_ids` / `read_ids` / `enforce_fk` (settings + env) |
| [`admin/api/lib_relational_audit.php`](../admin/api/lib_relational_audit.php) | Auditoría read-only etapa 1 |
| [`admin/api/audit_relational.php`](../admin/api/audit_relational.php) | CLI auditoría → JSON/MD |
| [`admin/api/lib_relational_resolve.php`](../admin/api/lib_relational_resolve.php) | Match `paciente_id` / `profesional_id`; log unlinked |
| [`admin/api/lib_relational_contactos.php`](../admin/api/lib_relational_contactos.php) | Sync `paciente_contactos` desde legacy |
| [`admin/api/lib_relational_profesionales.php`](../admin/api/lib_relational_profesionales.php) | Catálogo slug→id; backfill `profesional_id` |
| [`admin/api/lib_relational_read.php`](../admin/api/lib_relational_read.php) | Enrich lecturas si `REL_READ_IDS` |
| [`admin/api/lib_relational_backfill.php`](../admin/api/lib_relational_backfill.php) | Backfill IDs + orquesta tablas |
| [`admin/api/backfill_relational.php`](../admin/api/backfill_relational.php) | CLI backfill dry-run/apply |
| [`admin/api/lib_relational_turnos.php`](../admin/api/lib_relational_turnos.php) | Turnos sombra: upsert, register booking, cancel + recordatorios |
| [`admin/api/turnos.php`](../admin/api/turnos.php) | API register/cancel (sesión o secret GAS) |
| [`admin/api/lib_relational_interacciones.php`](../admin/api/lib_relational_interacciones.php) | Conversación (estado) ↔ paciente_id |
| [`admin/api/lib_relational_encuestas.php`](../admin/api/lib_relational_encuestas.php) | Encuestas DB + backfill desde JSON |
| [`admin/api/lib_relational_config.php`](../admin/api/lib_relational_config.php) | `configuraciones` + `auditoria_cambios` + contactos profesional |
| [`admin/api/lib_relational_gastos.php`](../admin/api/lib_relational_gastos.php) | Gastos DB + backfill desde JSON |
| [`admin/api/lib_relational_integrity.php`](../admin/api/lib_relational_integrity.php) | FKs helpers, soft-delete, mapper PDO, asserts |

## Migraciones (`admin/api/migrations/`)

Cada archivo retorna `['id' => 'NNN_nombre', 'up' => callable(PDO): void]`.  
El runner guarda `id` + **checksum SHA-256** en `schema_migrations`. **No editar** una migración ya aplicada en prod: crear la siguiente `NNN_...`.

| ID | Efecto |
|----|--------|
| `001_paciente_contactos` | Tabla multi-tel/email; sin UNIQUE global de valor |
| `002_rel_nullable_ids` | `paciente_id` / `profesional_id` / `turno_id` nullable + índices |
| `003_pacientes_version_deleted` | `pacientes.deleted_at`, `pacientes.version` |
| `004_fichas_version` | `fichas.version` (optimistic locking) |
| `005_profesionales` | Tabla + seed `norberto` / `maria` |
| `006_turnos` | Tabla sombra `turnos` + UNIQUE `calendar_event_id` |
| `007_interaccion_estado_paciente` | `paciente_id` / `wa_id` en conversación (estado) |
| `008_encuestas` | Tabla `encuestas` (dual-write con JSON) |
| `009_profesionales_contactos` | `phone` / `email` en `profesionales` |
| `010_configuraciones` | Key-value operativo + `version` |
| `011_auditoria_cambios` | Historial append-only |
| `012_gastos` | Tabla `gastos` (dual-write con JSON) |
| `013_rel_integrity_fks` | FK RESTRICT + CHECK status; null orphans |
| `014_etapa10_compat` | Marcador etapa 10 + idx soft-delete prof (`ensure_*` siguen) |

## Flags

| Settings key | Env | Efecto |
|--------------|-----|--------|
| `relational_flags.write_ids` | `KINESICA_REL_WRITE_IDS` | Writes resuelven y persisten IDs |
| `relational_flags.read_ids` | `KINESICA_REL_READ_IDS` | Lecturas prefieren datos canónicos por ID |
| `relational_flags.enforce_fk` | `KINESICA_REL_ENFORCE_FK` | Etapa 9: asserts app de IDs (FKs SQL = mig 013) |

Defaults: todo `false`. Caché en proceso: `kinesica_rel_flags_reset_cache()`.

## Resolución de paciente (`lib_relational_resolve.php`)

Orden (sin fusión automática):

1. `paciente_id` explícito (etapa 10) — rechaza inexistente / soft-deleted
2. Teléfono normalizado en `pacientes` **o** `paciente_contactos` (excluye soft-deleted)
3. DNI único
4. Nombre único + hint DNI (sin teléfono): solo si el DNI del paciente es vacío o igual al hint
5. Ambiguo (tel compartido / DNI dup) → `null` + métrica

Parseo de IDs: solo enteros positivos puros (`ctype_digit` / int); no `(int)"12abc"`.
Flags: `kinesica_rel_coerce_bool` (evita `(bool)"false" === true`).
Backfill CLI usa `ignore_flag` para resolver aunque `write_ids` esté off.
Fichas: resolve por tel/nombre solo **rellena** `paciente_id` NULL; override solo con ID explícito.
Optimistic lock: GET incluye `version`; el form hace round-trip; save con `version` stale → 409.
Turnos: carrera UNIQUE reintenta merge (no descarta el segundo writer).
Integridad: `apply_fks` deriva nombres desde `kinesica_rel_integrity_fk_specs()`.

## Métricas en disco (`admin/api/data/`, gitignored)

| Archivo | Cuándo |
|---------|--------|
| `rel_unlinked.jsonl` | Write sin `paciente_id` (match fallido/ambiguo) |
| `rel_read_fallback.jsonl` | Read con `read_ids` pero sin ID usable |

Solo sufijos / `name_key`, no PII completa.

## Enganches en código legacy

Comentarios `REL:` / bloques documentados en:

- `fichas_ops.php` — ensure columnas, save con IDs + `version`/409; asserts si `REL_ENFORCE_FK`
- `fichas.php` — devuelve `version` tras save
- `pacientes_ops.php` — sync contactos; lista_espera escribe IDs; asignado por `paciente_id`
- `pacientes.php` — waitlist enrich; listados filtran `deleted_at`; DELETE = soft-delete
- `kinesica_settings_storage.php` / `horarios.php` / `settings.php` — overlay + mirror config
- `gastos_io.php` / `gastos.php` — dual-write gastos
- `profesionales_sync.php` — phones/emails settings + `profesionales.phone/email`
- `lib_interacciones_{store,view}.php` — insert/vista con `paciente_id`
- `lib_recordatorios_{store,view}.php` — insert con `paciente_id` + upsert turno/`turno_id`
- `campana_turnos.php` — sync sombra `turnos` tras listar GAS
- `pacientes_helpers.php` — puente ALTER columnas si migrate aún no corrió

## Turnos sombra (etapa 6 — cerrada)

- Google Calendar sigue siendo la agenda; `turnos` es espejo local.
- Upsert idempotente por `calendar_event_id` (UNIQUE en `turnos`, no en recordatorios).
- Fuentes: recordatorios, campaña, `calendar_backup` book, admin booking → `turnos.php`, mirror GAS `mirrorTurnoToAdmin`.
- Cancel: `POST turnos.php action=cancel` → `status=cancelled` + pending/missing_phone/failed → `skipped`/`cancelled`.
- Backfill: `--only=turnos,recordatorios_turno_id`.
- Deploy GAS con el mirror para completar el camino live.

## WhatsApp / encuestas (etapa 7)

- `interaccion_estado` ≈ conversación; `interaccion_eventos` ≈ mensajes (sin rename).
- Insert de evento toca estado con `paciente_id`/`wa_id`; vista prefiere ID de estado y lo expone en JSON.
- Asociación posterior: `POST interacciones.php` `action=link_paciente` (`id` + `paciente_id`).
- Encuestas: MariaDB primario si hay filas; JSON espejo vía `encuestas_io.php` / `append`.
- Backfill: `--only=interaccion_estado,encuestas`.
- Doc dedicada: [etapa7-whatsapp-encuestas.md](etapa7-whatsapp-encuestas.md).

## Config / gastos (etapa 8)

- `configuraciones`: key-value allowlisted + `version` + actor; mirror tras cada save de settings.
- Lectura: overlay DB sobre JSON (`kinesica_settings_load` / `load_full_runtime_settings`).
- `auditoria_cambios`: append-only (config + gastos).
- `profesionales.phone` / `email` (mig 009) sincronizados desde users/settings.
- Gastos: DB-first si hay filas; JSON espejo (`gastos_io.php`).
- Secrets de `config.php` **fuera** de tablas exportables.
- Backfill: `--only=profesionales_contactos,configuraciones,gastos`.
- Doc: [etapa8-config-gastos.md](etapa8-config-gastos.md).

## Integridad referencial (etapa 9)

- Mig `013`: null orphans → `FOREIGN KEY … ON DELETE RESTRICT` (MariaDB); CHECK status best-effort.
- SQLite: ADD FK vía ALTER = no-op; tests usan `CREATE` + `PRAGMA foreign_keys=ON`.
- Soft-delete pacientes (`deleted_at`); listados excluyen borrados.
- `REL_ENFORCE_FK`: asserts app (no desactiva FKs SQL). Rollback flag ≠ DROP CONSTRAINT.
- Mapper PDO → 409/422 (`fk_restrict_delete`, `referential_integrity`, …).
- Doc: [etapa9-integridad-referencial.md](etapa9-integridad-referencial.md).

## Retiro de compatibilidad (etapa 10)

- **No pérdida de data / no corte de features:** `ensure_*` siguen (idempotentes).
- Mig `014`: marcador + índice `profesionales.deleted_at`.
- Resolve: `paciente_id` explícito gana; fallback tel/nombre si no hay ID.
- Soft-delete pacientes/profesionales (filas conservadas).
- JSON: `data/archive/` + export CLI; dual-write JSON-first.
- **Sin DROP** de columnas legacy (015+ solo tras Go de auditoría).
- Doc: [etapa10-retiro-compatibilidad.md](etapa10-retiro-compatibilidad.md).

## Tests

| Script | Qué cubre |
|--------|-----------|
| `scripts/verify-relational-migrations.php` | Idempotencia runner (001…013) |
| `scripts/verify-relational-audit.php` | Clasificaciones auditoría |
| `scripts/verify-relational-resolve.php` | Match + unlinked + insert WA |
| `scripts/verify-relational-backfill.php` | Dry-run / apply / ambiguos |
| `scripts/verify-relational-read.php` | Enrich lecturas |
| `scripts/verify-relational-contactos.php` | Sync + resolve por contactos |
| `scripts/verify-relational-profesionales.php` | Seed, backfill prof, version |
| `scripts/verify-relational-turnos.php` | Upsert UNIQUE, backfill `turno_id` |
| `scripts/verify-relational-interacciones.php` | Estado/conversación + paciente_id |
| `scripts/verify-relational-encuestas.php` | Tabla encuestas + upsert |
| `scripts/verify-relational-config.php` | configuraciones, auditoría, phone/email |
| `scripts/verify-relational-gastos.php` | gastos upsert/delete + auditoría |
| `scripts/verify-relational-fk.php` | soft-delete, orphans, PRAGMA FK, mapper |
| `scripts/verify-relational-etapa10.php` | bridges off, resolve por ID explícito |

Incluidos en `npm run admin:test`.

## npm

```bash
npm run admin:migrate    # php admin/api/migrate.php
npm run admin:audit      # php admin/api/audit_relational.php
npm run admin:backfill   # php admin/api/backfill_relational.php
npm run admin:test       # suite admin + verify-relational-*
```

## Convención de comentarios en PHP

- Cabecera de archivo: propósito, docs, límites (qué **no** hace).
- Funciones públicas: `@param` / `@return` + una línea de regla de negocio si no es obvia.
- Enganches legacy: comentario `// REL:` apuntando al módulo y al flag (buscar `REL:` en `admin/api/`).
- Tests: cabecera con qué cubre + link a este doc; `npm run admin:test` los incluye.
