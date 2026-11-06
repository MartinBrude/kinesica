# Etapa 9 — Integridad referencial obligatoria

**Status:** implementada en `feature/datos-relacionales`  
**Mapa de código:** [codigo-datos-relacionales.md](codigo-datos-relacionales.md)  
**Plan:** [plan-refactor-datos-relacionales.md](plan-refactor-datos-relacionales.md)  
**Runbook:** [runbook-datos-relacionales-antigravity.md](runbook-datos-relacionales-antigravity.md)

## Alcance

| Pieza | Detalle |
|-------|---------|
| FKs | `ON DELETE RESTRICT` en `paciente_id` / `profesional_id` / `turno_id` (mig **013**) |
| Soft-delete | `DELETE /pacientes` → `pacientes.deleted_at` (no hard-delete) |
| CHECK | `turnos.status/source`, `recordatorio_eventos.status` (MariaDB; best-effort) |
| Flag | `REL_ENFORCE_FK` = validación app de IDs (no apaga FKs SQL) |
| Errores | PDO 1451/1452/23000 → 409/422 `referential_integrity` / `fk_restrict_delete` |

**No incluido:** NOT NULL masivo (opcional futuro `014`), CASCADE, secrets en DB, rewrite Clara.

## Precondiciones ops

Antes de `migrate 013` en staging/prod:

1. Backup MariaDB + restore practicado.
2. `audit_relational.php` limpio (0 huérfanos clínicos no exceptuados; 0 prof inválidos).
3. Umbral lectura legacy &lt; 2 % (plan).
4. `npm run admin:test` verde.

La mig **nullifica IDs huérfanos** (preflight) para que `ALTER … ADD CONSTRAINT` no falle. Revisar logs `kinesica 013: nulled …`.

## Migración

| ID | Efecto |
|----|--------|
| `013_rel_integrity_fks` | Null orphans → ADD FK RESTRICT (+ CHECK status) |

SQLite: `ALTER ADD FK` no es portable → no-op en migrate; tests usan `CREATE` + `PRAGMA foreign_keys=ON`.

## Flag `REL_ENFORCE_FK`

```json
"relational_flags": { "enforce_fk": true }
```

o `KINESICA_REL_ENFORCE_FK=1`.

Con el flag: asserts en writes (p. ej. fichas) rechazan paciente/profesional inexistente o soft-deleted.

**Rollback del flag:** `enforce_fk=false` relaja solo la app. Las FKs InnoDB siguen hasta `DROP CONSTRAINT` (mig futura) o restore.

## Soft-delete

- Listados/búsqueda/directory excluyen `deleted_at IS NOT NULL`.
- Paciente con fichas/contactos/etc. **sí** se soft-deleta (RESTRICT bloqueaba el hard-delete).

## Backfill / migrate

```bash
php admin/api/migrate.php --token="$INSTALL_TOKEN"
# (013 se aplica con el runner; no requiere backfill de IDs nuevo)
```

Activar flag solo tras humo FK:

```bash
# settings o env
KINESICA_REL_ENFORCE_FK=1
```

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `migrations/013_rel_integrity_fks.php` | Null orphans + ADD FK/CHECK |
| `lib_relational_integrity.php` | Specs FK, soft-delete, asserts, mapper PDO |
| `lib_migrations.php` | `add_fk_if_missing` / `add_check_if_missing` |
| `pacientes.php` | DELETE → soft-delete; listados filtran `deleted_at` |
| `fichas_ops.php` | Asserts si `REL_ENFORCE_FK` |

## Tests

```bash
php scripts/verify-relational-fk.php
php scripts/verify-relational-migrations.php
```

## Criterios

| Verificar | Cobertura |
|-----------|-----------|
| No referenciar paciente inexistente | FK + assert con flag |
| No asignar profesional inexistente | FK + assert |
| No borrar paciente con historia (hard) | RESTRICT + soft-delete API |
| API errores controlados | `lib_relational_integrity` mapper |
| Backup incluye restricciones | dump con FKs; restore con `foreign_key_checks` |
