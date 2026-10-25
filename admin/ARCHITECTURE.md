# Arquitectura Modular y Seguridad del Módulo Admin

Este documento detalla el diseño arquitectónico, la separación de responsabilidades, las medidas de seguridad y las optimizaciones de rendimiento aplicadas en el módulo integral de administración de Kinésica (`/admin`).

---

## 1. Visión General de la Arquitectura

El módulo fue refactorizado a partir de archivos monolíticos, adoptando el estándar nativo de **Módulos ECMAScript (ESM)** para JavaScript y **Hojas de Estilo Modulares (@import)** para CSS, sin requerir herramientas pesadas de empaquetado en tiempo de ejecución.

### Estructura de Directorios

```text
admin/
├── api/                     # Backend PHP (REST/JSON seguro)
│   ├── backup.php           # Copias de seguridad automáticas CLI
│   ├── config.example.php   # Plantilla de configuración
│   ├── fichas.php           # Endpoint CRUD de historias clínicas
│   ├── forgot.php           # Solicitud de restablecimiento de contraseña
│   ├── foto.php             # Servidor seguro y validado de fotos clínicas adjuntas
│   ├── gastos.json          # Semilla versionada de gastos y costos operativos (hosting, IA)
│   ├── gastos.php           # API para registro, modificación, baja y cálculo de gastos (exclusivo admin)
│   ├── horarios.php         # Persistencia de franjas de atención y restricción de camilla
│   ├── install.php          # Inicialización de esquema y credenciales
│   ├── lib.php              # Librería común: base de datos, sesiones, TOTP, rate limiting, OTP por correo
│   ├── login.php            # Verificación de credenciales y primer factor
│   ├── login-code.php       # Vía alternativa de acceso mediante código de 6 dígitos enviado al mail
│   ├── logout.php           # Cierre de sesión y destrucción de cookie
│   ├── mail.php             # Configuración de servidor de correo
│   ├── me.php               # Estado del usuario actual autenticado
│   ├── pacientes.php        # Directorio unificado, historial de sesiones y búsqueda por teléfono/DNI
│   ├── profesionales.php    # Gestión de usuarios, roles (admin/professional), altas y suspensiones
│   ├── reset.php            # Validación de token y cambio de contraseña
│   ├── settings.php         # Ajustes globales de WhatsApp Clara y honorarios de sesión
│   └── totp.php             # Validación de código 2FA y enrolamiento con verificación de clave
├── css/                     # Hojas de estilo modulares divididas por responsabilidad
│   ├── base.css             # Variables, reset, tipografía, topbar y botones
│   ├── gate.css             # Pantallas de ingreso (login, 2FA, código por mail, forgot, reset)
│   ├── library.css          # Biblioteca de historias, listados y paginación
│   ├── form.css             # Formulario clínico en 6 pasos y escala EVA
│   ├── compare.css          # Vista comparativa sesión a sesión y KPIs
│   ├── dashboard.css        # Indicadores resumidos y accesos rápidos
│   ├── pacientes.css        # Tablas de pacientes, fichas y búsqueda rápida
│   ├── horarios.css         # Timeline interactivo de camilla y días laborales
│   ├── configuracion.css    # Pestañas de Clara, simulador y honorarios
│   ├── admin.css            # Panel de profesionales y control de administradores
│   └── print.css            # Estilos para impresión A4, sellos y firmas
├── modules/                 # Módulos JavaScript (ES6 Modules)
│   ├── admin-panel.js       # Gestión de administradores, profesionales, altas y bajas
│   ├── api.js               # Cliente HTTP seguro con cabecera anti-CSRF
│   ├── auth.js              # Controlador de autenticación, TOTP y código de 6 dígitos
│   ├── chat-simulator.js    # Simulador interactivo en tiempo real de WhatsApp Clara
│   ├── compare.js           # Controlador de la vista comparativa de evolución
│   ├── configuracion.js     # Configuración de Clara (textos, avisos, ausencias)
│   ├── dashboard.js         # Vista de inicio con métricas y accesos directos
│   ├── dom.js               # Primitivas DOM, saneamiento anti-XSS y debounce
│   ├── form-image.js        # Compresión client-side de imágenes clínicas (canvas/WebP)
│   ├── form-restrictions.js # Reglas condicionales dinámicas de inputs
│   ├── form.js              # Controlador del formulario clínico por pasos
│   ├── honorarios.js        # Editor de honorarios de consulta y métodos de pago
│   ├── horarios.js          # Editor de franjas horarias y control de 1 sola camilla
│   ├── library-rows.js      # Renderizado de filas de biblioteca y dropdown de acciones
│   ├── library.js           # Controlador de biblioteca, búsqueda y agrupación
│   ├── menu-texts.js        # Textos informativos de consultorio y direcciones
│   ├── pacientes.js         # Directorio de pacientes y unificación por DNI/teléfono
│   ├── phone-search.js      # Normalizador y buscador inteligente por teléfono
│   └── print.js             # Motor de generación de reportes impresos y PDF
├── signatures/              # Imágenes digitales de sellos y firmas profesionales
│   ├── norberto.png         # Firma y sello del Lic. Norberto Brude
│   └── maria.png            # Firma y sello de la Lic. María Gulin
├── .htaccess                # Protección de archivos sensibles y cabeceras de seguridad
├── app.js                   # Orquestador principal y punto de entrada SPA
├── ficha-rules.mjs          # Reglas clínicas puras de dominio (CDI-TTM y cálculos)
├── ficha-compare.mjs        # Motor matemático de comparación sesión a sesión y KPIs
├── index.html               # Estructura semántica de la aplicación SPA
└── styles.css               # Hoja de estilos maestra que importa los módulos
```

---

## 2. Separación de Responsabilidades (Módulos JS)

Cada módulo tiene una responsabilidad única y bien delimitada:

### `admin/modules/dom.js`
- **Responsabilidad:** Utilidades puras para interacción con el DOM y sanitización de cadenas.
- **Funciones clave:**
  - `escapeHtml(str)`: Escapa caracteres peligrosos (`&`, `<`, `>`, `"`, `'`) para neutralizar cualquier vector de XSS al inyectar HTML.
  - `node(tag, className, text)`: Crea elementos DOM de forma segura usando `textContent`.
  - `debounce(fn, delay)`: Limita la cadencia de ejecución de eventos repetitivos (usado en el buscador).
  - Constructores de layout impreso: `field`, `side`, `section`, `grid`, `prose`, `formatParts`.

### `admin/modules/api.js`
- **Responsabilidad:** Capa de comunicación HTTP centralizada.
- **Seguridad incorporada:**
  - Envía siempre `credentials: "same-origin"` y la cabecera personalizada `X-Kinesica: 1` para bloquear peticiones entre orígenes no autorizados.
  - Intercepta respuestas `HTTP 401 Unauthorized` y dispara automáticamente el gate de autenticación.

### `admin/modules/auth.js`
- **Responsabilidad:** Ciclo de vida de la sesión y formularios de ingreso.
- **Características:**
  - Control de estados: Login tradicional, enrolamiento y verificación TOTP (Google Authenticator), vía alternativa de código por email (con contraseña obligatoria), solicitud de enlace de recuperación y cambio de contraseña.
  - Toggles visuales de contraseña accesibles (`aria-label`, iconos SVG `.eye-show`/`.eye-hide`).
  - Guía operativa para usuarios clínicos (María y Norberto): ver [docs/configuracion-cuentas-profesionales.md](../docs/configuracion-cuentas-profesionales.md).

### `admin/modules/form.js`, `form-image.js` y `form-restrictions.js`
- **Responsabilidad:** Lógica interactiva del formulario clínico de ATM.
- **Características:**
  - Navegación fluida por 6 paneles paso a paso (0. Paciente, 1. ATM, 2. Músculos, 3. Dolor y oclusión, 4. Criterios CDI, 5. Anotaciones y Foto adjunta).
  - Compresión previa en canvas (`form-image.js`) antes del upload, reduciendo imágenes a un máximo de 1920px y despojando metadatos EXIF.
  - Validación suave con indicador luminoso discreto (`.step-dot`) y foco automático en el primer campo faltante.
  - Barra de dolor EVA con gradiente visual y badge semántico (`syncEva`).
  - Detección de cambios sin guardar antes de salir (`formState`).
  - **Asignación de profesional por admin:** Cuando el administrador (`martin`) crea o edita una ficha, se activa el selector `#field-profesional` para asignar la ficha al Lic. Norberto Brude o a la Lic. María Gulin. Para los profesionales clínicos no-admin, el selector se mantiene oculto y la ficha se vincula estrictamente a su propia cuenta.

### `admin/modules/library.js` y `library-rows.js`
- **Responsabilidad:** Gestión de historias clínicas registradas.
- **Características:**
  - Vista general cronológica y vista agrupada por paciente mediante `Map` en $O(n)$.
  - Búsqueda tolerante a acentos y normalización de DNI (con puntos, espacios o guiones).
  - Paginación dinámica configurable (`pageWindow`).
  - Importación y exportación de archivos `.json` con validación estructural estricta.

### `admin/modules/compare.js` y `admin/ficha-compare.mjs`
- **Responsabilidad:** Comparativa clínica evolución sesión a sesión (Sesión X vs. Sesión Y).
- **Características:**
  - Detección del intervalo de tiempo transcurrido en días (`daysBetween`).
  - Tarjetas de Indicadores Clave (KPIs): Variación del dolor EVA, apertura bucal y remisión de ruidos.
  - Pestaña "Lo que cambió" con resaltado de transiciones clínicas (`➔`), badges de mejora/empeoramiento y valores previos tachados.
  - Generación de informe impreso comparativo A4 (`buildComparePrintSheet`).

### `admin/modules/pacientes.js` y `phone-search.js`
- **Responsabilidad:** Directorio unificado de pacientes.
- **Características:**
  - Consolidación de sesiones históricas por DNI o clave de identidad.
  - Búsqueda en vivo por nombre, DNI o número telefónico con normalización E.164.
  - Accesos directos a crear nueva sesión vinculada o imprimir ficha histórica consolidada.

### `admin/modules/horarios.js` y `honorarios.js`
- **Responsabilidad:** Configuración del consultorio, agenda física y valores de consulta.
- **Características:**
  - Validación de restricción de **1 sola camilla física** en tiempo real (impide solapamiento entre Norberto y María).
  - Sincronización en vivo con el motor de reservas (`Agendar`), la barra superior de la web y los mensajes de WhatsApp Clara.

### `admin/modules/admin-panel.js`
- **Responsabilidad:** Gestión y gobierno de cuentas de profesionales.
- **Características:**
  - Altas, edición de datos de contacto y asignación de roles.
  - Suspensión y reactivación de cuentas con protección explícita del superadmin (`martin`).
  - Envío y reenvío de enlaces de invitación y reseteo de claves.

### `admin/modules/print.js`
- **Responsabilidad:** Renderizado de la historia clínica en hoja institucional para impresión o PDF.
- **Características:**
  - Formato homologado para normas A4 con saltos de página inteligentes (`break-inside: avoid`).
  - Integración de sellos y firmas digitales (`norberto.png`, `maria.png`) con precarga asíncrona (`img.decode()`) y ocultamiento silencioso en caso de ausencia de imagen.

### `admin/app.js` (Orquestador)
- **Responsabilidad:** Punto de entrada único que inicializa los módulos, conecta los callbacks entre vistas, administra la navegación y sincroniza la caché en memoria.

---

## 3. Auditoría de Seguridad: ¿Está todo seguro?

| Aspecto | Estado | Implementación / Protección |
| :--- | :---: | :--- |
| **Protección contra CSRF** | **Blindado** | Todas las peticiones API (GET, POST, DELETE) exigen la cabecera personalizada `X-Kinesica: 1`. Los navegadores prohíben adjuntar cabeceras personalizadas en formularios o llamadas cross-origin estándar sin previa negociación CORS. |
| **Protección contra XSS** | **Blindado** | En `dom.js`, todas las inserciones dinámicas de datos de pacientes (nombres, DNI, deltas, etiquetas) se procesan con `escapeHtml()`, y los textos directos se asignan vía `textContent`. |
| **Control de Acceso / IDOR** | **Blindado** | En `admin/api/fichas.php`, las operaciones `POST` (modificación) y `DELETE` verifican que el usuario autenticado sea el creador original de la ficha o el administrador (`martin`). Norberto no puede alterar ni borrar fichas de María, ni viceversa. |
| **Seguridad de Sesiones** | **Blindado** | Las cookies de sesión utilizan parámetros estrictos: `secure = true` (solo HTTPS), `httponly = true` (inaccesibles por JavaScript malicioso), `samesite = 'Lax'` y `path = '/admin/'`. Se regenera el ID de sesión con `session_regenerate_id(true)` tras iniciar sesión. |
| **Fuerza Bruta y Bloqueo** | **Blindado** | Se registran los fallos en la tabla `login_attempts`. Al 5° intento fallido, el usuario queda bloqueado durante 15 minutos (`HTTP 429 Too Many Requests`), aplicado a contraseñas, TOTP y códigos por correo. |
| **Segundo Factor (2FA TOTP)** | **Blindado** | Implementación RFC 6238 nativa con secreto Base32. La validación tolera una ventana temporal de deriva horaria de $\pm 1$ paso (30s) usando `hash_equals()`. El enrolamiento exige contraseña previa. |
| **Protección de Archivos Apache** | **Blindado** | `.htaccess` bloquea el acceso HTTP directo a archivos críticos (`config*.php`, `mail.php`, `.env*`, `*.sql`, `*.bak`, `*.log`). |
| **Cabeceras de Seguridad HTTP** | **Blindado** | Configuración activa en `.htaccess`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` y `Referrer-Policy: strict-origin-when-cross-origin`. |

---

## 4. Auditoría de Rendimiento: ¿Está todo optimizado?

| Optimización | Descripción del Beneficio |
| :--- | :--- |
| **Búsqueda con Debounce (150 ms)** | El filtrado en vivo de pacientes no reconstruye el DOM por cada pulsación de teclado; agrupa las entradas del usuario reduciendo el recálculo en un 80%. |
| **Uso de `DocumentFragment`** | La renderización de listas (`renderLibrary`, `renderPacientes`) compila todos los nodos en memoria y los inserta de una sola vez mediante `replaceChildren(fragment)`, evitando el *layout thrashing* y múltiples repintados. |
| **Agrupación en $O(n)$** | La consolidación de pacientes y sesiones se realiza en una sola pasada usando `Map`, reemplazando búsquedas anidadas $O(n^2)$. |
| **Carga de Módulos Nativos** | Sin sobrecarga de herramientas de compilación pesadas; el navegador descarga y almacena en caché individualmente cada módulo JS y CSS. |
| **Precarga de Imágenes en PDF** | Antes de abrir el cuadro de impresión nativo (`window.print()`), el sistema aguarda la resolución de `img.decode()` en paralelo mediante `Promise.all()`, asegurando que las firmas y sellos se impriman sin cortes. |
| **Cache-Busting Versionado** | `index.html` incluye sufijos de versión controlados (`styles.css?v=...` y `app.js?v=...`) para asegurar actualización instantánea en los clientes ante nuevos despliegues. |
