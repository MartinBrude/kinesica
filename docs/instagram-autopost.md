# Automatización de Publicaciones en Instagram (@kinesicabrude)

Este módulo permite a **Norberto y Martín** gestionar de forma visual y 100% autónoma las publicaciones de Feed (4:5) e Historias (9:16) en la cuenta de Instagram `@kinesicabrude`, directamente desde el panel de administración (`/admin/creativos`).

---

## 1. ¿Cómo funciona para el usuario (Norberto y Admins)?

### 🧭 Ubicación en el Panel
- Se encuentra en el menú superior **Meta** (ícono de WhatsApp / Meta) bajo la opción **🎨 Creativos Instagram**.
- Es accesible tanto para administradores como para el usuario de Norberto (no requiere ser superadministrador).

### 🤍 Dar ❤️ Me gusta (Catálogo de 93 piezas)
- Cada una de las 93 piezas gráficas tiene un botón de corazón flotante `🤍` en la esquina superior derecha y un botón `🤍 Me gusta (programar)` en el pie de la tarjeta.
- **Interacción fluida**: Al hacer click en el corazón o en el botón, la tarjeta conmuta su estado inmediatamente en el lugar (`❤️ #N` o `🤍`) **sin abrir la previsualización modal**, para que la selección sea ágil y cómoda.
- La previsualización ampliada ("Ver en grande") se abre únicamente al hacer click en la miniatura de la imagen o en el botón **🔍 Ver en grande**.

### 📋 Pestaña "❤️ Lista para publicar"
- Muestra las publicaciones seleccionadas en el orden de salida programado.
- **Reordenar con Drag & Drop**: Podés arrastrar y soltar las tarjetas directamente con el mouse (usando el tirador `⋮⋮` o la tarjeta entera). El nuevo orden se persiste automáticamente en la base de datos de manera atómica.
- **Botones ⬆️ Subir / ⬇️ Bajar**: Alternativa accesible con un solo click para pantallas táctiles o móviles.
- **Cálculo de slots estimados**: Muestra la fecha y hora proyectada para cada pieza según la frecuencia de salida:
  - Posición #1: Próximo Lunes, Miércoles o Viernes a las 10:00 hs (hora de Argentina).
  - Posición #2: Siguiente fecha hábil de publicación a las 10:00 hs.
  - Posición #3: Siguiente fecha...
- **⚡ Publicar ya**: Botón para forzar la publicación inmediata de cualquier pieza sin esperar al cron semanal.
- **💔 Quitar**: Remueve la pieza de la cola y la devuelve al catálogo como disponible.

### 📸 Reporte y Marcado de Publicación
Al publicarse una pieza (sea por el cron o manualmente), el sistema registra el resultado exacto:
- **`✅ Feed + Story`**: Publicada con éxito en ambos canales.
- **`✅ Solo Post`**: Publicada únicamente en el Feed (4:5).
- **`✅ Solo Story`**: Publicada únicamente en Historia (9:16).
- **Historial de publicaciones**: En la parte inferior de la lista queda la lista de piezas publicadas con fecha, identificadores de medios de Instagram y botón **🔄 Re-encolar** por si se desea volver a programarla a futuro.

---

## 2. Publicación Desatendida y Renovación de Tokens

1. **Horario Oficial**: El cron se ejecuta periódicamente y publica **Lunes, Miércoles y Viernes a las 10:00 hs de Argentina** (`America/Argentina/Buenos_Aires`).
2. **Idempotencia**: Si el cron corre cada hora, `ig_published_on_date()` asegura que solo se publique una pieza por día hábil programado.
3. **Auto-renovación Perpetua de Token**:
   - Meta no entrega tokens infinitos (máximo 60 días).
   - En [`admin/api/lib_instagram.php`](../admin/api/lib_instagram.php), la rutina `ig_token_refresh_if_needed()` consulta automáticamente la API de Meta (`GET /refresh_access_token`) cuando al token le quedan menos de 20 días de vigencia.
   - El token se auto-renueva solo de forma perpetua mientras el servidor esté activo.

---

## 3. Arquitectura y Regla de Líneas (< 250 líneas)

Cada módulo del backend y frontend respeta rigurosamente el límite estricto de **menos de 250 líneas**:

| Archivo | Responsabilidad | Líneas |
|---|---|---|
| [`admin/api/lib_instagram_store.php`](../admin/api/lib_instagram_store.php) | Persistencia (SQLite/MySQL), anti path-traversal, reordenamiento atómico, conversión PNG→JPG (cache en `campanas/ig/`) | **222** |
| [`admin/api/lib_instagram.php`](../admin/api/lib_instagram.php) | Cliente HTTP Meta Graph API v21.0, creación de containers, polling, publicación y auto-refresh | **132** |
| [`admin/api/instagram_cola.php`](../admin/api/instagram_cola.php) | Endpoint REST autenticado (`GET` lista, `POST` add, remove, reorder, publish_now) | **56** |
| [`admin/api/cron_instagram.php`](../admin/api/cron_instagram.php) | Worker CLI, bloqueo de peticiones HTTP (404), horario de Argentina | **60** |
| [`admin/modules/admin-creativos-cola.js`](../admin/modules/admin-creativos-cola.js) | Store reactivo del cliente, botones ❤️, badges de canal y sincronización con API | **191** |
| [`admin/modules/admin-creativos-lista.js`](../admin/modules/admin-creativos-lista.js) | Renderizado de cola, Drag & Drop nativo, slots estimados y sección de historial | **220** |

---

## 4. Guía de Puesta en Marcha (Credenciales y Servidor)

La app en Meta for Developers ya fue creada: **`Kinésica Autopost`** (App ID `834161262867210`).

### Paso 1: Aceptar la Invitación en Instagram (~1 minuto)
1. Con la cuenta `@kinesicabrude` logueada en la web o app de Instagram:
   - En la web: Entrar a **[instagram.com/accounts/manage_access/](https://www.instagram.com/accounts/manage_access/)** → pestaña **"Invitaciones de evaluadores"** → click en **Aceptar**.
   - En el celular: **Configuración y privacidad → Permisos de sitios web / Apps y sitios web → Invitaciones de evaluador** → Aceptar.
2. Confirmar que la cuenta sea **Profesional** (Creador o Empresa) en Configuración → Tipo de cuenta y herramientas (gratuito).

### Paso 2: Generar el Token y obtener el User ID (~3 minutos)
1. Entrar al **[Explorador de Graph API](https://developers.facebook.com/tools/explorer/)**.
2. En la esquina superior derecha:
   - **App de Meta**: Seleccionar **`Kinésica Autopost`** (`834161262867210`).
   - **Permisos**: Agregar `instagram_basic` e `instagram_content_publish`.
   - Click en **Generar token de acceso** y autorizar con la cuenta `@kinesicabrude`.
3. En la barra de consulta del Explorador, hacer un `GET`:
   ```text
   me?fields=id,username
   ```
   Copiar el valor del campo `id` (número identificador de la cuenta).

### Paso 3: Extender el Token a 60 días (~1 minuto)
1. Abrir el **[Depurador de Tokens de Acceso](https://developers.facebook.com/tools/debug/accesstoken/)**.
2. Pegar el token corto generado y hacer click en **Depurar**.
3. Al final de la página, hacer click en **Extender token de acceso**.
4. Copiar el token largo resultante.

### Paso 4: Cargar en Hostinger y Activar el Cron (~3 minutos)
1. En el archivo `admin/api/config.php` del servidor en Hostinger:
   ```php
   'instagram_user_id' => 'TU_INSTAGRAM_USER_ID',
   'instagram_token'   => 'TU_TOKEN_DE_LARGA_DURACION',
   ```
2. En **hPanel de Hostinger → Avanzado → Tareas Cron (Cron Jobs)**:
   - Tipo: PHP
   - Comando: `/usr/bin/php /home/u.../public_html/admin/api/cron_instagram.php`
   - Frecuencia: Cada hora (`0 * * * *`).

### Paso 5: Prueba de Verificación
Desde la terminal SSH o consola en Hostinger:
```bash
# Simulación sin publicar (valida credenciales, conexión e imágenes):
php admin/api/cron_instagram.php --force --dry-run

# Publicación real de prueba:
php admin/api/cron_instagram.php --force
```

---

## 5. Suite de Pruebas Automatizadas

El módulo cuenta con suite propia de tests unitarios y de integración:
```bash
# Ejecutar únicamente las pruebas de Instagram:
npm run instagram:test

# Ejecutar la suite completa del panel de administración (25 suites):
npm run admin:test
```

Las pruebas validan de forma automática:
- Idempotencia DDL en SQLite in-memory.
- Rechazo estricto de Path Traversal (`../`, extensiones no autorizadas).
- Inserción y encolado FIFO.
- Reordenamiento atómico con transacciones SQL.
- Nulabilidad de IDs de publicación (Feed solo, Story solo o ambos).
- Aislamiento de seguridad (el endpoint jamás expone tokens a la interfaz).
- Límite de 3 intentos (`IG_MAX_ATTEMPTS`) y transición a `failed`.
- Sanitización contra inyección SQL.
- Persistencia y recuperación segura de tokens.
- Cumplimiento del límite de 250 líneas en todos los archivos.
- Presencia en el menú "Meta" y exclusión del menú "Administración".
- Contratos y lógica de badges del cliente JS.
