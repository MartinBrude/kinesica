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

Usá el [runbook](runbook-datos-relacionales-antigravity.md). Token = `install_token`.

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

## Mensaje corto para pegar

```text
Branch feature/datos-relacionales. Etapas 0–10 en CÓDIGO (migs 001–014).

REGLA: no debe perderse data productiva ni funcionalidad activa.
- ensure_* siguen ON (no se apagan tras 014)
- soft-delete conserva filas; sin DROP de columnas legacy
- dual-write JSON-first

Tu trabajo: AUDITAR todo y decidir Go / Go-staging-only / No-go para cutover ops.
Seguí docs/instructivo-antigravity-auditoria-cutover.md al pie.
Entregá docs/audit-antigravity-cutover.md con la plantilla.
Blockers de pérdida de data o rotura de features = No-go.
```
