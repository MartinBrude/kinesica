# Etapa 10 — Retirada de compatibilidad antigua

**Status:** implementada en código (`feature/datos-relacionales`)  
**Auditoría Antigravity:** [instructivo-antigravity-auditoria-cutover.md](instructivo-antigravity-auditoria-cutover.md)  
**Plan:** [plan-refactor-datos-relacionales.md](plan-refactor-datos-relacionales.md)

## Principio no negociable

**No se pierde data productiva ni funcionalidad activa.**

| Regla | Cómo se cumple |
|-------|----------------|
| Sin DROP de columnas/tablas legacy | `telefono`, `fichas.profesional`, denormalizados siguen |
| Sin apagar `ensure_*` | Siguen idempotentes (CREATE/ADD IF NOT EXISTS) como red de seguridad |
| Soft-delete | DELETE paciente / desactivar prof → `deleted_at` (fila conservada) |
| Dual-write | JSON se escribe primero; espejo DB best-effort (si DB falla, JSON queda) |
| Resolve | `paciente_id` explícito preferido; fallback tel/nombre **sigue** si no hay ID |
| UX search | `?q=` por teléfono/nombre intacto |

## Qué se hizo

| Cambio | Detalle |
|--------|---------|
| Mig **014** | Marcador + índice `profesionales.deleted_at` (sin cortar puentes) |
| Resolve | Si viene `paciente_id`, no re-join por tel/nombre |
| Fichas | Acepta `paciente_id` / `profesional_id` en payload |
| Soft-delete prof | `toggle_active` → `profesionales.deleted_at` |
| Archive JSON | `data/archive/` + export CLI (no borra seeds) |

## Qué NO se hizo (a propósito)

- DROP de columnas
- Apagar `ensure_*` tras 014 (rompía columnas operativas fuera de migs)
- NOT NULL masivo
- Cambiar contratos Clara / n8n / GAS

## Ops

```bash
php admin/api/migrate.php --token="$INSTALL_TOKEN"
php admin/api/export_json_snapshots.php --token="$INSTALL_TOKEN"
npm run admin:test
```

## Tests

```bash
php scripts/verify-relational-etapa10.php
```
