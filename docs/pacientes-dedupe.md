# Unificación de pacientes (dedupe / merge)

Documento técnico del directorio `/admin/pacientes`: cuándo se unifican fichas duplicadas, qué datos se consolidan y qué queda fuera.

Relacionado: [etapa9-integridad-referencial.md](etapa9-integridad-referencial.md) (soft-delete + FK RESTRICT) · [admin/ARCHITECTURE.md](../admin/ARCHITECTURE.md).

## Objetivo

La misma persona a veces entra por WhatsApp/Clara (placeholder sin tel), por la agenda, por una ficha ATM o por el alta manual. El sistema debe **conservar una sola ficha activa** y mover turnos, historias, recordatorios, etc. a esa ficha — sin perder vínculos ni “revivir” pacientes soft-deleted.

## Cuándo corre

| Disparo | Alcance | Archivo / entrada |
|---------|---------|-------------------|
| **Alta de paciente** | Solo candidatos cercanos (tel / DNI / nombre) del nuevo id | `kinesica_pacientes_try_dedupe_after_create` ← upsert, recordatorios, campaña |
| **Mantenimiento** | Barrido completo del directorio **activo** | `deduplicate_pacientes_table` vía `kinesica_pacientes_run_maintenance_if_due` (~6 h) o `cron_indistintos` / `action=deduplicate` |
| **Unificar manual** | Un par origen → destino elegido en UI | `kinesica_pacientes_merge_explicit` ← `POST pacientes.php` `action=merge` |
| Listado / cada request | **No** escribe en DB | (la UI puede deduplicar en memoria solo para mostrar) |

Es **normal** que una corrida no una nada (`merged = 0`).

## Qué se reasigna antes de borrar

`kinesica_pacientes_reassign_children` mueve al survivor:

- `fichas`, `turnos`, `lista_espera`
- `paciente_contactos` (antes desmarca `es_principal` en origen)
- `interaccion_eventos`, `interaccion_estado`
- `recordatorio_eventos`, `encuestas`

Así se evita:

1. Fallo silencioso con **FK `ON DELETE RESTRICT`** (mig 013).
2. Turnos/fichas **huérfanos** si aún no hay FK.

## Soft-delete (`deleted_at`)

Regla dura:

- El clustering **solo** considera filas con `deleted_at IS NULL`.
- Match de alta (`find_existing_patient_match`) **ignora** soft-deleted.
- Merge manual **rechaza** origen o destino eliminado.
- Mantenimiento (nombres tipo `tk3` / `no dar`): **soft-delete**, no `DELETE` duro.

Sin esto, un soft-deleted con WhatsApp real podía absorber a un activo placeholder y el paciente “desaparecía” del directorio.

## Homónimos y WhatsApp

- Match por nombre **no** une si ambos tienen WhatsApp reales distintos (`kinesica_phones_compatible_for_name_merge`).
- `kinesica_resolve_merge_phone` **nunca** pisa un WhatsApp real con otro distinto (solo reemplaza placeholder/vacío).
- Si falla un `UPDATE` de hijo en reassign, se **relanza** el error para rollback del merge.

## Criterios de duplicado (activos)

Se unen si comparten, con las salvaguardas habituales:

- Mismo teléfono real (E.164 limpio), o
- Mismo DNI (o placeholder `sin-tel-dni-…`), o
- Misma clave canónica de nombre **y** teléfonos compatibles (dos WhatsApp reales distintos → homónimos, **no** se unen solo por nombre).

Survivor preferido: teléfono real > review > profesional concreto > id menor. Se OR-mergean flags (`dejo_review`, `encuesta_enviada`, `viene_de_campana`) y se enriquecen notas/email/contacto.

## Módulos

| Módulo | Rol |
|--------|-----|
| `pacientes_helpers_reassign_children.php` | Reasignación de tablas hijas |
| `pacientes_helpers_merge_explicit.php` | Merge manual 1→1 |
| `pacientes_helpers_dedup_apply.php` | Aplicar clusters (auto) |
| `pacientes_helpers_dedupe_candidates.php` | Candidatos cercanos (tel / DNI / nombre), solo activos |
| `pacientes_helpers_dedupe_schedule.php` | Alta acotada (`around_patient` / `try_dedupe_after_create`) |
| `pacientes_helpers_existing_patient_match.php` | Match de alta + barrido + `alive_sql` |

## Tests

```bash
php scripts/test-pacientes-merge.php
php scripts/verify-pacientes-deduplication.php
# o vía
npm run admin:test
```

Cubren: reasignación de hijos, merge explícito, `around_patient`, y que soft-deleted no absorba activos.

## Seguridad relacionada (panel)

| Tema | Política |
|------|----------|
| `GET fichas.php` | Lectura **compartida** entre sesiones de la clínica (biblioteca común). Escritura/borrado: owner o admin. |
| Bot / `api_token` en `pacientes.php` | Permitido: upsert/insert, `update_name`, `get_email_by_phone`, waitlist. **Bloqueado:** merge, deduplicate, send_email, toggles, update_phone, encuesta. |
| `get_email_by_phone` | Exacto primero; sufijo 8 dígitos solo si hay **un** candidato. |
| Email en dispatch manual | Preferir helper por teléfono; fallback nombre **exacto** (nunca `LIKE %nombre%`). |
| Campaña → paciente | Tel exacto; sufijo 8 solo si es único; vivos (`deleted_at IS NULL`). |
| `update_name` | Siempre por `id` (si viene solo teléfono, se resuelve a un id activo). |
| Recordatorio manual | Claim atómico (`claim:…`) antes de WhatsApp/email. |
| UI directorio | No colapsa duplicados en memoria; se muestran para Unificar. |
