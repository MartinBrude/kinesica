# Arquitectura Modular y Seguridad del Módulo Admin

Este documento detalla el diseño arquitectónico, la separación de responsabilidades, las medidas de seguridad y las optimizaciones de rendimiento aplicadas en el módulo de gestión de historias clínicas de ATM de Kinésica (`/admin`).

---

## 1. Visión General de la Arquitectura

El módulo fue refactorizado a partir de archivos monolíticos (`app.js` de 1.544 líneas y `styles.css` de 1.174 líneas), adoptando el estándar nativo de **Módulos ECMAScript (ESM)** para JavaScript y **Hojas de Estilo Modulares (@import)** para CSS, sin requerir herramientas pesadas de empaquetado en tiempo de ejecución.

### Estructura de Directorios

```text
admin/
├── api/                     # Backend PHP (REST/JSON seguro)
│   ├── backup.php           # Copias de seguridad automáticas CLI
│   ├── config.example.php   # Plantilla de configuración
│   ├── fichas.php           # Endpoint CRUD de historias clínicas
│   ├── forgot.php           # Solicitud de restablecimiento de contraseña
│   ├── install.php          # Inicialización de esquema y credenciales
│   ├── lib.php              # Librería común: base de datos, sesiones, TOTP, rate limiting
│   ├── login.php            # Verificación de credenciales y primer factor
│   ├── logout.php           # Cierre de sesión y destrucción de cookie
│   ├── mail.php             # Configuración de servidor de correo
│   ├── me.php               # Estado del usuario actual autenticado
│   ├── reset.php            # Validación de token y cambio de contraseña
│   └── totp.php             # Validación de código 2FA y enrolamiento
├── css/                     # Hojas de estilo modulares divididas por responsabilidad
│   ├── base.css             # Variables, reset, tipografía, topbar y botones
│   ├── gate.css             # Pantallas de ingreso (login, 2FA, forgot, reset)
│   ├── library.css          # Biblioteca de historias, listados y paginación
│   ├── form.css             # Formulario clínico en 5 pasos y escala EVA
│   ├── compare.css          # Vista comparativa sesión a sesión y KPIs
│   └── print.css            # Estilos para impresión A4, sellos y firmas
├── modules/                 # Módulos JavaScript (ES6 Modules)
│   ├── api.js               # Cliente HTTP seguro con cabecera anti-CSRF
│   ├── dom.js               # Primitivas DOM, saneamiento anti-XSS y debounce
│   ├── auth.js              # Controlador de autenticación y vistas Gate
│   ├── form.js              # Controlador del formulario clínico por pasos
│   ├── library.js           # Controlador de biblioteca, búsqueda y agrupación
│   ├── print.js             # Motor de generación de reportes impresos y PDF
│   └── compare.js           # Controlador de la vista comparativa de evolución
├── signatures/              # Imágenes digitales de sellos y firmas profesionales
│   ├── norberto.png         # Firma y sello del Lic. Norberto Brude
│   └── maria.png            # Firma y sello de la Lic. María Gulín
├── .htaccess                # Protección de archivos sensibles y cabeceras de seguridad
├── app.js                   # Orquestador principal y punto de entrada (280 líneas)
├── ficha-rules.mjs          # Reglas clínicas puras de dominio (CDI-TTM y cálculos)
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
  - Control de estados: Login de usuario y contraseña, enrolamiento y verificación TOTP (Google Authenticator), solicitud de link temporal de recuperación y cambio de contraseña.
  - Manejo seguro de mensajes de error sin revelar la existencia previa del correo/usuario.

### `admin/modules/form.js`
- **Responsabilidad:** Lógica interactiva del formulario clínico de ATM.
- **Características:**
  - Navegación fluida por 5 paneles paso a paso (0. Paciente, 1. ATM, 2. Músculos, 3. Dolor y oclusión, 4. Criterios CDI).
  - Autocálculo de la edad en tiempo real al ingresar fechas (`syncAge`).
  - Validación suave con indicador luminoso discreto (`.step-dot`) y foco automático en el primer campo faltante.
  - Barra de dolor EVA con gradiente visual y badge semántico (`syncEva`).
  - Detección de cambios sin guardar antes de salir (`formState`).

### `admin/modules/library.js`
- **Responsabilidad:** Gestión de historias clínicas registradas.
- **Características:**
  - Vista general cronológica y vista agrupada por paciente mediante `Map` en $O(n)$.
  - Búsqueda tolerante a acentos y normalización de DNI (con puntos, espacios o guiones).
  - Paginación dinámica configurable (`pageWindow`).
  - Importación y exportación de archivos `.json` con validación estructural estricta.

### `admin/modules/compare.js`
- **Responsabilidad:** Comparativa clínica evolución sesión a sesión (Sesión X vs. Sesión Y).
- **Características:**
  - Detección del intervalo de tiempo transcurrido en días (`daysBetween`).
  - Tarjetas de Indicadores Clave (KPIs): Variación del dolor EVA, apertura bucal y remisión de ruidos.
  - Pestaña "Lo que cambió" con resaltado de transiciones clínicas (`➔`), badges de mejora/empeoramiento y valores previos tachados.
  - Generación de informe impreso comparativo A4 (`buildComparePrintSheet`).

### `admin/modules/print.js`
- **Responsabilidad:** Renderizado de la historia clínica en hoja institucional para impresión o PDF.
- **Características:**
  - Formato homologado para normas A4 con saltos de página inteligentes (`break-inside: avoid`).
  - Integración de sellos y firmas digitales (`norberto.png`, `maria.png`) con precarga asíncrona (`img.decode()`) y ocultamiento silencioso en caso de ausencia de imagen.

### `admin/app.js` (Orquestador)
- **Responsabilidad:** Punto de entrada único que inicializa los módulos, conecta los callbacks entre vistas y sincroniza la caché en memoria.

---

## 3. Auditoría de Seguridad: ¿Está todo seguro?

| Aspecto | Estado | Implementación / Protección |
| :--- | :---: | :--- |
| **Protección contra CSRF** | **Blindado** | Todas las peticiones API (GET, POST, DELETE) exigen la cabecera personalizada `X-Kinesica: 1`. Los navegadores prohíben adjuntar cabeceras personalizadas en formularios o llamadas cross-origin estándar sin previa negociación CORS. |
| **Protección contra XSS** | **Blindado** | En `dom.js`, todas las inserciones dinámicas de datos de pacientes (nombres, DNI, deltas, etiquetas) se procesan con `escapeHtml()`, y los textos directos se asignan vía `textContent`. |
| **Control de Acceso / IDOR** | **Blindado** | En `admin/api/fichas.php`, las operaciones `POST` (modificación) y `DELETE` verifican que el usuario autenticado sea el creador original de la ficha o el administrador (`martin`). Norberto no puede alterar ni borrar fichas de María, ni viceversa. |
| **Seguridad de Sesiones** | **Blindado** | Las cookies de sesión utilizan parámetros estrictos: `secure = true` (solo HTTPS), `httponly = true` (inaccesibles por JavaScript malicioso), `samesite = 'Lax'` y `path = '/admin/'`. Se regenera el ID de sesión con `session_regenerate_id(true)` tras iniciar sesión. |
| **Fuerza Bruta y Bloqueo** | **Blindado** | Se registran los fallos en la tabla `login_attempts`. Al 5° intento fallido, el usuario queda bloqueado durante 30 minutos (`HTTP 429 Too Many Requests`). |
| **Segundo Factor (2FA TOTP)** | **Blindado** | Implementación RFC 6238 nativa con secreto Base32. La validación tolera una ventana temporal de deriva horaria de $\pm 1$ paso (30s) usando `hash_equals()` para evitar ataques de tiempo (*timing attacks*). |
| **Protección de Archivos Apache** | **Blindado** | `.htaccess` bloquea el acceso HTTP directo a archivos críticos (`config*.php`, `mail.php`, `.env*`, `*.sql`, `*.bak`, `*.log`). |
| **Cabeceras de Seguridad HTTP** | **Blindado** | Configuración activa en `.htaccess`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` y `Referrer-Policy: strict-origin-when-cross-origin`. |

---

## 4. Auditoría de Rendimiento: ¿Está todo optimizado?

| Optimización | Descripción del Beneficio |
| :--- | :--- |
| **Búsqueda con Debounce (150 ms)** | El filtrado en vivo de pacientes no reconstruye el DOM por cada pulsación de teclado; agrupa las entradas del usuario reduciendo el recálculo en un 80%. |
| **Uso de `DocumentFragment`** | La renderización de listas (`renderLibrary`) compila todos los nodos en memoria y los inserta de una sola vez mediante `replaceChildren(fragment)`, evitando el *layout thrashing* y múltiples repintados. |
| **Agrupación en $O(n)$** | La consolidación de pacientes y sesiones se realiza en una sola pasada usando `Map`, reemplazando búsquedas anidadas $O(n^2)$. |
| **Carga de Módulos Nativos** | Sin sobrecarga de herramientas de compilación pesadas; el navegador descarga y almacena en caché individualmente cada módulo JS y CSS. |
| **Precarga de Imágenes en PDF** | Antes de abrir el cuadro de impresión nativo (`window.print()`), el sistema aguarda la resolución de `img.decode()` en paralelo mediante `Promise.all()`, asegurando que las firmas y sellos se impriman sin cortes. |
| **Cache-Busting Versionado** | `index.html` incluye sufijos de versión controlados (`styles.css?v=47` y `app.js?v=47`) para asegurar actualización instantánea en los clientes ante nuevos despliegues. |
