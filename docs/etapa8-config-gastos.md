# Etapa 8 — Configuración y administración

**Status:** implementada en `feature/datos-relacionales`  
**Mapa de código:** [codigo-datos-relacionales.md](codigo-datos-relacionales.md)  
**Plan:** [plan-refactor-datos-relacionales.md](plan-refactor-datos-relacionales.md)  
**Runbook:** [runbook-datos-relacionales-antigravity.md](runbook-datos-relacionales-antigravity.md)

## Alcance

Migrar configuración operativa y gastos a MariaDB con dual-write (JSON como espejo / fallback / exportación).

| Orden del plan | Pieza | Estado |
|----------------|-------|--------|
| 1 | Profesionales + teléfonos/emails | Mig 009 + sync |
| 2–4 | Horarios, honorarios, Clara | Tabla `configuraciones` (010) |
| 5 | Gastos | Mig 012 + dual-write |
| 6 | Encuestas | Ya en etapa 7 |
| 7 | Errores | **Diferido** (sigue en JSON) |

**Secrets / tokens** (`config.php`, webhooks, API keys) **no** se espejan en tablas exportables.

## Migraciones

| ID | Efecto |
|----|--------|
| `009_profesionales_contactos` | `phone`, `email` en `profesionales` |
| `010_configuraciones` | key → `value_json` + `version` + actor |
| `011_auditoria_cambios` | historial append-only |
| `012_gastos` | filas de gastos (espejo de JSON) |

## Claves allowlisted (`configuraciones`)

`practitioner_phones`, `practitioner_emails`, `practitioner_hours`, `header_schedule`, `fees`, `clara_texts`, `clara_texts_revision`, `custom_menu_options`, `clara_active`, `booking_active`, `horarios_updated_at`, `horarios_updated_by`, `relational_flags`.

## Lectura / escritura

| Flujo | Comportamiento |
|-------|----------------|
| Lectura settings | JSON + **overlay DB** (DB gana por clave) vía `kinesica_settings_load` / `load_full_runtime_settings` |
| Escritura settings | Lock JSON + espejo allowlisted → `configuraciones` + `auditoria_cambios` |
| Conflicto Clara | `clara_texts_revision` + HTTP 409 (sin cambio de contrato) |
| Lectura gastos | DB-first si hay filas; si no, JSON |
| Escritura gastos | JSON + upsert/delete DB + auditoría |

## Backfill

```bash
php admin/api/migrate.php --token="$INSTALL_TOKEN"
php admin/api/backfill_relational.php --only=profesionales_contactos,configuraciones,gastos --dry-run --token="$INSTALL_TOKEN"
php admin/api/backfill_relational.php --only=profesionales_contactos,configuraciones,gastos --apply --token="$INSTALL_TOKEN"
```

## Criterios de verificación

| Criterio | Cómo se cubre |
|----------|----------------|
| Dos usuarios no se pisan | Lock de settings + `clara_texts_revision`; version en `configuraciones` |
| Historial de cambios | `auditoria_cambios` (config + gastos) |
| Fuente única de lectura | Overlay DB / DB-first gastos |
| JSON regenerable | Cada save reescribe runtime JSON como exportación |
| Nuevas escrituras → MariaDB | Mirror best-effort tras cada save |

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `migrations/009…012_*.php` | DDL |
| `lib_relational_config.php` | Allowlist, set/get versionado, auditoría, overlay/mirror |
| `lib_relational_gastos.php` | Upsert/delete gastos + backfill |
| `kinesica_settings_storage.php` | Lock JSON + load overlay + mirror |
| `gastos_io.php` | Dual-write gastos |
| `profesionales_sync.php` | Phones/emails → settings + `profesionales` |

## Tests

```bash
php scripts/verify-relational-config.php
php scripts/verify-relational-gastos.php
php scripts/verify-relational-migrations.php
```
