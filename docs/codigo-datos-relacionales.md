# Mapa de código — refactor datos relacionales

**Branch:** `feature/datos-relacionales`  
**Docs relacionadas:** [plan](plan-refactor-datos-relacionales.md) · [baseline](baseline-datos-relacionales.md) · [runbook Antigravity](runbook-datos-relacionales-antigravity.md)

Este documento describe **qué hace cada archivo** del MVP implementado. Los flags productivos (`write_ids` / `read_ids` / `enforce_fk`) arrancan en `false`: sin ellos el comportamiento legacy se mantiene.

## Diagrama de capas

```text
CLI (solo token + CLI)
  migrate.php          → lib_migrations.php + migrations/*.php
  audit_relational.php → lib_relational_audit.php
  backfill_relational.php → lib_relational_backfill.php (+ contactos/profesionales)

Runtime admin (HTTP)
  flags                → lib_relational_flags.php
  resolve IDs          → lib_relational_resolve.php
  contactos            → lib_relational_contactos.php
  profesionales        → lib_relational_profesionales.php
  lecturas enrich      → lib_relational_read.php

Puntos de enganche (código existente)
  fichas.php / fichas_ops.php
  pacientes.php / pacientes_ops.php
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

## Migraciones (`admin/api/migrations/`)

Cada archivo retorna `['id' => 'NNN_nombre', 'up' => callable(PDO): void]`.  
El runner guarda `id` + **checksum SHA-256** en `schema_migrations`. **No editar** una migración ya aplicada en prod: crear `006_...`.

| ID | Efecto |
|----|--------|
| `001_paciente_contactos` | Tabla multi-tel/email; sin UNIQUE global de valor |
| `002_rel_nullable_ids` | `paciente_id` / `profesional_id` / `turno_id` nullable + índices |
| `003_pacientes_version_deleted` | `pacientes.deleted_at`, `pacientes.version` |
| `004_fichas_version` | `fichas.version` (optimistic locking) |
| `005_profesionales` | Tabla + seed `norberto` / `maria` |

## Flags

| Settings key | Env | Efecto |
|--------------|-----|--------|
| `relational_flags.write_ids` | `KINESICA_REL_WRITE_IDS` | Writes resuelven y persisten IDs |
| `relational_flags.read_ids` | `KINESICA_REL_READ_IDS` | Lecturas prefieren datos canónicos por ID |
| `relational_flags.enforce_fk` | `KINESICA_REL_ENFORCE_FK` | Reservado etapa 9 (aún no fuerza FKs) |

Defaults: todo `false`. Caché en proceso: `kinesica_rel_flags_reset_cache()`.

## Resolución de paciente (`lib_relational_resolve.php`)

Orden (sin fusión automática):

1. Teléfono normalizado en `pacientes` **o** `paciente_contactos`
2. DNI único
3. Nombre único + hint DNI (sin teléfono en el hint)
4. Ambiguo (tel compartido / DNI dup) → `null` + métrica

Backfill CLI usa `ignore_flag` para resolver aunque `write_ids` esté off.

## Métricas en disco (`admin/api/data/`, gitignored)

| Archivo | Cuándo |
|---------|--------|
| `rel_unlinked.jsonl` | Write sin `paciente_id` (match fallido/ambiguo) |
| `rel_read_fallback.jsonl` | Read con `read_ids` pero sin ID usable |

Solo sufijos / `name_key`, no PII completa.

## Enganches en código legacy

Comentarios `REL:` / bloques documentados en:

- `fichas_ops.php` — ensure columnas, save con IDs + `version`/409
- `fichas.php` — devuelve `version` tras save
- `pacientes_ops.php` — sync contactos; lista_espera escribe IDs
- `pacientes.php` — waitlist enrich con `REL_READ_IDS`
- `lib_interacciones_{store,view}.php` — insert/vista con `paciente_id`
- `lib_recordatorios_{store,view}.php` — idem
- `pacientes_helpers.php` — puente ALTER columnas si migrate aún no corrió

## Tests

| Script | Qué cubre |
|--------|-----------|
| `scripts/verify-relational-migrations.php` | Idempotencia runner |
| `scripts/verify-relational-audit.php` | Clasificaciones auditoría |
| `scripts/verify-relational-resolve.php` | Match + unlinked + insert WA |
| `scripts/verify-relational-backfill.php` | Dry-run / apply / ambiguos |
| `scripts/verify-relational-read.php` | Enrich lecturas |
| `scripts/verify-relational-contactos.php` | Sync + resolve por contactos |
| `scripts/verify-relational-profesionales.php` | Seed, backfill prof, version |

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
