# Etapa 7 — WhatsApp, recordatorios y encuestas

**Status:** implementada en `feature/datos-relacionales`  
**Mapa de código:** [codigo-datos-relacionales.md](codigo-datos-relacionales.md)  
**Plan:** [plan-refactor-datos-relacionales.md](plan-refactor-datos-relacionales.md)  
**Runbook:** [runbook-datos-relacionales-antigravity.md](runbook-datos-relacionales-antigravity.md)

## Modelo (sin rename big-bang)

| Concepto del plan | Tabla actual | Notas |
|-------------------|--------------|--------|
| Conversación | `interaccion_estado` | PK `conversation_key` = `{wa_id}_{Y-m-d}` (TZ consultorio) |
| Mensaje | `interaccion_eventos` | Append-only; UNIQUE `event_key` |
| Identidad externa | `wa_id` | Meta/Clara; no es FK interna |
| Identidad interna | `paciente_id` | En eventos (mig 002) y estado (mig 007) |
| Recordatorio | `recordatorio_eventos` | `paciente_id` + `turno_id` (etapas 3–6) |
| Encuesta | `encuestas` (+ JSON espejo) | Mig 008; anónima |

Clara / n8n **no** cambian de contrato: siguen enviando `wa_id`, nombres y `event_key`.

## Migraciones

| ID | Efecto |
|----|--------|
| `007_interaccion_estado_paciente` | `paciente_id`, `wa_id` en estado |
| `008_encuestas` | Tabla respuestas (campos = JSON legacy + `paciente_id` NULL) |

## APIs / libs

| Pieza | Rol |
|-------|-----|
| `lib_relational_interacciones.php` | touch estado, link posterior, backfill |
| `POST interacciones.php?action=link_paciente` | `{ id, paciente_id }` — asociación manual |
| Vista interacciones | Expone `paciente_id` en cada hilo |
| `lib_relational_encuestas.php` + `encuestas_io.php` | Dual-write DB↔JSON |
| `api/send-contact.php` (`type=encuesta`) | Append público → JSON + DB |

## Criterios de verificación

| Criterio | Cómo se cubre |
|----------|----------------|
| Asociación posterior | `link_paciente` fuerza `paciente_id` en estado + eventos sin ID |
| Cambio de teléfono | Lecturas con `REL_READ_IDS` usan `paciente_id`; wa_id es solo externo |
| Idempotencia `event_key` | Sin cambio: ingest n8n sigue único |
| Métricas | Contadores answered/archived intactos; KPI encuestas desde load unificado |
| Recordatorios actuales | Ya resuelven por ID/turno (etapa 6); cancel turno anula pending |

## Backfill

```bash
php admin/api/migrate.php --token="$INSTALL_TOKEN"
php admin/api/backfill_relational.php --only=interaccion_estado,encuestas --dry-run --token="$INSTALL_TOKEN"
php admin/api/backfill_relational.php --only=interaccion_estado,encuestas --apply --token="$INSTALL_TOKEN"
```

## Tests

```bash
php scripts/verify-relational-interacciones.php
php scripts/verify-relational-encuestas.php
# o
npm run admin:test
```

## Comentarios en código

Buscar `REL:` / `etapa 7` bajo `admin/api/` (store, state, view, encuestas_io, interacciones.php).
