# Checklist staging — datos relacionales (≈10 min)

**Objetivo:** probar migrate/backfill/humo sobre una **copia** de prod antes de tocar la DB live.  
**Branch:** `feature/datos-relacionales`  
**Detalle:** [runbook](runbook-datos-relacionales-antigravity.md) · [backups](backups-y-recuperacion.md)

## Reglas

1. **Nunca** `migrate` / `backfill --apply` / flags `true` contra la DB de producción en este paso.
2. Usá una base **aparte** (`kinesica_staging` o similar).
3. Si algo falla → **No-go** prod; corregí en staging y repetí.

---

## A. Copia de la base (2–3 min)

### Opción 1 — Panel admin (rápido)

1. En prod: `/admin` → Exportar Backup SQL.  
2. Guardá `kinesica-backup-YYYY-MM-DD.sql` fuera del repo (no commitear).

### Opción 2 — CLI en Hostinger

```bash
# En el servidor (ruta típica; ajustá uXXXXXXX)
php /home/uXXXXXXX/domains/kinesica.com.ar/public_html/admin/api/backup.php
# Sale en: /home/uXXXXXXX/backups/atm/kinesica-YYYY-MM-DD.sql
```

También copiá runtime JSON si querés dual-write realista:

```bash
# data/settings.json, gastos.json, encuestas.json (si existen)
```

---

## B. Base staging (2 min)

En hPanel → Bases de datos MySQL:

1. Creá DB + usuario (ej. `…_atm_stg`) **distintos** de prod.  
2. Restaurá el dump:

```bash
mysql -h 127.0.0.1 -u USUARIO_STG -p NOMBRE_DB_STG < kinesica-backup-YYYY-MM-DD.sql
```

(Local: mismo comando contra MariaDB/Docker.)

3. Config staging (no subir a git):

```bash
cp admin/api/config.example.php /ruta/privada/admin-config-staging.php
# Editá db.host/name/user/pass + install_token (puede ser el mismo token de prueba)
```

---

## C. Apuntar el código a staging (30 s)

```bash
git checkout feature/datos-relacionales
export KINESICA_ADMIN_CONFIG=/ruta/privada/admin-config-staging.php
export INSTALL_TOKEN='…'   # = install_token del config staging
```

Verificá que **no** apunta a prod: abrí el config y mirá `db.name`.

---

## D. Tests + migrate dry-run (3 min)

Una sola pasada:

```bash
bash scripts/staging-relational-smoke.sh
```

O a mano:

```bash
npm run admin:test

php admin/api/migrate.php --status --token="$INSTALL_TOKEN"
php admin/api/migrate.php --dry-run --token="$INSTALL_TOKEN"
# Revisá pending 001…014. Si OK:
php admin/api/migrate.php --token="$INSTALL_TOKEN"

php admin/api/audit_relational.php --token="$INSTALL_TOKEN" \
  --out=docs/audit-report-staging.json --md=docs/audit-report-staging.md

php admin/api/backfill_relational.php --dry-run --token="$INSTALL_TOKEN" \
  --out=docs/backfill-dry-staging.json
```

Esperado: `admin:test` verde; migrate aplica `001`…`014` sin error; audit sin sorpresas críticas.

---

## E. Humo funcional (2–3 min)

Con el admin apuntando a staging (mismo `KINESICA_ADMIN_CONFIG`):

| Check | OK? |
|-------|-----|
| Listar / buscar pacientes | ☐ |
| Abrir y guardar ficha (version) | ☐ |
| Settings / horarios guardar | ☐ |
| Gastos listar (admin) | ☐ |
| DELETE paciente → soft (`deleted_at`) | ☐ |
| (Opcional) encuesta / waitlist / cancel turno | ☐ |

Flags: en staging podés poner `write_ids` + `read_ids` = true; `enforce_fk` solo tras backup+migrate OK.

---

## F. Veredicto

| Resultado | Acción |
|-----------|--------|
| Todo verde | Go staging; después backup fresco + migrate prod en ventana |
| Fallo test/migrate/humo | No-go; arreglar en branch; repetir checklist |
| Audit con huérfanos | Documentar excepciones o backfill `--apply` **solo en staging** y re-auditar |

Informe sugerido: `docs/audit-antigravity-cutover.md` (plantilla en el instructivo).

---

## Prod (solo después de Go)

1. Backup SQL **fresco** de prod.  
2. `migrate.php --dry-run` → `migrate.php` (sin backfill apply a ciegas).  
3. Flags siguen `false` hasta ventana acordada.  
4. Humo mínimo en prod.  
5. Activar `write_ids` / `read_ids` con observación; `enforce_fk` al final.
