# Automatización de Publicaciones en Instagram (@kinesicabrude)

Este módulo permite a **Norberto y Martín** gestionar de forma visual y 100% autónoma las publicaciones de Feed (4:5) e Historias (9:16) en la cuenta de Instagram `@kinesicabrude`, directamente desde el panel de administración (`/admin/creativos`).

---

## 1. ¿Cómo funciona para el usuario (Norberto y Admins)?

### 🧭 Ubicación en el Panel
- Se encuentra en el menú superior **Meta** (ícono de WhatsApp / Meta) bajo la opción **🎨 Creativos Instagram**.
- Es accesible tanto para administradores como para el usuario de Norberto (no requiere ser superadministrador).

### 🤍 Dar ❤️ Me gusta (Catálogo de 133 piezas)
- Cada pieza tiene un único botón de corazón flotante `🤍` / `❤️ #N` en la esquina superior derecha de la miniatura (también disponible en el modal “Ver en grande”).
- **Interacción fluida**: Al hacer click en el corazón, la tarjeta conmuta su estado inmediatamente (`❤️ #N` o `🤍`) **sin abrir la previsualización modal**.
- La previsualización ampliada ("Ver en grande") se abre únicamente al hacer click en la miniatura de la imagen o en el botón **🔍 Ver en grande**.

### 📋 Pestaña "❤️ Lista para publicar"
- Muestra las publicaciones seleccionadas en el orden de salida programado.
- **Reordenar con Drag & Drop**: Podés arrastrar y soltar las tarjetas directamente con el mouse (usando el tirador `⋮⋮` o la tarjeta entera). El nuevo orden se persiste automáticamente en la base de datos de manera atómica.
- **Botones ⬆️ Subir / ⬇️ Bajar**: Alternativa accesible con un solo click para pantallas táctiles o móviles.
- **Cálculo de slots estimados**: Muestra la fecha y hora proyectada para cada pieza según la **frecuencia configurada** en la barra de la cola (días + hora Argentina). Por defecto: Lun/Mié/Vie 10:00.
- **Frecuencia (admin)**: En **Lista para publicar**, elegís días (Lun–Dom) y hora; **💾 Guardar frecuencia** persiste en `instagram_settings`. El cron y los slots estimados usan ese valor. Sigue valiendo **1 pieza por día**.
- **⚡ Publicar ya**: Publicación inmediata según el **canal** elegido (Feed, Story o ambas). Cuenta para el cupo del día: el cron **no** publicará otra pieza esa misma fecha Argentina. Timeout de cliente/servidor **300s** (Feed+Story puede acercarse a 2×120s de wait Meta).
- **Recovery `publishing` stuck**: si el proceso muere a mitad (timeout/OOM), `ig_release_stale_publishing()` (cron y Publicar ya) marca failed/reencola según progreso tras **420s** sin avance. `publishing_at` se escribe y compara en **UTC** (no depende del TZ de MariaDB).
- **Cupo del día sin publish**: si el crash dejó **sin** `feed_media_id`/`story_media_id` (aunque haya channel guard o container), el release **devuelve** el day guard para no quemar el cupo; el channel guard permanece (no se reencola esa pieza). Si el day slot quedó quemado con media parcial ya marcada `published`, ver § Runbook abajo.
- **✏️ Editar caption**: Cualquier usuario con acceso a Creativos puede editar el caption (máx. **2200**). DB `instagram_creativo_copy`. No toca el PNG. WhatsApp de Clara (`+54 9 11 3178-1733`).
- **🖼️ Editar imagen**: Edita `cat` / `title` / `body` (límites 32 / 72 / 180), persiste en `instagram_creativo_image_text`, regenera PNG feed+story desde `campanas/original/` con plantilla GD única, y hace bust del JPG en `campanas/ig/`. Rechazado si status=`publishing` (409).
- **Canal (Feed / Story / Ambas)**: En la cola, un selector por pieza define qué se publica (cron y **⚡ Publicar ya**). Por defecto: Feed + Story.
- **Activar / Pausar**: Botón en la lista para encender o apagar el servicio automático. **Por defecto está activo.** Si está pausado, el cron no publica (sí se puede seguir editando la cola y usar Publicar ya).
- **💔 Quitar**: Remueve la pieza de la cola (solo si está `queued`) y la devuelve al catálogo como disponible.

### 📸 Reporte y Marcado de Publicación
Al publicarse una pieza (sea por el cron o manualmente), el sistema registra el resultado exacto:
- **`✅ Feed + Story`**: Publicada con éxito en ambos canales.
- **`✅ Solo Post`**: Publicada únicamente en el Feed (4:5).
- **`✅ Solo Story`**: Publicada únicamente en Historia (9:16).
- **`⏳ Publicando…`**: Reserva atómica en curso (`status=publishing`); controles bloqueados.
- **`⚠️ Falló (bloqueada)`**: Falló tras reservar canal; **no se reencola ni se reintenta** (evita duplicados en Instagram).
- **Historial**: piezas `published` quedan como histórico (**no** hay re-encolar: una pieza publicada no vuelve a la cola).

---

## 2. Publicación Desatendida, Idempotencia y Tokens

1. **Horario Oficial**: El cron se ejecuta cada hora. Publica solo en los **días y a partir de la hora** guardados en admin (`instagram_settings.publish_days` / `publish_hour`, TZ `America/Argentina/Buenos_Aires`). Default si no hay fila: Lun/Mié/Vie desde las 10:00 (también sobreescribible vía `config.php` `instagram_days` / `instagram_hour` hasta el primer guardado en admin).
2. **Una sola pieza por día (cron o manual)**:
   - Tanto el cron como **⚡ Publicar ya** marcan `published_on` con la fecha de Argentina al publicar.
   - Antes de publicar, el cron llama a `ig_published_on_date($today)`: si **ya hubo una publicación ese día** (manual o automática), **sale sin publicar**.
   - Por lo tanto: si publicaste a mano un miércoles a las 9:30, el cron de las 10:00 **no** publica otra pieza ese día.
   - **Anti-duplicado (estricto)**:
     1. Reserva de pieza `queued → publishing` (segundo intento → 409 / cron sale).
     2. Lock permanente de **día** (`instagram_publish_guard` slot `day:YYYY-MM-DD`): se adquiere **después** de validar `instagram_user_id` + token (no se quema el día por config rota).
     3. Lock permanente por **canal** (`piece:ID:feed` / `piece:ID:story`): jamás se crea un segundo container/publish para ese canal.
     4. Se persiste `*_container_id` antes del `media_publish` y `*_media_id` apenas sale; un reintento reusa el container, no crea otro.
     5. Si hubo progreso (media/container/guard), **no se reencola**: con `media_id` → `published`; con guard/container sin media → `failed`.
     6. Piezas `published` / con progreso de publicación **no** se pueden volver a encolar (`409`).
   - El flag `--force` en CLI omite día/hora del calendario y el cupo diario, pero **sigue** respetando los locks de canal (no duplica Feed/Story). **No** usarlo en el Cron Job de producción.
3. **Tokens**:
   - En producción usamos un **System User token** de Meta Business (portfolio **Kinesica**) con la app **Kinesica** (`934161262967210`) y el IG `@kinesicabrude` (`17841431309622146`).
   - Ese token habla con **`graph.facebook.com`**, no con `graph.instagram.com`. En config: `'instagram_api_base' => 'https://graph.facebook.com/v21.0'`.
   - `ig_token_refresh_if_needed()` **no** intenta `ig_refresh_token` cuando `instagram_api_base` apunta a Facebook (ese refresh es solo para tokens Instagram Login). Renovar/rotar el System User token es un paso manual en Business Suite si Meta lo exige.

---

## 3. Arquitectura y Regla de Líneas (< 250 líneas)

Cada módulo del backend y frontend respeta rigurosamente el límite estricto de **menos de 250 líneas**:

| Archivo | Responsabilidad | Líneas |
|---|---|---|
| [`admin/api/lib_instagram_store.php`](../admin/api/lib_instagram_store.php) | Persistencia cola/token, `ig_today` / `ig_valid_id` / `IG_CAPTION_MAX`, PNG→JPG, `admin_url` | **≤250** |
| [`admin/api/lib_instagram_copy.php`](../admin/api/lib_instagram_copy.php) | Caption overrides, settings on/off, `update_channels` | **≤250** |
| [`admin/api/lib_instagram_image_text.php`](../admin/api/lib_instagram_image_text.php) | Overrides on-image + `ig_image_text_save` + guard publishing | **≤250** |
| [`admin/api/lib_instagram_render.php`](../admin/api/lib_instagram_render.php) | Plantilla GD feed/story, shrink-to-fit, bust cache JPG | **≤250** |
| [`admin/api/lib_instagram_guard.php`](../admin/api/lib_instagram_guard.php) | Locks día/canal, claim/release, containers/partial media | **≤250** |
| [`admin/api/lib_instagram.php`](../admin/api/lib_instagram.php) | Cliente Graph API, publish por canal, day-guard post-credenciales | **≤250** |
| [`admin/api/instagram_cola.php`](../admin/api/instagram_cola.php) | REST: cola + `update_caption` + `update_image_text` + channels/enabled | **≤250** |
| [`admin/api/cron_instagram.php`](../admin/api/cron_instagram.php) | Worker CLI, horario AR, servicio pausable, `--force` | **≤250** |
| [`admin/modules/admin-creativos-cola.js`](../admin/modules/admin-creativos-cola.js) | Store cliente, copies, image_texts, API cola/publish | **≤250** |
| [`admin/modules/admin-creativos-cola-ui.js`](../admin/modules/admin-creativos-cola-ui.js) | HTML/pintura de ❤️, badges y botones (published/publishing/failed) | **≤250** |
| [`admin/modules/admin-creativos-lista.js`](../admin/modules/admin-creativos-lista.js) | Cola UI, drag & drop, historial | **≤250** |
| [`admin/modules/admin-creativos-caption.js`](../admin/modules/admin-creativos-caption.js) | Editor de caption + selector de canal + toggle servicio | **≤250** |
| [`admin/modules/admin-creativos-image-text.js`](../admin/modules/admin-creativos-image-text.js) | Editor on-image + regeneración | **≤250** |

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
'admin_url'          => 'https://www.kinesica.com.ar/admin/', // base de image_url para Meta
```

### Paso 5: Cron en Hostinger
- **hPanel → Avanzado → Tareas Cron**
- Comando: `/usr/bin/php /home/u696348908/domains/kinesica.com.ar/public_html/admin/api/cron_instagram.php`
- Frecuencia: cada hora (`0 * * * *`)
- **Sin** `--force` en producción.

### Paso 6: Verificación
- **Prueba real de Meta:** **⚡ Publicar ya** desde Creativos (o `cron_instagram.php --force` solo en una prueba controlada). Una cola vacía / dry-run sin pieza **no** valida el token.
- Tras un **Publicar ya** exitoso el mismo día, el cron horario **no** debe publicar otra pieza (idempotencia diaria).
- Deploy: push a `main` despliega el sitio en Hostinger (Git auto-deploy). GAS de booking se publica aparte con `npm run gas:deploy`.

### Runbook: day slot quemado sin publicación

**Síntoma:** la cola tiene piezas `queued`, no hay `published_on` hoy, pero el cron / Publicar ya responde *«Ya hay (o hubo) una publicación reservada para hoy»*.

**Causa:** se adquirió el lock permanente `day:YYYY-MM-DD` en `instagram_publish_guard` y el proceso murió. Si **hubo** progreso Meta (container/canal), el sweeper marca `failed` y **no** suelta el día (anti-duplicado). Si **no** hubo progreso, el sweeper reencola y suelta el day guard solo.

**Diagnóstico (MariaDB / SQLite):**
```sql
SELECT * FROM instagram_publish_guard WHERE slot = CONCAT('day:', CURDATE()); -- o day:YYYY-MM-DD
SELECT creativo_id, status, published_on, feed_media_id, story_media_id, feed_container_id, story_container_id
FROM instagram_cola WHERE status IN ('publishing','failed','queued') ORDER BY queued_at DESC LIMIT 10;
```

**Recuperación segura (sin publish ese día):**
```bash
# En el servidor (ruta real del cron). Fecha opcional = hoy AR.
/usr/bin/php .../admin/api/cron_instagram.php --clear-day-slot
/usr/bin/php .../admin/api/cron_instagram.php --clear-day-slot=2026-11-10
```
Solo borra el day guard si **no** existe ninguna fila con `published_on` esa fecha. Si ya hubo publish, el comando se niega (usar `--force` en una prueba controlada solo si Meta confirma que no salió nada).

**Si hay `*_container_id` / guard de canal sin `*_media_id`:** no liberar el día a mano; dejar la pieza en `failed` y publicar **otra** pieza otro día, o `--force` tras verificar en Meta Business Suite que no quedó un post huérfano.

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
- Inserción y encolado FIFO; bloqueo de re-encolar `published` / con progreso.
- Reordenamiento atómico con transacciones SQL.
- Nulabilidad de IDs de publicación (Feed solo, Story solo o ambos).
- Aislamiento de seguridad (el endpoint jamás expone tokens a la interfaz).
- Límite de 3 intentos (`IG_MAX_ATTEMPTS`) y transición a `failed`.
- Claim atómico, guards permanentes día/canal, release → `failed` si hay guard sin media.
- Caption máx. 2200; `ig_today` / canales / servicio on-off.
- Sanitización contra inyección SQL.
- Persistencia y recuperación segura de tokens.
- Cumplimiento del límite de 250 líneas en todos los archivos.
- Presencia en el menú "Meta" y exclusión del menú "Administración".
- Contratos y lógica de badges del cliente JS (Both / Feed / Story / Publishing / Failed).
