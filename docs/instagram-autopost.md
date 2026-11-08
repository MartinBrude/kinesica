# Automatización de Publicaciones en Instagram (@kinesicabrude)

Este módulo permite a **Norberto y Martín** gestionar de forma visual y 100% autónoma las publicaciones de Feed (4:5) e Historias (9:16) en la cuenta de Instagram `@kinesicabrude`, directamente desde el panel de administración (`/admin/creativos`).

---

## 1. ¿Cómo funciona para el usuario (Norberto y Admins)?

1. **Dar ❤️ Me gusta (Catálogo de piezas)**:
   - Al explorar los 93 creativos en el panel, cada tarjeta tiene un corazón flotante `🤍` y un botón `🤍 Me gusta (programar)`.
   - Al hacer click, el corazón se vuelve rojo `❤️ #N` y la publicación ingresa a la **Lista para publicar**.
   - También se puede hacer click desde el modal "Ver en grande".

2. **Pestaña "❤️ Lista para publicar"**:
   - Muestra las publicaciones seleccionadas en el orden exacto en que se subirán.
   - Calcula y muestra la fecha y hora estimada de salida para cada posición:
     - Publicación #1: Próximo Lunes / Miércoles / Viernes a las 10:00 hs (hora Argentina).
     - Publicación #2: Siguiente fecha a las 10:00 hs.
     - Publicación #3: Siguiente fecha a las 10:00 hs...
   - **Reordenar con un click**: Botones **⬆️ Subir** y **⬇️ Bajar** para cambiar las prioridades. El sistema guarda el orden inmediatamente en la base de datos.
   - **Quitar**: Botón **💔 Quitar** para devolverla al catálogo.

3. **Publicación automática desatendida**:
   - El servidor publica **3 veces por semana: Lunes, Miércoles y Viernes a las 10:00 hs (hora de Argentina)**.
   - Publica simultáneamente:
     - **Post de Feed** (1080×1350, vertical 4:5) con su copy/texto sugerido y hashtags.
     - **Historia de Instagram** (1080×1920, vertical 9:16).
   - El token de Meta (duración 60 días) se auto-renueva en segundo plano cuando le quedan menos de 20 días.

---

## 2. Arquitectura de Archivos

Cumple con la regla estricta de cohesión y límite de líneas del proyecto (`< 250 líneas` por archivo):

| Archivo | Rol | Líneas |
|---|---|---|
| `admin/api/lib_instagram_store.php` | Persistencia en DB (`instagram_cola`, `instagram_token`), orden `sort_order`, conversión PNG→JPG (cache en `admin/campanas/ig/`) | ~189 |
| `admin/api/lib_instagram.php` | Cliente HTTP Instagram Graph API (v21.0), creación de contenedores, publicación y refresh de token | ~79 |
| `admin/api/instagram_cola.php` | Endpoint REST protegido (`GET` lista, `POST` add, remove, reorder) | ~42 |
| `admin/api/cron_instagram.php` | Cron CLI programado. Respeta zona horaria `America/Argentina/Buenos_Aires` | ~85 |
| `admin/modules/admin-creativos-cola.js` | Estado de la cola, sincronización y botones ❤️ Me gusta | ~153 |
| `admin/modules/admin-creativos-lista.js` | Vista de "Lista para publicar", cálculo de slots estimados y reordenamiento ⬆️ / ⬇️ | ~171 |

---

## 3. Guía Paso a Paso para Mañana (Tiempo estimado: 15–20 minutos)

Solo resta la configuración de credenciales de Meta y el Cron en Hostinger.

### Paso 1: Convertir cuenta de Instagram a Profesional (2 minutos)
*Si la cuenta ya es Creator o Business, saltar este paso.*
1. Abrir la app de Instagram en el celular con `@kinesicabrude`.
2. Ir a **Perfil → Menú (≡) → Configuración y privacidad → Tipo de cuenta y herramientas**.
3. Tocar **Cambiar a cuenta profesional** y elegir **Creador** o **Empresa** (Categoría: "Kinesiólogo" o "Salud"). Es gratis.

### Paso 2: Crear App y Token en Meta for Developers (10 minutos)
1. Entrar en [developers.facebook.com](https://developers.facebook.com/) con tu cuenta de Facebook/Meta.
2. Hacer click en **Mis apps → Crear app**.
3. Seleccionar caso de uso: **Otro** → Tipo de app: **Empresa (Business)**.
4. Nombre de la app: ej. `Kinesica Publicador`.
5. En el panel de la app, buscar el producto **Instagram** / **Instagram API with Instagram Login** y hacer click en **Configurar**.
6. En el menú lateral izquierdo: **Roles → Roles de la app**:
   - En "Evaluadores de Instagram" (Instagram Testers), hacer click en **Agregar evaluadores de Instagram** y escribir `kinesica_brude` (o el usuario exacto de tu cuenta).
   - En la app de Instagram de tu celular: ir a **Configuración → Herramientas para creadores / Permisos de sitios web → Invitaciones de apps y sitios** y aceptar la invitación.
7. Ir al **Explorador de la Graph API** ([developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)):
   - App de Meta: seleccionar tu app `Kinesica Publicador`.
   - Permisos necesarios a agregar:
     - `instagram_basic`
     - `instagram_content_publish`
   - Click en **Generar token de acceso**. Te logueas con la cuenta y copias el Token.
   - En el explorador hacé una consulta a `GET /me/accounts` o `GET /v21.0/me?fields=id,username` para obtener tu **Instagram User ID** numérico.
   - Convertir ese token corto en token de larga duración (60 días) en el Depurador de Tokens de Acceso ([developers.facebook.com/tools/debug/accesstoken](https://developers.facebook.com/tools/debug/accesstoken)) tocando "Extender token de acceso".

### Paso 3: Configurar en Hostinger (3 minutos)
1. En tu servidor de Hostinger, editar `admin/api/config.php`:
   ```php
   'instagram_user_id' => 'TU_INSTAGRAM_USER_ID',
   'instagram_token'   => 'TU_TOKEN_DE_LARGA_DURACION',
   ```
2. En **hPanel → Avanzado → Tareas Cron (Cron Jobs)**, agregar una tarea cada hora:
   - Tipo: PHP
   - Comando: `/usr/bin/php /home/u.../public_html/admin/api/cron_instagram.php`
   - Intervalo: Cada hora (`0 * * * *`).
   *(El script verifica internamente si es Lunes, Miércoles o Viernes a las 10:00 hs hora de Argentina antes de disparar).*

### Paso 4: Probar la primera publicación (1 minuto)
Vía SSH o consola en Hostinger:
```bash
# Simulación sin publicar (valida token, conexión e imagen):
php admin/api/cron_instagram.php --force --dry-run

# Publicación real de prueba:
php admin/api/cron_instagram.php --force
```
¡Listo! A partir de ese momento, cada vez que Norberto le dé ❤️ a una publicación desde el admin, saldrá en la fecha que le corresponda automáticamente.
EOF