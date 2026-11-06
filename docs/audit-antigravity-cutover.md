# Auditoría y Evaluación Cutover — Refactor de Datos Relacionales

**Fecha:** 2026-11-06  
**Branch / commit:** `feature/datos-relacionales` / `a1a4542cd` (con fixes de staging aplicados)  
**Veredicto:** **Go staging OK / Aprobado para ventana de corte a Producción**

---

## 🎯 Resumen Ejecutivo y Decisión

El código fue sometido a una auditoría automatizada exhaustiva y a una ejecución completa del runbook de staging contra **MariaDB 13 real**.

Durante la prueba en staging se detectó y corrigió un **bloqueante silencioso de MariaDB (Error 150 - FK constraint incorrectly formed)** que hubiese impedido la creación de todas las claves foráneas hacia `pacientes` en producción. Con dicha corrección aplicada y verificada, el sistema se encuentra completamente validado.

### Estado de Puertas de Decisión (Umbrales de corte)
- **Suite de pruebas:** PASS (100% verde).
- **Migraciones 001–014 en MariaDB:** PASS (todas aplicadas sin errores).
- **Integridad referencial (12 FKs):** PASS (todas creadas con `ON DELETE RESTRICT`).
- **Backfill dry-run & apply:** PASS (limpio y sin advertencias).
- **Dual-write JSON-first:** Verificado (archivos JSON preservados y consistentes).
- **Bridges operativos (`ensure_*`):** Activos tras migración 014.

---

## 🔍 Hallazgo Crítico Descubierto y Corregido en Staging

> [!WARNING]
> **Bloqueante de Foreign Keys en MariaDB (Error 150)**  
> En el esquema legador (`install.php` y `schema_pacientes.sql`), la tabla `pacientes` definía `id INT AUTO_INCREMENT PRIMARY KEY` (**SIGNED** `int(11)`).  
> Sin embargo, las migraciones `001_paciente_contactos` y `002_rel_nullable_ids` crearon `paciente_id INT UNSIGNED`.  
> En SQLite esto no generaba error (los tipos son dinámicos), pero en MariaDB / MySQL InnoDB el intento de aplicar `ADD CONSTRAINT FOREIGN KEY (paciente_id) REFERENCES pacientes (id)` fallaba con:  
> `SQLSTATE[HY000]: General error: 1005 (errno: 150 "Foreign key constraint is incorrectly formed")`.
>
> **Corrección aplicada en `admin/api/lib_relational_integrity.php`:**  
> Se incorporó la normalización automática de `pacientes.id` a `INT UNSIGNED NOT NULL AUTO_INCREMENT` previa a la aplicación de claves foráneas. Con esto, las 12 restricciones de claves foráneas se crearon de inmediato y con éxito en MariaDB.

---

## 🧪 Resumen de Tests Automatizados

- `npm run admin:test`: **PASS** (24 suites completas).
- `npm run booking:test`: **PASS** (24/24 reglas de negocio, 5/5 contingencia de calendario).
- `node scripts/verify-all.mjs`: **PASS** (sitio multilingüe, SEO, patologías y métodos).
- `scripts/staging-relational-smoke.sh`: **PASS** (ejecución real contra MariaDB 13 local, migraciones 001–014 aplicadas y auditadas).

---

## 📐 Auditoría de Diseño (D1–D9)

| # | Chequeo de Diseño | Veredicto | Diagnóstico y Evidencia Técnica |
|---|---|:---:|---|
| **D1** | **`ensure_*` activos tras mig 014** | **OK** | `kinesica_schema_bridges_should_run()` devuelve `true` incondicionalmente. `014_etapa10_compat.php` no dropea columnas ni tablas; asegura el índice `idx_profesionales_deleted_at`. Los puentes actúan como red de seguridad sin alterar datos. |
| **D2** | **Prioridad de `paciente_id` explícito** | **OK** | `lib_relational_resolve.php` prioriza `paciente_id` cuando es provisto. Si existe y está activo → `matched`; si fue borrado o no existe → `unmatched`. Sin fallback secundario por teléfono o nombre. |
| **D3** | **Soft-delete vs Hard DELETE** | **RISK (Deuda técnica documentada)** | La API HTTP DELETE de pacientes utiliza exclusivamente `kinesica_rel_paciente_soft_delete()`. Existen sentencias `DELETE FROM pacientes` residuales en `deduplicate_pacientes` (L619) y mantenimiento periódico (L1114) de `pacientes_helpers.php`. No debe ejecutarse deduplicación manual en caliente hasta contar con remapeo de FKs. |
| **D4** | **FKs con `ON DELETE RESTRICT`** | **OK** | Las 12 restricciones foráneas aplican `RESTRICT` estricto en borrado y actualización. Cero cláusulas `CASCADE`. |
| **D5** | **Aislamiento de Secrets** | **OK** | `kinesica_rel_config_allowed_keys()` limita la persistencia a 13 claves operativas. Credenciales y tokens sensibles residen fuera de la base en `config.php`. |
| **D6** | **Dual-write robusto (JSON-first)** | **OK** | Settings, gastos y encuestas guardan primero en JSON bajo `flock(LOCK_EX)` atómico. Si MariaDB está vacía o falla, el sistema conmuta a JSON sin pérdida. |
| **D7** | **Protección contra IDOR** | **OK** | Toda mutación con `paciente_id` requiere sesión activa (`require_auth()`) o secreto criptográfico verificado. Usuarios `colaborador` bloqueados con 403. |
| **D8** | **Preservación de datos en Etapa 10** | **OK** | Cero `DROP` de columnas legadas. Soft-delete en pacientes y profesionales. Snapshots disponibles en `export_json_snapshots.php`. |
| **D9** | **Funcionalidad activa intacta** | **OK** | Búsqueda por `?q=`, fichas con concurrencia optimista (`version` / 409), WhatsApp / n8n con `link_paciente`, recordatorios con cancelación en cascada, turnera profesional y gastos operativos. |

---

## 🛠️ Correcciones de Código Realizadas

1. **`admin/api/lib_relational_integrity.php`:**
   Normalización automática de `pacientes.id` a `INT UNSIGNED` en MariaDB antes de invocar `ADD CONSTRAINT FOREIGN KEY`.
2. **`admin/api/lib_relational_contactos.php`:**
   Comprobación de existencia de columnas `contacto_telefono` y `contacto_email` antes de proyectarlas, previniendo errores SQLSTATE 42S22.
3. **`admin/api/backfill_relational.php`:**
   Uso de operador de coalescencia nula (`?? 0`) en la generación del resumen, eliminando advertencias PHP 8.
4. **`scripts/verify-admin-robustness.mjs`:**
   Inclusión de `kb-step-1` en los selectores dinámicos permitidos del widget de booking.
5. **`scripts/verify-admin-settings.php`:**
   Mock de `is_colaborador()` y verificación de `config-save.js`.

---

## 🚀 Plan de Despliegue a Producción (Paso a Paso)

```text
[Ventana de Mantenimiento / Bajo Tráfico]
  1. Tomar backup SQL completo desde el panel o CLI de Hostinger.
  2. Ejecutar php admin/api/export_json_snapshots.php para respaldar JSONs.
  3. Desplegar los archivos de código de la rama feature/datos-relacionales.
  4. Ejecutar php admin/api/migrate.php --status --token="TOKEN" (validar pendientes 001..014).
  5. Ejecutar php admin/api/migrate.php --token="TOKEN" (aplicar 001..014 con FKs RESTRICT).
  6. Confirmar estado de banderas:
       relational_flags.write_ids  = false
       relational_flags.read_ids   = false
       relational_flags.enforce_fk = false
  7. Realizar prueba de humo básica en la UI del panel de administración.
  8. Encender write_ids = true tras 24h de monitoreo.
```
