# Documentación de Funcionalidades - Módulo de Fichas ATM

Este documento describe las funcionalidades incorporadas al módulo de administración de historias clínicas de ATM de Kinésica (`/admin`), la ubicación en código de cada una y las etiquetas para activar o retirar las características opcionales de forma ágil.

---

## 1. Características Opcionales (Etiquetadas para retiro o activación rápida)

Cada una de estas 4 características clínicas cuenta con comentarios delimitadores uniformes:
- En HTML (`admin/index.html`): `<!-- FEATURE-OPTIONAL: <nombre> --> ... <!-- /FEATURE-OPTIONAL: <nombre> -->`
- En JavaScript (`admin/ficha-rules.mjs` y `admin/app.js`): `// FEATURE-OPTIONAL: <nombre> ... // /FEATURE-OPTIONAL: <nombre>`

### A. Tipo de Ruido Articular (Clic vs. Crepitación)
- **Etiqueta:** `FEATURE-OPTIONAL: tipo-ruido`
- **Justificación clínica:** Permite distinguir entre *clic/chasquido* (típico de desplazamiento discal, Grupo II CDI-TTM) y *crepitación/roce* (artrosis/degenerativo, Grupo III CDI-TTM).
- **Campos en el modelo:**
  - `ruidoClic` (booleano): Clic / Chasquido.
  - `ruidoCrep` (booleano): Crepitación.
- **Ubicación:**
  - `admin/index.html`: dentro del bloque de seguimiento de ruidos (`data-follow="ruidos"`).
  - `admin/ficha-rules.mjs`: valores por defecto y en `exampleFicha()`.
  - `admin/app.js`: incluido en la síntesis de impresión del PDF.

### B. Patrón de Desviación Mandibular (Desviación corregida vs. Deflexión)
- **Etiqueta:** `FEATURE-OPTIONAL: patron-desviacion`
- **Justificación clínica:** Diferencia la *desviación corregida en S* (vuelve a la línea media en apertura máxima; sugiere recaptura discal) de la *deflexión no corregida* (termina desviada hacia el lado afectado; sugiere luxación sin reducción o hipomovilidad).
- **Campos en el modelo:**
  - `desvCorregida` (booleano): Desviación corregida (en S).
  - `deflexion` (booleano): Deflexión (no corregida).
- **Ubicación:**
  - `admin/index.html`: dentro de `data-follow="desviacion"`.
  - `admin/ficha-rules.mjs`: valores en `emptyFicha()` y `exampleFicha()`.
  - `admin/app.js`: incluido en el informe del PDF.

### C. Hábitos Parafuncionales y Bruxismo
- **Etiqueta:** `FEATURE-OPTIONAL: habitos-bruxismo`
- **Justificación clínica:** Facilita el relevamiento rápido de hábitos causales frecuentes antes de la redacción libre de antecedentes.
- **Campos en el modelo:**
  - `habitoApretamiento` (booleano): Apretamiento diurno.
  - `habitoBruxismo` (booleano): Bruxismo nocturno.
  - `habitoMasticacionUni` (booleano): Masticación unilateral.
  - `habitoOnicofagia` (booleano): Onicofagia / mordisqueo.
- **Ubicación:**
  - `admin/index.html`: Panel 0 (Información primaria), antes de antecedentes clínicos.
  - `admin/styles.css`: `.habit-grid` y `.habitos-block`.
  - `admin/ficha-rules.mjs` y `admin/app.js`: modelo e impresión PDF en la sección de antecedentes.

### D. Correlación Cervical y Postural (Osteopatía / RPG)
- **Etiqueta:** `FEATURE-OPTIONAL: correlacion-cervical`
- **Justificación clínica:** Alineado con la especialidad del centro (osteopatía y reeducación postural), registra la implicación de la cadena cervicocraneal en los desórdenes temporomandibulares.
- **Campos en el modelo:**
  - `trapecioIzq` / `trapecioDer` (booleanos): Trapecio superior.
  - `ecomIzq` / `ecomDer` (booleanos): Esternocleidomastoideo.
  - `suboccipitalIzq` / `suboccipitalDer` (booleanos): Musculatura suboccipital.
  - `obsCervical` (texto): Observaciones posturales o cervicales adicionales.
- **Ubicación:**
  - `admin/index.html`: Panel 2 (Músculos craneales).
  - `admin/ficha-rules.mjs` y `admin/app.js`: modelo y sección propia en el PDF impreso.

---

## 2. Mejoras de Usabilidad y Funcionalidades Integradas

### A. Cálculo Automático de la Edad
- **Comportamiento:** Al seleccionar la fecha de nacimiento (`nacimiento`) o la fecha de la sesión (`fechaSesion`), el sistema invoca en tiempo real `ageOn(nacimiento, fechaSesion)` y autocompleta el campo `edad`.
- **Flexibilidad:** Permite corrección manual si el usuario lo requiere.
- **Ubicación:** función `syncAge()` en `admin/app.js`.

### B. Validación Suave entre Pasos y Marcador Visual
- **Comportamiento:**
  - El botón del paso 1 (**1. Paciente**) muestra un indicador discreto (`.step-dot`) en rojo suave mientras existan campos obligatorios pendientes. Al completarse, el punto se apaga automáticamente.
  - Al presionar **Siguiente →** desde el Paso 1, si faltan datos obligatorios, los campos faltantes se resaltan con borde suave (`.input-error`) y el cursor se enfoca en el primer campo requerido, en lugar de permitir avanzar a ciegas o bloquear con alertas invasivas.
- **Ubicación:** `updateStepValidation()` y listeners de `btn-next` y formulario en `admin/app.js`.

### C. Escala EVA con Gradiente Visual
- **Comportamiento:**
  - El control deslizante tiene una barra continua con gradiente de color: verde (0-3), amarillo/naranja (4-6) y rojo/bordó (7-10).
  - La etiqueta superior (`#eva-value`) actualiza en tiempo real su badge semántico con el nivel de dolor (`0 / 10 · Sin dolor`, `1-3 / 10 · Dolor leve`, `4-6 / 10 · Dolor moderado`, `7-10 / 10 · Dolor severo`).
- **Ubicación:** `syncEva()` y `evaMeta()` en `admin/app.js`, y reglas `.eva-badge` en `admin/styles.css`.

### D. Firma Digital y Matrícula Profesional en el PDF
- **Comportamiento:**
  - En la parte inferior de la ficha impresa/PDF, se incorpora el bloque institucional de firma digital del profesional actuante (`pf-signature`), con línea de firma, nombre completo, especialidad y matrícula (M.N. / M.P.).
  - Configuración centralizada en `CLINICIAN_DETAILS` dentro de `admin/ficha-rules.mjs`.
  - La imagen se busca en la carpeta `/admin/signatures/` (`norberto.png` y `maria.png`).
  - **Manejo de archivos:** Si la imagen aún no fue depositada en la carpeta, la interfaz oculta la imagen vacía sin mostrar errores ni iconos rotos, manteniendo la línea de firma, aclaración y matrícula listas para impresión.
- **Ubicación:** `admin/signatures/` (con `README.md` explicativo), `admin/app.js` (en `buildSheet`) y `admin/styles.css` (en `@media print`).

---

## 3. Optimizaciones de Código, Tipado Estricto (DRY) y Seguridad

### A. Tipado Estricto y Coerción Centralizada (`coerceFicha`)
- **Problema previo:** Al leer del formulario o al importar archivos `.json`, los tipos de datos dependían de cómo venían en el archivo (podían contener strings en campos booleanos, valores de dolor EVA fuera de rango 0..10, o arrays malformados).
- **Solución:** Se implementó `coerceFicha(input)` en [`admin/ficha-rules.mjs`](file:///Users/martinbrude/Documents/kinesica/admin/ficha-rules.mjs). Coacciona de forma estricta:
  - Strings limpios con `trim()`.
  - Booleans forzados a booleanos nativos (`true`/`false`).
  - `eva` acotado de forma segura como entero entre `0` y `10`.
  - `cdi` filtrado para contener únicamente strings válidos.
  - Se aplica tanto en `readForm()` como en la importación de JSON en `#file-open` y en la persistencia del backend.

### B. Normalización de Clave de Paciente (`normalizeDni` y `patientKey`)
- **Problema previo:** Si una ficha tenía DNI `"34.205.109"` y otra `"34205109"`, se interpretaban como pacientes distintos en la agrupación y en el filtro de PDF.
- **Solución:** `patientKey(item)` centralizado en [`admin/ficha-rules.mjs`](file:///Users/martinbrude/Documents/kinesica/admin/ficha-rules.mjs) normaliza los dígitos del DNI y el nombre en minúsculas, unificando de forma confiable todas las sesiones del mismo paciente.

### C. Refactor DRY en Validación y Formateo de Texto
- **Validación DRY:** Función `highlightMissingFields(keys)` unificada entre la navegación paso a paso (`btn-next`), la validación del paso 0 y el submit del formulario.
- **Formateo DRY:** Helper `formatParts(parts, sep)` para simplificar la concatenación y filtrado de valores vacíos o nulos en el informe impreso.
- **Agrupación en $O(n)$:** `renderLibrary()` reemplazó bucles anidados `map`/`filter` por un único recorrido lineal con `Map`.

### D. Seguridad y Autorización en Backend (`admin/api/fichas.php`)
- **Control de acceso en `DELETE` y `UPDATE`:** Se verifica que el usuario autenticado sea el dueño de la ficha o el administrador (`martin`), mitigando posibles vulnerabilidades de manipulación cruzada de registros (IDOR).
- **Saneamiento en servidor:** Forzado en PHP para que `eva` sea entero 0..10 y `cdi` sea array estricto antes de guardarse en el payload JSON.
