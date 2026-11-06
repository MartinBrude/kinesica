# Informe auditoría datos relacionales

Generado: `2026-11-06T22:22:14+00:00`
PII completo: `no (enmascarado)`

## Resumen

- Pacientes: 0
- Fichas: 0
- Lista de espera: 0
- Ítems revisión manual: 0
- Schema OK: sí

## Conteos pacientes

- `empty_or_blank_name`: 0
- `test_or_blocked_name`: 0
- `invalid_phone`: 0
- `placeholder_phone`: 0
- `no_reliable_identifier`: 0
- `name_mismatch`: 0
- `duplicate_phones_same_name`: 0
- `shared_phones_different_names`: 0
- `duplicate_dni`: 0
- `duplicate_email`: 0
- `same_name_groups`: 0

## Conteos fichas

- `invalid_json`: 0
- `without_patient_match`: 0
- `dni_multiple_patients`: 0
- `profesional_unknown`: 0
- `profesional_inactive`: 0
- `duplicate_patient_date`: 0
- `missing_foto_file`: 0

## Conteos lista de espera

- `without_patient`: 0
- `invalid_estado`: 0
- `active_duplicates_by_phone`: 0
- `name_conflicts_vs_paciente`: 0

## Reglas de resolución

- No fusionar automáticamente casos ambiguos.
- Teléfono compartido con nombres distintos → revisión manual (familia), no fusión.
- DNI duplicado → bloqueo hasta revisión.
- Candidato a fusión: mismo teléfono normalizado y mismo name_key, o mismo DNI único tras limpieza.
- Ficha sin paciente: backfill por DNI único; si no hay match, pendiente.
- Lista de espera: asociar por teléfono normalizado; conflicto de nombre → manual.
- wa_id es identificador externo; no es paciente_id.

## Notas de esquema

- Drift conocido: estados lista_espera difieren entre schema_pacientes.sql (activa|notificado|asignado|expirada) y pacientes_helpers.php (activa|contactado|asignado|cancelada). Auditoría acepta la unión.

_Detalle completo en el JSON acompañante. No fusionar ni borrar desde este informe._
