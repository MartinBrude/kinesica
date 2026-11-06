# Plan de refactor de datos relacionales

**Status:** Draft — implementación en `feature/datos-relacionales`  
**Última revisión:** 2026-11-06  
**Ámbito:** plataforma admin/API operativa (no el sitio estático SEO)  
**Línea base:** [baseline-datos-relacionales.md](baseline-datos-relacionales.md)  
**Mapa de código:** [codigo-datos-relacionales.md](codigo-datos-relacionales.md)  
**Runbook staging:** [runbook-datos-relacionales-antigravity.md](runbook-datos-relacionales-antigravity.md)

## Propósito

Evolucionar Kinésica hacia una arquitectura relacional centralizada, con MariaDB/MySQL como fuente de verdad para los datos operativos. El refactor debe permitir consultas y actualizaciones desde varias pantallas, APIs y automatizaciones sin duplicados ni pérdida de integridad referencial.

Este documento define etapas, auditorías, pruebas, criterios de salida y rollback. No se debe ejecutar una migración productiva sin completar las etapas anteriores.

## Veredicto

**Sí tiene sentido y es seguro** si se ejecuta por etapas, sin big bang, con FKs nullable primero, sin fusiones automáticas de casos ambiguos, `ON DELETE RESTRICT` en datos clínicos y backups restaurables verificados.

| Dimensión | Impacto | Notas |
|-----------|---------|--------|
| Estabilidad / integridad | Alto | Identidad por ID, menos drift al cambiar teléfono/nombre, migraciones versionadas, optimistic locking, menos DDL en requests. |
| Seguridad | Parcial / indirecto | Reduce mezcla accidental de historias (PII cross-link) y añade auditoría. **No** sustituye hardening de auth, roles, secrets ni permisos de archivos. |

Al introducir `paciente_id` / `profesional_id` en APIs aparece un riesgo nuevo de **IDOR**: cada endpoint que acepte esos IDs debe validar sesión, rol y alcance antes de leer o escribir.

## Alcance y fuera de alcance

### En alcance

- MariaDB del admin: pacientes, fichas/sesiones clínicas, lista de espera, turnos locales, interacciones WhatsApp, recordatorios, encuestas, configuración operativa, gastos, auditoría.
- Consolidar esquema (`schema_pacientes.sql`, `install.php`, DDL en helpers) en migraciones versionadas.
- Dejar de usar teléfono, nombre o `wa_id` como clave relacional interna (siguen siendo datos / identificadores externos).

### Fuera de alcance

- Sitio estático multilingüe y sus fuentes SEO (`scripts/*-content.mjs`, `i18n-urls.mjs`, builders públicos).
- Hardening completo de autenticación, 2FA, rate limits o rotación de secrets (puede hacerse en paralelo, no bloquea este plan).
- Sustituir Google Calendar como sistema externo de agenda (solo espejo local + sync idempotente).

### Clara / n8n / SQLite (contrato explícito)

El bot Clara mantiene un núcleo aparte (SQLite, workflows, secrets) documentado en [backups-y-recuperacion.md](backups-y-recuperacion.md). **Este refactor no unifica Clara en MariaDB en el MVP.**

Durante y después del MVP:

- MariaDB del admin es la fuente de verdad de identidad de pacientes.
- Clara puede seguir usando `wa_id` / teléfono como identificadores **externos**.
- Cualquier sync futuro debe ser read-mostly hacia Clara o escribir solo vía API admin con IDs internos; no inventar un segundo directorio de pacientes.
- Divergencia Clara ↔ admin queda como riesgo conocido hasta un plan de integración dedicado.

## Principios no negociables

- No hacer un cambio big bang.
- Mantener compatibilidad durante la transición.
- No borrar datos antiguos hasta verificar los nuevos.
- No usar nombre, teléfono o username como clave relacional.
- Usar IDs internos y claves foráneas.
- Hacer las migraciones repetibles o detectar que ya fueron aplicadas.
- Toda etapa debe tener criterios objetivos de salida.
- Las operaciones de varias tablas deben usar transacciones.
- Las tablas clínicas no deben borrarse en cascada.
- Los casos ambiguos deben quedar pendientes de revisión.
- Todo write que acepte `paciente_id` o `profesional_id` debe pasar por control de autorización (sesión + rol).
- No loguear PII completa en auditoría ni en métricas (usar IDs y hashes/últimos dígitos cuando haga falta diagnóstico).

## MVP vs roadmap completo

El documento describe el roadmap completo (etapas 0–10). **No ejecutar todo de una vez.**

| Fase | Etapas | Objetivo |
|------|--------|----------|
| **MVP** | 0 → 5 | Baseline, auditoría, migraciones, FKs nullable, pacientes/contactos, fichas con IDs y `version`. |
| Post-MVP | 6 → 8 | Lista de espera/turnos, WhatsApp/recordatorios/encuestas, configuración admin. |
| Cierre | 9 → 10 | FKs obligatorias y retirada de compatibilidad antigua. |

Puerta entre MVP y post-MVP: métricas de fallback en descenso (ver [Umbrales de salida](#umbrales-de-salida)) y al menos una ventana de observación estable en producción con `REL_WRITE_IDS` activo.

## Feature flags

Viven en configuración runtime del admin (misma familia que settings; preferible fila/clave en DB cuando exista `configuraciones`, o settings con default seguro). Defaults productivos iniciales: todo en `false` salvo que una etapa diga lo contrario.

| Flag | Default | Efecto |
|------|---------|--------|
| `REL_WRITE_IDS` | `false` | En writes, resolver y persistir `paciente_id` / `profesional_id` cuando sea posible; mantener columnas legacy. |
| `REL_READ_IDS` | `false` | Preferir joins/lecturas por ID; si falta ID, fallback legacy. |
| `REL_ENFORCE_FK` | `false` | Etapa 9: asserts app de IDs. FKs SQL = mig `013` (MariaDB). NOT NULL masivo = opcional `014`. |

Rollback operativo de una etapa de lectura/escritura: apagar el flag correspondiente sin borrar columnas ni datos ya escritos.

## Estado actual

Actualmente conviven MariaDB/MySQL y archivos JSON vivos:

- pacientes y lista_espera en MariaDB (`telefono` UNIQUE como identidad de facto).
- fichas con un payload JSON.
- interaccion_eventos y recordatorio_eventos en MariaDB (DDL vía `ensure_*` en requests).
- configuración en admin/api/data/settings.json (y posibles rutas legacy).
- gastos, encuestas y errores en JSON.
- relaciones resueltas parcialmente por teléfono, nombre, wa_id y contenido del JSON.
- profesionales como textos (`norberto` / `maria` / `indistinto`), no como IDs.

Referencias:

- [admin/api/install.php](../admin/api/install.php)
- [admin/api/schema_pacientes.sql](../admin/api/schema_pacientes.sql)
- [admin/api/pacientes_helpers.php](../admin/api/pacientes_helpers.php)
- [admin/api/kinesica_settings_storage.php](../admin/api/kinesica_settings_storage.php)
- [admin/api/lib_interacciones_store.php](../admin/api/lib_interacciones_store.php)
- [admin/api/lib_recordatorios_store.php](../admin/api/lib_recordatorios_store.php)

## Arquitectura objetivo

MariaDB será la fuente de verdad para datos operativos del admin.

~~~text
users
  └── profesionales

pacientes
  ├── paciente_contactos
  ├── sesiones_clinicas
  ├── turnos
  ├── lista_espera
  ├── conversaciones
  │     └── mensajes
  ├── recordatorios
  └── encuestas

configuraciones
gastos
auditoria_cambios
~~~

El JSON podrá conservarse para contenido flexible, snapshots históricos, exportaciones o backups, pero no como fuente principal de identidad o relaciones.

**Prioridad de migración de JSON:** settings operativos (profesionales, horarios, honorarios, mensajes Clara) → gastos → encuestas. **`errores.json` puede permanecer en archivo** en el MVP y post-MVP temprano; no bloquea integridad clínica.

### Entidades mínimas

pacientes debe contener la identidad canónica: id, nombre, apellido, dni, email, motivo_consulta, notas, created_at, updated_at, deleted_at y version.

paciente_contactos debe permitir varios teléfonos o emails: id, paciente_id, tipo, valor, valor_normalizado, es_principal y verificado_at.

**Teléfonos compartidos (familia):** no imponer `UNIQUE(tipo, valor_normalizado)` global. Un mismo teléfono puede vincularse a más de un paciente tras revisión. Restricciones previstas:

- Como máximo un contacto `es_principal = 1` por `(paciente_id, tipo)`.
- Índice no único en `(tipo, valor_normalizado)` para búsqueda.
- Alta automática solo asocia si hay coincidencia inequívoca; si el teléfono ya pertenece a otro paciente, queda pendiente de revisión (no fusión automática).

Implementación: [`lib_relational_contactos.php`](../admin/api/lib_relational_contactos.php) (sync en upsert/update + backfill `--only=paciente_contactos`).

profesionales debe relacionar cada profesional con users; las tablas funcionales deben usar profesional_id, no textos como norberto o maria.

Implementación parcial: migración `005_profesionales` + [`lib_relational_profesionales.php`](../admin/api/lib_relational_profesionales.php) + optimistic locking `fichas.version` (409 si conflict). Runbook: [runbook-datos-relacionales-antigravity.md](runbook-datos-relacionales-antigravity.md).

sesiones_clinicas debe tener paciente_id, profesional_id, fecha, payload_json, version, updated_by y fechas de auditoría.

lista_espera debe tener paciente_id, profesional_id, preferencias y estado; no debe guardar nombre ni teléfono como identidad (pueden denormalizarse solo para vista/caché).

Las conversaciones y mensajes deben separarse. wa_id será un identificador externo y event_key debe ser único.

Los turnos deben tener representación local con paciente_id, profesional_id y calendar_event_id UNIQUE, aunque Google Calendar siga siendo externo.

## Nota Hostinger / DDL

- Tras la etapa 2, **ningún endpoint normal del admin debe ejecutar DDL** (`CREATE`/`ALTER`); solo el runner de migraciones (CLI/cron acotado o install controlado).
- `ALTER` en tablas grandes puede bloquear: ejecutar en ventana de bajo uso, primero en copia de producción, medir duración.
- Probar backup + restore en el mismo plan de hosting (MariaDB InnoDB) antes de FKs obligatorias.
- Ver también [backups-y-recuperacion.md](backups-y-recuperacion.md).

## Etapa 0 — Línea base y backups

### Tareas

- Documentar endpoints, tablas, archivos JSON y escrituras.
- Registrar rutas que crean tablas dinámicamente (`ensure_pacientes_tables`, `interacciones_ensure_schema`, `recordatorios_ensure_schema`, etc.).
- Ejecutar:

~~~bash
npm run admin:lint
npm run admin:test
npm run verify
~~~

- Guardar respuestas de referencia para pacientes, fichas, horarios, configuración, conversaciones y recordatorios.
- Hacer backup de MariaDB y de admin/api/data/.
- Probar la restauración en una base de prueba.
- Listar consumidores externos (n8n, Clara, Google Calendar) sin modificarlos.

### Verificar

- Tests actuales en verde.
- Backup restaurable.
- Respuestas reproducibles.
- Consumidores de cada dato identificados.
- Ningún cambio funcional.

### Criterio de salida

Existe una línea base escrita y un backup restaurable.

### Rollback

No aplica; esta etapa es de observación.

## Etapa 1 — Auditoría de datos y esquemas

Implementación: [`admin/api/lib_relational_audit.php`](../admin/api/lib_relational_audit.php) + CLI [`admin/api/audit_relational.php`](../admin/api/audit_relational.php) (`npm run admin:audit`). Ver [baseline-datos-relacionales.md](baseline-datos-relacionales.md).

### Auditoría de pacientes

Comprobar teléfonos duplicados tras normalización, teléfonos vacíos o inválidos, DNI duplicados, emails duplicados, nombres vacíos o de prueba, diferencias entre nombre, apellido y sus derivados, teléfonos compartidos (candidatos a multi-paciente, no a fusión ciega), pacientes sin identificador confiable, candidatos a fusión y casos que no deben fusionarse.

### Auditoría de fichas

Comprobar coincidencia única por DNI, coincidencia única por teléfono, conflictos entre DNI y teléfono, fichas sin paciente, profesionales inexistentes o desactivados, fichas duplicadas por paciente y fecha, payloads JSON inválidos y fotos referenciadas que no existen.

### Auditoría de lista de espera

Comprobar teléfonos sin paciente, duplicados activos, estados fuera del catálogo, nombres diferentes para el mismo teléfono y datos personales antiguos.

### Auditoría de WhatsApp y recordatorios

Comprobar conversaciones por wa_id sin paciente, varios nombres para el mismo wa_id, recordatorios sin turno, event_key duplicados, eventos de calendario repetidos y pacientes identificables solo por nombre.

### Auditoría de esquemas

Comparar y consolidar:

- [schema_pacientes.sql](../admin/api/schema_pacientes.sql)
- [install.php](../admin/api/install.php)
- [pacientes_helpers.php](../admin/api/pacientes_helpers.php)

Verificar tipos de IDs, longitudes, estados, columnas, índices, defaults, updated_at y diferencias entre SQLite de pruebas y MariaDB.

### Reglas

- No fusionar automáticamente casos ambiguos.
- No borrar duplicados durante la auditoría.
- Registrar siempre el valor anterior y el nuevo.

### Criterio de salida

Existe un informe con registros válidos, duplicados, huérfanos, casos ambiguos, reglas de resolución y lista de revisiones manuales.

## Etapa 2 — Migraciones versionadas

### Tareas

- Crear directorio de migraciones.
- Crear tabla de control de migraciones.
- Consolidar el esquema en una única fuente.
- Crear las tablas nuevas sin cambiar las rutas antiguas.
- Introducir flags `REL_*` con default `false`.
- Probar en una base vacía y en una copia de producción.
- Verificar que la segunda ejecución sea segura.
- Planificar retiro gradual de DDL en `ensure_*` (dejar no-op o check de versión de esquema).

### Verificar

- Migraciones idempotentes.
- Orden explícito.
- Tablas InnoDB.
- Índices para todas las relaciones.
- Ningún DDL desde peticiones normales del admin (tras cutover del runner).
- Aplicación compatible aunque aún no existan relaciones nuevas.
- ALTER medido en copia (duración, locks).

### Criterio de salida

El esquema se instala y actualiza repetidamente en pruebas.

### Rollback

En desarrollo se eliminan solo tablas nuevas. En producción se usa migración inversa o restauración aprobada, nunca un borrado improvisado.

## Etapa 3 — Relaciones opcionales

Activar `REL_WRITE_IDS=true` (lectura legacy hasta que `REL_READ_IDS` esté listo).

Lecturas: [`lib_relational_read.php`](../admin/api/lib_relational_read.php) — con `REL_READ_IDS` las vistas de fichas, lista de espera, interacciones y recordatorios prefieren datos canónicos por `paciente_id` y registran fallback en `rel_read_fallback.jsonl`.

Añadir temporalmente:

~~~text
fichas.paciente_id
fichas.profesional_id
lista_espera.paciente_id
interaccion_eventos.paciente_id
recordatorio_eventos.paciente_id
~~~

Los writes deben resolver y escribir el ID cuando sea posible, mantener el fallback antiguo y registrar los casos no relacionados.

### Authz

- Endpoints que acepten `paciente_id` / `profesional_id` en body/query deben rechazar IDs fuera de alcance del rol (colaborador vs admin) con 403, no 404 engañoso que filtre existencia sin política clara.

### Verificar

- Registros nuevos con ID cuando corresponde.
- Fallback antiguo operativo.
- Métrica diaria de registros sin ID.
- Sin duplicados por carreras concurrentes.
- Errores de relación controlados.

### Criterio de salida

Las nuevas operaciones escriben relaciones canónicas y el porcentaje de fallback baja de forma sostenida (ver umbrales).

Backfill de históricos: [`admin/api/backfill_relational.php`](../admin/api/backfill_relational.php) (`--dry-run` / `--apply`). Solo rellena `paciente_id` NULL con matches inequívocos; ambiguos quedan para revisión manual.

### Rollback

Desactivar `REL_READ_IDS` / `REL_WRITE_IDS` y conservar los datos para reintentar.

## Etapa 4 — Pacientes y contactos

### Orden de asociación

1. Teléfono normalizado exacto (si apunta a un solo paciente).
2. DNI único.
3. Nombre normalizado y datos complementarios.
4. Revisión manual (obligatoria si el teléfono ya está en otro paciente).

### Reglas

- Un teléfono compartido no implica duplicado ni fusión.
- Un DNI compartido queda bloqueado para revisión.
- Cambiar teléfono actualiza el contacto, no el paciente_id.
- No fusionar historias sin decisión explícita.

### Verificar

- Pacientes activos con identificador válido.
- Contactos principales únicos **por paciente y tipo**.
- Sin duplicados no revisados.
- Fusiones auditadas.
- Historial de valores anteriores conservado.

### Criterio de salida

La tabla de correspondencias está completa o todos los pendientes están clasificados.

### Rollback

Revertir asociaciones usando la tabla de correspondencias; no borrar pacientes automáticamente.

## Etapa 5 — Fichas clínicas

**Cierre del MVP** cuando esta etapa cumple su criterio de salida.

### Tareas

- Rellenar paciente_id y profesional_id.
- Mantener payload_json durante la transición.
- Añadir version.
- Rechazar sobrescrituras obsoletas.
- Conservar validaciones clínicas.
- Activar `REL_READ_IDS` para pantallas de fichas cuando el backfill de válidas esté completo.

### Pruebas

- Crear, editar, consultar e imprimir.
- Comparar dos sesiones.
- Dos usuarios editando simultáneamente.
- Guardado con versión antigua.
- Eliminación o archivado según las reglas actuales.
- Intento de acceso a ficha/paciente_id sin permiso.

### Criterio de salida

Todas las fichas válidas tienen paciente y profesional. Biblioteca, comparativa e impresión conservan su comportamiento. Umbrales MVP cumplidos.

### Rollback

Volver a leer desde el payload existente (`REL_READ_IDS=false`) y mantener las relaciones nuevas opcionales.

## Etapa 6 — Lista de espera y turnos

Post-MVP. **Cerrada en código (sombra + booking):** migración `006_turnos`, [`lib_relational_turnos.php`](../admin/api/lib_relational_turnos.php), API [`turnos.php`](../admin/api/turnos.php) (register/cancel), sync campaña + recordatorios + `calendar_backup` + admin booking + mirror GAS (`mirrorTurnoToAdmin`), lista_espera por `paciente_id` (tel/nombre denormalizados). Google Calendar sigue siendo la agenda; la camilla única sigue en GAS.

### Tareas

- Cambiar lista de espera a paciente_id. *(hecho: insert por ID + resolve; tel/nombre cache)*
- Crear representación local de turnos. *(hecho)*
- Hacer único calendar_event_id. *(UNIQUE en `turnos`)*
- Hacer idempotente Google Calendar. *(upsert local + mirror post-book)*
- Relacionar recordatorios con turno_id. *(insert + backfill + cancel anula pending)*

### Verificar

- Cambiar teléfono no rompe la lista (si hay `paciente_id`).
- Cambiar nombre se refleja en vistas (`REL_READ_IDS`).
- No hay turnos duplicados (UNIQUE `calendar_event_id`).
- Sigue funcionando la regla de una sola camilla (GAS).
- Cancelar turno actualiza recordatorios pending → skipped/cancelled.
- Repetir sync no duplica eventos.

### Criterio de salida

Espejo local por IDs + `calendar_event_id`; el calendario externo sigue siendo fuente de verdad de agenda. Deploy del GAS actualizado requerido para mirror en vivo.

### Rollback

Mantener temporalmente el flujo anterior y conservar los registros locales.

## Etapa 7 — WhatsApp, recordatorios y encuestas

Post-MVP. Coordinar contrato con Clara (solo IDs externos / API); no asumir que SQLite del bot se migra aquí.

**Implementado:** mig `007` (`interaccion_estado.paciente_id`/`wa_id`) + `008_encuestas`; libs `lib_relational_interacciones.php` / `lib_relational_encuestas.php`; dual-write JSON↔DB; backfill `interaccion_estado` + `encuestas`. Modelo conceptual sin rename: estado ≈ conversación, eventos ≈ mensajes. Recordatorios ya tenían `paciente_id`/`turno_id` (etapa 6).

### Tareas

- Separar conversaciones y mensajes. *(conceptual: estado/eventos; sin split físico)*
- Asociar conversaciones a paciente_id. *(hecho en estado)*
- Asociar recordatorios a paciente_id y turno_id. *(hecho en etapa 6)*
- Mantener wa_id como dato externo. *(sí)*
- Conservar snapshots de nombre solo como histórico. *(patient_name en eventos/estado)*
- Migrar encuestas a una tabla relacional. *(dual-write + backfill)*

### Verificar

- Asociación posterior de una conversación. → `POST link_paciente`
- Cambio de teléfono sin nueva historia clínica. → lecturas por `paciente_id`
- Idempotencia por event_key. → sin cambio de contrato n8n
- Métricas coincidentes. → vista + KPI encuestas unificados
- Recordatorios basados en datos actuales. → etapa 6 + IDs

Detalle operativo: [etapa7-whatsapp-encuestas.md](etapa7-whatsapp-encuestas.md).

### Criterio de salida

Los sistemas externos siguen funcionando y las relaciones internas usan IDs. **Cumplido en código** (deploy migrate 007–008 + backfill encuestas/estado en staging).

## Etapa 8 — Configuración y administración

**Status:** implementada en código (`feature/datos-relacionales`). Doc: [etapa8-config-gastos.md](etapa8-config-gastos.md). Ops: migrate `009`–`012` + backfill `profesionales_contactos,configuraciones,gastos`. Errores JSON sigue diferido.

Post-MVP. Migrar en este orden:

1. profesionales y teléfonos;
2. horarios;
3. honorarios;
4. mensajes de Clara;
5. gastos;
6. encuestas (si no se hizo en etapa 7);
7. errores — **opcional / diferible**; puede quedarse en JSON.

Secrets y tokens no deben vivir en tablas exportables por roles no admin; si settings migra a DB, acotar columnas sensibles y backups.

### Verificar

- Dos usuarios no se pisan.
- Existe historial de cambios.
- Hay una fuente única de lectura.
- Los JSON pueden regenerarse como exportación.
- El sistema no depende del seed JSON para nuevas escrituras.

### Criterio de salida

Las nuevas escrituras van a MariaDB; los JSON quedan como fallback, backup o exportación.

## Etapa 9 — Integridad referencial obligatoria

**Status:** implementada en código (`feature/datos-relacionales`). Doc: [etapa9-integridad-referencial.md](etapa9-integridad-referencial.md). Ops: migrate `013` tras backup/audit; luego `REL_ENFORCE_FK=true` en staging. NOT NULL masivo queda opcional (`014` futuro).

### Precondiciones

- Umbrales de cierre cumplidos (ver abajo).
- Cero huérfanos clínicos no exceptuados.
- Cero duplicados no resueltos en claves únicas previstas.
- Cero profesionales inexistentes referenciados.
- Excepciones documentadas.
- Backup reciente y restaurable; restore practicado.

### Restricciones

- FOREIGN KEY en todas las relaciones.
- ON DELETE RESTRICT para datos clínicos.
- Borrado lógico para pacientes y profesionales.
- UNIQUE para event_key y calendar_event_id; contactos según reglas de compartidos (no UNIQUE global de teléfono).
- CHECK o catálogos para estados.
- NOT NULL solo después de completar la migración.
- `REL_ENFORCE_FK=true` solo aquí.

### Verificar

- No se puede referenciar un paciente inexistente.
- No se puede asignar un profesional inexistente.
- No se puede borrar un paciente con historia clínica.
- La API responde los errores de integridad de forma controlada.
- Backup y restauración incluyen restricciones.

### Rollback

Retirar la obligatoriedad de las columnas nuevas mediante migración controlada (`REL_ENFORCE_FK=false`), sin eliminar datos relacionados.

## Etapa 10 — Retirada de compatibilidad antigua

**Status:** implementada en código (`feature/datos-relacionales`). Doc: [etapa10-retiro-compatibilidad.md](etapa10-retiro-compatibilidad.md).  
**Auditoría cutover:** [instructivo-antigravity-auditoria-cutover.md](instructivo-antigravity-auditoria-cutover.md).

Hecho **sin pérdida de data ni corte de features**:

- resolve prioriza `paciente_id` explícito (fallback tel/nombre si no hay ID);
- mig `014` marcador + índice soft-delete; **`ensure_*` siguen activos**;
- soft-delete pacientes/profesionales (filas conservadas);
- archive JSON (`data/archive/` + export CLI);
- búsqueda UX por teléfono/nombre **sigue**;
- sin DROP de columnas legacy.

Pendiente post-auditoría (015+ solo con Go explícito): DROP columnas / NOT NULL.

### Criterio de salida

Ningún endpoint productivo depende de campos duplicados para identificar pacientes o profesionales. **Cumplido a nivel de join/identidad en código;** DROPs físicos = fase posterior.

## Umbrales de salida

Medir diariamente (admin o script de métricas). Antes de avanzar de fase:

| Puerta | Condición |
|--------|-----------|
| Fin etapa 3 (escritura estable) | ≥ 95 % de writes nuevos con ID cuando el match es inequívoco; fallback documentado. |
| Fin MVP (etapa 5) | Fichas clínicas válidas con `paciente_id` y `profesional_id`: **100 %** o excepciones listadas; lecturas con fallback legacy **&lt; 5 %**. |
| Antes de etapa 9 | Fallback de lectura legacy **&lt; 2 %**; **0** huérfanos clínicos no exceptuados; **0** profesionales inválidos referenciados. |
| Etapa 9 | `REL_ENFORCE_FK` solo con backup + restore OK y pruebas de concurrencia en verde. |

## Matriz de pruebas

### Datos

- alta y actualización de paciente;
- varios teléfonos;
- teléfono compartido entre dos pacientes (sin fusión automática);
- mismo nombre para dos pacientes;
- DNI y email duplicados;
- fusión controlada;
- borrado lógico;
- intento de borrar paciente con ficha.

### Relaciones

- ficha sin paciente;
- profesional desactivado;
- lista de espera;
- turno;
- recordatorio y turno;
- conversación;
- encuesta.

### Concurrencia

- dos altas con el mismo teléfono;
- dos usuarios editando paciente;
- dos usuarios editando configuración;
- dos sincronizaciones del mismo evento;
- dos recordatorios para el mismo turno;
- actualización con versión obsoleta.

### Autorización

- colaborador no accede ni muta `paciente_id` fuera de política;
- request con `paciente_id` ajeno → 403;
- flags `REL_*` no escalan privilegios.

### Regresión

- login y roles;
- pacientes;
- fichas;
- comparativas;
- impresión;
- horarios;
- turnos;
- WhatsApp;
- recordatorios;
- emails;
- backup y restauración.

## Checklist de cada migración

Antes:

- [ ] Tiene número y nombre.
- [ ] Está probada en base vacía.
- [ ] Está probada en copia de producción.
- [ ] Hay backup confirmado.
- [ ] Tiene rollback definido (migración inversa y/o flag).
- [ ] No borra datos.
- [ ] Es idempotente.
- [ ] Tiene métricas de verificación.
- [ ] Tiene criterio de salida / umbral.
- [ ] Tiene ventana de observación.
- [ ] Si toca IDs en API: checklist de authz revisado.
- [ ] Si es ALTER grande: ventana Hostinger acordada.

Después:

- [ ] La aplicación inicia.
- [ ] Los endpoints principales responden.
- [ ] No aumentan errores PHP.
- [ ] No aparecen huérfanos.
- [ ] Los conteos coinciden.
- [ ] Las nuevas escrituras usan IDs (si `REL_WRITE_IDS`).
- [ ] Se genera backup posterior.
- [ ] Se registra el resultado.

## Métricas de control

Medir en cada etapa:

- pacientes totales y duplicados;
- pacientes sin identificador;
- fichas totales y fichas sin IDs;
- lista de espera sin paciente;
- WhatsApp sin paciente;
- recordatorios sin paciente o turno;
- errores de integridad;
- conflictos de versión;
- porcentaje de lecturas con fallback antiguo;
- pendientes de revisión por teléfono compartido.

El fallback debe tender a cero antes de activar restricciones obligatorias (umbrales arriba).

## Orden de ejecución

1. Línea base y backups.
2. Auditoría de datos.
3. Migraciones versionadas (+ flags `REL_*`).
4. Tablas nuevas en paralelo.
5. Relaciones nullable (`REL_WRITE_IDS`).
6. Pacientes y contactos.
7. Fichas clínicas — **fin MVP**.
8. Lista de espera y turnos.
9. WhatsApp, recordatorios y encuestas.
10. Configuración y administración (errores JSON diferible).
11. Claves foráneas obligatorias (`REL_ENFORCE_FK`).
12. Retirada de compatibilidad antigua.

## Condición de seguridad final

No activar claves foráneas obligatorias ni eliminar JSON vivos hasta tener auditoría completa, backup restaurable, migración probada en copia de producción, excepciones revisadas, umbrales cumplidos, pruebas funcionales/concurrencia/authz en verde, y rollback practicado (migración inversa o flags) en entorno de prueba.
