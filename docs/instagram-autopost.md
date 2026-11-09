# Automatización de Publicaciones en Instagram (@kinesicabrude)

Este módulo permite a **Norberto y Martín** gestionar de forma visual y 100% autónoma las publicaciones de Feed (4:5) e Historias (9:16) en la cuenta de Instagram `@kinesicabrude`, directamente desde el panel de administración (`/admin/creativos`).

---

## 1. ¿Cómo funciona para el usuario (Norberto y Admins)?

### 🧭 Ubicación en el Panel
- Se encuentra en el menú superior **Meta** (ícono de WhatsApp / Meta) bajo la opción **🎨 Creativos Instagram**.
- Es accesible tanto para administradores como para el usuario de Norberto (no requiere ser superadministrador).

### 🤍 Dar ❤️ Me gusta (Catálogo de 93 piezas)
- Cada pieza tiene un único botón de corazón flotante `🤍` / `❤️ #N` en la esquina superior derecha de la miniatura (también disponible en el modal “Ver en grande”).
- **Interacción fluida**: Al hacer click en el corazón, la tarjeta conmuta su estado inmediatamente (`❤️ #N` o `🤍`) **sin abrir la previsualización modal**.
- La previsualización ampliada ("Ver en grande") se abre únicamente al hacer click en la miniatura de la imagen o en el botón **🔍 Ver en grande**.

### 📋 Pestaña "❤️ Lista para publicar"
- Muestra las publicaciones seleccionadas en el orden de salida programado.
- **Reordenar con Drag & Drop**: Podés arrastrar y soltar las tarjetas directamente con el mouse (usando el tirador `⋮⋮` o la tarjeta entera). El nuevo orden se persiste automáticamente en la base de datos de manera atómica.
- **Botones ⬆️ Subir / ⬇️ Bajar**: Alternativa accesible con un solo click para pantallas táctiles o móviles.
- **Cálculo de slots estimados**: Muestra la fecha y hora proyectada para cada pieza según la frecuencia de salida:
  - Posición #1: Próximo Lunes, Miércoles o Viernes a las 10:00 hs (hora de Argentina).
  - Posición #2: Siguiente fecha hábil de publicación a las 10:00 hs.
  - Posición #3: Siguiente fecha...
- **⚡ Publicar ya**: Publicación inmediata de Feed + Story. Cuenta para el cupo del día: el cron **no** publicará otra pieza esa misma fecha Argentina.
- **✏️ Editar texto**: Cualquier usuario con acceso a Creativos (Martin, Norberto, etc.) puede editar el caption de una pieza en cola. Se guarda en DB (`instagram_creativo_copy`) y aplica a la publicación y a futuros encolados de esa pieza. El botón **Copiar texto** del catálogo también usa el override si existe.
- **Canal (Feed / Story / Ambas)**: En la cola, un selector por pieza define qué se publica (cron y **⚡ Publicar ya**). Por defecto: Feed + Story.
- **💔 Quitar**: Remueve la pieza de la cola y la devuelve al catálogo como disponible.

### 📸 Reporte y Marcado de Publicación
Al publicarse una pieza (sea por el cron o manualmente), el sistema registra el resultado exacto:
- **`✅ Feed + Story`**: Publicada con éxito en ambos canales.
- **`✅ Solo Post`**: Publicada únicamente en el Feed (4:5).
- **`✅ Solo Story`**: Publicada únicamente en Historia (9:16).
- **Historial de publicaciones**: En la parte inferior de la lista queda la lista de piezas publicadas con fecha, identificadores de medios de Instagram y botón **🔄 Re-encolar** por si se desea volver a programarla a futuro.

---

## 2. Publicación Desatendida, Idempotencia y Tokens

1. **Horario Oficial**: El cron se ejecuta cada hora y publica solo **Lunes, Miércoles y Viernes a partir de las 10:00 hs de Argentina** (`America/Argentina/Buenos_Aires`).
2. **Una sola pieza por día (cron o manual)**:
   - Tanto el cron como **⚡ Publicar ya** marcan `published_on` con la fecha de Argentina al publicar.
   - Antes de publicar, el cron llama a `ig_published_on_date($today)`: si **ya hubo una publicación ese día** (manual o automática), **sale sin publicar**.
   - Por lo tanto: si publicaste a mano un miércoles a las 9:30, el cron de las 10:00 **no** publica otra pieza ese día.
   - El flag `--force` en CLI **omite** día/hora e idempotencia diaria: **no** usarlo en el Cron Job de Hostinger de producción (solo pruebas puntuales).
3. **Tokens**:
   - En producción usamos un **System User token** de Meta Business (portfolio **Kinesica**) con la app **Kinesica** (`934161262967210`) y el IG `@kinesicabrude` (`17841431309622146`).
   - Ese token habla con **`graph.facebook.com`**, no con `graph.instagram.com`. En config: `'instagram_api_base' => 'https://graph.facebook.com/v21.0'`.
   - `ig_token_refresh_if_needed()` **no** intenta `ig_refresh_token` cuando `instagram_api_base` apunta a Facebook (ese refresh es solo para tokens Instagram Login). Renovar/rotar el System User token es un paso manual en Business Suite si Meta lo exige.

---

## 3. Arquitectura y Regla de Líneas (< 250 líneas)

Cada módulo del backend y frontend respeta rigurosamente el límite estricto de **menos de 250 líneas**:

| Archivo | Responsabilidad | Líneas |
|---|---|---|
| [`admin/api/lib_instagram_store.php`](../admin/api/lib_instagram_store.php) | Persistencia cola/token, anti path-traversal, reorder, PNG→JPG | **≤250** |
| [`admin/api/lib_instagram_copy.php`](../admin/api/lib_instagram_copy.php) | Overrides de caption por creativo (`instagram_creativo_copy`) + sync a cola | **≤250** |
| [`admin/api/lib_instagram.php`](../admin/api/lib_instagram.php) | Cliente Graph API (`instagram_api_base`), containers, publish | **≤250** |
| [`admin/api/instagram_cola.php`](../admin/api/instagram_cola.php) | REST: add/remove/reorder/publish_now/**update_caption** | **≤250** |
| [`admin/api/cron_instagram.php`](../admin/api/cron_instagram.php) | Worker CLI, horario AR, idempotencia diaria | **≤250** |
| [`admin/modules/admin-creativos-cola.js`](../admin/modules/admin-creativos-cola.js) | Store cliente, copies, ❤️, publish | **≤250** |
| [`admin/modules/admin-creativos-lista.js`](../admin/modules/admin-creativos-lista.js) | Cola UI, drag & drop, historial | **≤250** |
| [`admin/modules/admin-creativos-caption.js`](../admin/modules/admin-creativos-caption.js) | Editor de texto en cola | **≤250** |

---

## 4. Guía de Puesta en Marcha (Credenciales y Servidor)

**App (autopost):** **Kinesica** — App ID `934161262967210` (no confundir con **Kinesica Bot** / WhatsApp `1621442579766673`).

**Portfolios Meta:**
| Portfolio | Business ID | Rol |
|-----------|-------------|-----|
| **Kinesica** | `1058280156753643` | Dueño de la app; System User del autopost |
| **kinesicabrude** | `1199982047014144` | Dueño del IG `@kinesicabrude` (`17841431309622146`) |

OAuth / Unified Login y tokens de usuario FB hacia `graph.instagram.com` **no** son el camino actual. El camino estable es **System User** (igual que WhatsApp).

### Paso 1: App visible en el portfolio dueño del IG
1. Desde **kinesicabrude** → Apps → pedir acceso a la app `934161262967210`.
2. Aprobar el request en portfolio **Kinesica** → Solicitudes.
3. Confirmar en Apps de kinesicabrude que **Kinesica** ya no dice “Request pending”.

### Paso 2: Compartir el IG hacia el portfolio de la app
1. En **kinesicabrude** → Cuentas de Instagram → `@kinesicabrude` → **Asignar socio**.
2. Partner: Business ID `1058280156753643` (Kinesica), Full control.
3. En portfolio **Kinesica** → Cuentas de Instagram debe aparecer `@kinesicabrude`.

### Paso 3: System User y token (portfolio Kinesica)
1. **Usuarios del sistema** → crear `kinesica-ig-autopost` (rol **Employee** si el límite de Admin ya lo ocupa `kinesicabot`; **no tocar** `kinesicabot` / WhatsApp).
2. Asignar activos: app **Kinesica** (Acceso total) + Instagram `@kinesicabrude` (Acceso total).
3. **Generar token** → app **Kinesica** (nunca Kinesica Bot) → permisos de Instagram / content publish.
4. Validar (sin pegar el token en chats):
   ```bash
   curl -sS "https://graph.facebook.com/v21.0/17841431309622146?fields=id,username&access_token=TOKEN"
   ```
   Esperado: `"username":"kinesicabrude"`. (`graph.instagram.com` con este token falla.)

### Paso 4: Config en Hostinger (archivo que realmente lee PHP)
El runtime carga **primero** `private/admin-config.php` (fuera de `public_html`). Si ese archivo existe, **ignora** `public_html/admin/api/config.php`.

Ruta típica:
`/home/u696348908/domains/kinesica.com.ar/private/admin-config.php`

Claves:
```php
'instagram_user_id'  => '17841431309622146',
'instagram_token'    => 'PEGAR_TOKEN_SYSTEM_USER',
'instagram_api_base' => 'https://graph.facebook.com/v21.0',
```

### Paso 5: Cron en Hostinger
- **hPanel → Avanzado → Tareas Cron**
- Comando: `/usr/bin/php /home/u696348908/domains/kinesica.com.ar/public_html/admin/api/cron_instagram.php`
- Frecuencia: cada hora (`0 * * * *`)
- **Sin** `--force` en producción.

### Paso 6: Verificación
- **Prueba real de Meta:** **⚡ Publicar ya** desde Creativos (o `cron_instagram.php --force` solo en una prueba controlada). Una cola vacía / dry-run sin pieza **no** valida el token.
- Tras un **Publicar ya** exitoso el mismo día, el cron horario **no** debe publicar otra pieza (idempotencia diaria).
- Deploy: Hostinger **no** tiene auto-pull Git en este sitio; cambios de PHP/JS hay que subirlos (File Manager / FTP) además del push a `main`.

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
