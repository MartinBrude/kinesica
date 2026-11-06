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
