# Instructivo Antigravity — Auditar refactor completo y decidir avance

**Branch:** `feature/datos-relacionales`  
**Rol:** Auditoría independiente + **Go / No-go** para cutover ops (staging → prod)  
**Fecha código:** 2026-11-06 (etapas **0–10 en código**)

No implementes features nuevas salvo fixes bloqueantes descubiertos en la auditoría. Tu entrega principal es el **informe Go/No-go**.

## Principio rector (bloquear si se viola)

**No debe perderse data productiva. Ni funcionalidad activa.**

Cualquier hallazgo que borre filas clínicas, dropee columnas en uso, apague `ensure_*` de forma que rompa columns operativas, o cambie contratos Clara/n8n/GAS sin compat → **No-go** o **BLOCKER**.

Chequeos explícitos:

- Soft-delete conserva filas (`deleted_at`), no `DELETE` duro en API pacientes.
- Dual-write: fallo de espejo DB no debe impedir el save JSON.
- Tras mig 014, `ensure_*` **siguen activos** (red de seguridad idempotente).
- Sin DROP de `telefono` / `fichas.profesional` en este cutover.
- Búsqueda UX y booking/WhatsApp/recordatorios siguen operativos.

---

## Lectura obligatoria (orden)

1. [plan-refactor-datos-relacionales.md](plan-refactor-datos-relacionales.md) — umbrales + principios
2. [codigo-datos-relacionales.md](codigo-datos-relacionales.md)
3. [runbook-datos-relacionales-antigravity.md](runbook-datos-relacionales-antigravity.md)
4. Etapas: [7](etapa7-whatsapp-encuestas.md) · [8](etapa8-config-gastos.md) · [9](etapa9-integridad-referencial.md) · [10](etapa10-retiro-compatibilidad.md)
5. Este documento

---

## Estado declarado por el equipo (a verificar, no a asumir)

| Ítem | Declaración |
|------|-------------|
| Etapas 0–9 | Implementadas en código (migs `001`–`013`) |
| Etapa 10 | Implementada: resolve por ID, soft-delete, archive JSON, mig 014 marcador (**ensure_* siguen ON**) |
| Flags default | `write_ids` / `read_ids` / `enforce_fk` = **false** |
| Ops staging/prod | **Puede estar pendiente** — vos validás |
| Sitio SEO / Clara SQLite | Fuera de alcance (no tocar) |

### Migraciones esperadas

`001` … `014_etapa10_compat` en `admin/api/migrations/`.

Tras `014`: marcador + índice soft-delete. **`ensure_*` permanecen** (no corte de funcionalidad).

### Qué etapa 10 **no** dropeó (correcto)

Columnas legacy (`telefono`, `fichas.profesional`, denormalizados). Siguen en schema; ya no deben ser la **clave** de join si hay ID.

---

## Parte 1 — Auditoría automática (local / CI)

```bash
git checkout feature/datos-relacionales
git status
npm run admin:test
```

**PASS obligatorio** para cualquier Go. Si falla: No-go o Go condicionado a fix listado.

Comandos puntuales útiles:

```bash
php scripts/verify-relational-migrations.php
php scripts/verify-relational-fk.php
php scripts/verify-relational-etapa10.php
php scripts/verify-relational-config.php
php scripts/verify-relational-gastos.php
```

---

## Parte 2 — Auditoría de diseño (código)

Revisá y reportá hallazgos (OK / RISK / BLOCKER):

| # | Pregunta |
|---|----------|
| D1 | ¿Tras mig 014 los `ensure_*` **siguen activos** (idempotentes) y no se dropeó schema operativo? |
| D2 | ¿`kinesica_rel_resolve_paciente` prioriza `paciente_id` explícito sobre tel/nombre? |
| D3 | ¿DELETE pacientes es soft-delete? ¿Hard DELETE residual (dedupe/scrub) está documentado como deuda? |
| D4 | ¿FKs 013 son RESTRICT (no CASCADE) en MariaDB? |
| D5 | ¿Secrets quedan fuera de `configuraciones` (allowlist)? |
| D6 | ¿Dual-write settings/gastos/encuestas no rompe si DB vacía (fallback JSON)? |
| D7 | ¿Hay IDOR: endpoints aceptan `paciente_id` sin authz de sesión/rol? |
| D8 | ¿Etapa 10 evitó DROP prematuro y pérdida de data (soft-delete, dual-write JSON-first)? |
| D9 | ¿Funcionalidad activa intacta: listados, fichas, WA, recordatorios, booking, settings, gastos? |

Grep de apoyo:

```bash
rg -n "schema_bridges_should_run|014_etapa10" admin/api --glob '*.php'
rg -n "paciente_id_explicit|paciente_id.*hints" admin/api --glob '*.php'
rg -n "DELETE FROM pacientes" admin/api --glob '*.php'
rg -n "ON DELETE CASCADE" admin/api/migrations --glob '*.php'
```

---

## Parte 3 — Auditoría ops (staging)

Usá el [checklist staging ≈10 min](checklist-staging-datos-relacionales.md) o el [runbook](runbook-datos-relacionales-antigravity.md). Token = `install_token`.

Atajo:

```bash
export KINESICA_ADMIN_CONFIG=/ruta/admin-config-staging.php
export INSTALL_TOKEN='…'
bash scripts/staging-relational-smoke.sh
# apply migrate: STAGING_MIGRATE_APPLY=1 bash scripts/staging-relational-smoke.sh
```

```bash
php admin/api/migrate.php --status --token="$INSTALL_TOKEN"
# Esperado: 001…014 applied

php admin/api/audit_relational.php --token="$INSTALL_TOKEN" \
  --out=docs/audit-report-cutover.json --md=docs/audit-report-cutover.md

php admin/api/backfill_relational.php --dry-run --token="$INSTALL_TOKEN" --out=docs/backfill-dry.json
# Si dry-run limpio / aceptable:
php admin/api/backfill_relational.php --apply --token="$INSTALL_TOKEN" --out=docs/backfill-apply.json

php admin/api/export_json_snapshots.php --token="$INSTALL_TOKEN"
```

### Umbrales (plan)

| Puerta | Condición |
|--------|-----------|
| Huérfanos clínicos | **0** no exceptuados (listar excepciones) |
| Prof inválidos | **0** |
| Fallback lectura | **&lt; 2 %** o excepción documentada |
| Backup | Reciente + restore practicado |
| Tests | `admin:test` verde |

### Humo mínimo staging

- Alta/edición paciente → contactos
- Guardar ficha con IDs + 409 por `version` stale
- Settings/horarios → `configuraciones` + auditoría
- Gasto CRUD → `gastos`
- DELETE paciente → `deleted_at`
- Toggle profesional inactive → `profesionales.deleted_at`
- Encuesta pública → fila DB
- Cancel turno → recordatorios pending skipped

Flags: activar en staging primero `write_ids` + `read_ids`; `enforce_fk` solo tras FKs + backup OK.

---

## Parte 4 — Decisión

### Definiciones

| Veredicto | Significado |
|-----------|-------------|
| **Go prod** | Cutover flags + migrate 014 en prod autorizado tras backup |
| **Go staging only** | Ops staging OK; prod espera ventana / métricas |
| **No-go** | Blockers; listar fixes; no activar `enforce_fk` en prod |

### Plantilla de informe (entregable)

```markdown
# Auditoría cutover datos relacionales

**Fecha:** …
**Branch / commit:** …
**Veredicto:** Go prod | Go staging only | No-go

## Tests
- npm run admin:test: PASS/FAIL …

## Diseño (D1–D8)
- D1: OK/RISK/BLOCKER — …
…

## Ops staging
- migrate 001–014: …
- audit huérfanos: …
- backfill: …
- backup/restore: …
- humo: …

## Deuda aceptada (no bloquea)
- …

## Blockers (si No-go)
- …

## Recomendación siguiente
- …
```

Guardá el informe en `docs/audit-antigravity-cutover.md` (o adjunto al PR).

---

## Qué NO hacer en esta pasada

- DROP de columnas legacy
- Big-bang `enforce_fk` en prod sin staging
- Fusionar pacientes ambiguos
- Unificar Clara / tocar SEO estático
- Editar migs `001`–`014` ya aplicadas
- Commits de secrets o dumps con PII

---

## Mensaje para pegar a Antigravity

```text
# Kinésica — Auditoría cutover refactor datos relacionales

## Contexto del producto
Admin/API de un centro de kinesiología (Palermo). MariaDB operativa +
panel admin PHP + integraciones WhatsApp/Clara (n8n), recordatorios,
Google Calendar / GAS. El sitio estático SEO (ES/EN/FR/PT) NO entra en
este refactor.

## Por qué el refactor
Antes: identidad de facto por teléfono UNIQUE, fichas con payload JSON,
relaciones por nombre/tel/wa_id, settings/gastos/encuestas en JSON,
DDL vía ensure_* en requests. Eso genera drift al cambiar teléfono,
duplicados ambiguos y riesgo de mezclar historias clínicas.

Objetivo: MariaDB como fuente de verdad de identidad y relaciones
(paciente_id / profesional_id / turno_id), sin big bang, con
compatibilidad durante la transición.

## Plan (docs/plan-refactor-datos-relacionales.md)
Roadmap por etapas con flags (default false):
  REL_WRITE_IDS  — persistir IDs en writes
  REL_READ_IDS   — leer/enrich por ID
  REL_ENFORCE_FK — asserts app (FKs SQL = mig 013)

Principios: no fusionar ambiguos; ON DELETE RESTRICT en clínicos;
soft-delete; migraciones versionadas (checksum); no loguear PII completa;
autorizar todo write con IDs (IDOR).

Fuera de alcance: SEO estático, unificar Clara SQLite, hardening auth
completo, sustituir Google Calendar (solo espejo local).

## Qué está en código (branch feature/datos-relacionales)
Etapas 0–10 implementadas. Migraciones 001…014.

  0–5 MVP: audit, migrate runner, contactos, resolve/backfill,
      profesionales, fichas + version/409, flags
  6 Turnos sombra (006), UNIQUE calendar_event_id, cancel→recordatorios,
      sync campaña/booking/GAS
  7 WhatsApp estado↔paciente (007), encuestas dual-write (008),
      link_paciente
  8 Config overlay/mirror (009–011), gastos dual-write (012),
      auditoría; errores JSON diferido; secrets fuera de tablas
  9 FKs RESTRICT (013), soft-delete pacientes, mapper PDO,
      asserts si enforce_fk
 10 Identidad por paciente_id explícito, soft-delete profesionales,
      archive JSON, mig 014 marcador — SIN DROP de columnas;
      ensure_* SIGUEN ON (red de seguridad idempotente)

Mapa de código: docs/codigo-datos-relacionales.md
Runbook staging: docs/runbook-datos-relacionales-antigravity.md
Etapas: docs/etapa7…etapa10-*.md

## REGLA NO NEGOCIABLE
No debe perderse data productiva ni funcionalidad activa.
- soft-delete conserva filas (deleted_at); API pacientes no hard-delete
- dual-write JSON-first (si DB falla, JSON queda)
- ensure_* activos tras 014 (no apagar puentes operativos)
- sin DROP de telefono / fichas.profesional / denormalizados en este cutover
- búsqueda UX ?q= y contratos Clara/n8n/GAS intactos
- fallback resolve por tel/nombre SOLO si no hay paciente_id

Violación de data o features = No-go / BLOCKER.

## Tu trabajo (NO reimplementar etapa 10)
1) Auditar todo lo actuado (tests + diseño + ops staging).
2) Decidir: Go prod | Go staging only | No-go.
3) Entregar docs/audit-antigravity-cutover.md con la plantilla.

Seguí al pie: docs/instructivo-antigravity-auditoria-cutover.md

Comandos:
  git checkout feature/datos-relacionales
  npm run admin:test
  # staging (token = install_token):
  php admin/api/migrate.php --status --token="$INSTALL_TOKEN"
  php admin/api/audit_relational.php --token="$INSTALL_TOKEN" \
    --out=docs/audit-report-cutover.json --md=docs/audit-report-cutover.md

Solo hotfixeá si es trivial y bloquea la suite; si no, listá blockers.
No DROPs, no fusión automática, no tocar Clara SQLite ni SEO.
```
