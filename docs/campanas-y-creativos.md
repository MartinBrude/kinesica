# 📢 Manual de Campañas Publicitarias y Galería de Creativos Instagram

Guía operativa para gestionar la captación de pacientes a través de campañas digitales, descargar piezas gráficas institucionales con sus copys redactados, programar publicaciones automáticas en Instagram y realizar el seguimiento de conversiones en el consultorio.

---

## 🧭 Módulos Disponibles en el Panel de Administración

1. **Creativos Instagram (`/admin/creativos`):** Ubicado en el menú superior **Meta**, accesible tanto para administradores como para Norberto. Incluye el catálogo de **138** piezas gráficas, el sistema de Me gusta (`❤️`) para armar la lista de publicación, Drag & Drop para reordenar y la publicación automática en Instagram (@kinesicabrude).
2. **Turnos de campaña (`/admin/campana`):** Ubicado en el menú superior **Administración**, permite la supervisión de citas originadas por campañas publicitarias, conciliación con Google Calendar y exportación de datos a CSV.

---

## 🎨 1. Galería de Creativos Instagram (`/admin/creativos`)

La galería reúne **138 piezas publicitarias y educativas** de alta calidad fotográfica y renders médicos 3D estilo Pomelli, diseñadas con la identidad visual institucional de Kinésica (Charcas 3889, Palermo, CABA). Incluye temporada (Felices Fiestas, vacaciones), avisos de turnos y educación clínica (hernias, cefalea, mareos, capsulitis, túnel carpiano, fascitis, esguince, escoliosis, tendinitis, miembro fantasma, etc.).

### 📐 Formatos Disponibles con un Clic

Cada pieza fue renderizada y optimizada en dos formatos estándar de redes sociales:

* **Feed (4:5 — 1080 × 1350 px):** Proporción vertical optimizada para el feed de Instagram y publicaciones orgánicas en Facebook. Maximiza el espacio visual en la pantalla del celular sin recortar textos ni logotipos.
* **Story / Reels (9:16 — 1080 × 1920 px):** Proporción vertical completa para historias de Instagram, estados de WhatsApp y videos breves.

Podés alternar entre ambos formatos con el selector superior **Formato: Feed (4:5) / Story (9:16)**; todas las miniaturas y descargas se adaptan instantáneamente.

### 🏷️ Categorías y Búsqueda

Las piezas están organizadas en 4 grupos temáticos según la necesidad clínica del paciente:
* **Todos**: Catálogo completo (138 piezas).
* **Filosofía y Marca**: Educación sobre causa raíz vs. síntoma, compensación, tipos de dolor, atención 1 a 1 de 60 minutos.
* **Columna y Postura**: Cervicalgia, lumbalgia, ciatalgia, hernia de disco, dorsalgia, rectificación cervical, escoliosis.
* **Articulaciones y Extremidades**: ATM y bruxismo, manguito rotador, rodilla, fascitis plantar, túnel carpiano, tendinitis, miembro fantasma.

El **buscador en tiempo real** permite filtrar instantáneamente por cualquier síntoma o patología.

### Textos de imagen vs caption

Hay **dos editores independientes** (misma pieza):

| Campo | Qué es | Dónde se guarda | Efecto |
|-------|--------|-----------------|--------|
| **Caption** (`✏️ Editar caption`) | Texto de la publicación en Instagram / WhatsApp | DB `instagram_creativo_copy` | No toca el PNG |
| **Textos de imagen** (`🖼️ Editar imagen`) | Pill (`cat`), headline (`title`), cuerpo (`body`) dibujados sobre la foto | DB `instagram_creativo_image_text` | Regenera Feed + Story con plantilla única |

Límites on-image: cat ≤ 32, title ≤ 72, body ≤ 180. El renderer achica la tipografía; si no entra, trunca con `…`.

**Fondos originales:** las placas fotográficas viven en `admin/campanas/original/{feed,story}/` (copia intacta). Las rutas públicas `campanas/feed|story/` son el resultado compuesto. **No borrar `original/`** hasta validar el pipeline en producción.

Backup idempotente: `npm run creativos:backup`. Regeneración CLI de una pieza: `npm run creativos:render -- --id=01_acostumbraste_dolor`.

Si la pieza está en estado `publishing`, la API rechaza el cambio de textos de imagen (409). En `queued`, regenera PNG, invalida el JPG de `campanas/ig/` y actualiza el `title` de la fila en cola (el caption no se toca).

---

## 🚀 2. Sistema de Publicación Automática en Instagram

Directamente desde la interfaz de Creativos, Norberto y los administradores gestionan qué sale publicado sin depender de herramientas externas:

1. **Selección con ❤️**:
   - Un solo control por pieza: el corazón `🤍 / ❤️` sobre la miniatura (y en el modal).
   - Al hacer click, pasa a `❤️ #N` y la pieza se suma a la **Lista para publicar** sin abrir popups.
2. **Pestaña "❤️ Lista para publicar"**:
   - **Drag & Drop**: Reordená la prioridad arrastrando las tarjetas con el mouse.
   - **Botones ⬆️ / ⬇️**: Para subir o bajar una posición en un clic.
   - **Cálculo de slots estimados**: Fechas proyectadas según la frecuencia configurada en admin (default Lun/Mié/Vie 10:00 AR).
   - **Frecuencia**: días + hora en la barra de la cola; persiste en DB y alimenta el cron (1 pieza/día).
   - **🗑️ Papelera**: tachito en cada pieza para sacarla del catálogo (soft-delete). Se restaura desde el filtro Papelera.
   - **original/** debe ser **foto limpia** (sin logo ni copy). Si el original ya es la pieza terminada, el render se niega (evita logo/texto duplicados).
   - **Compositor**: logo = pill blanco **con margen** (estilo 122), no cápsula pegada a la esquina. Copy anclado abajo con aire; banda navy solo del alto necesario.
   - **Editar imagen** refleja URL: `/admin/creativos/editar/{id}` (atrás del browser cierra el modal).
   - **⚡ Publicar ya**: Publica de inmediato según el canal elegido (timeout 180s). Cuenta para el cupo del día.
   - **✏️ Editar caption**: Cambia el texto de la publicación (máx. 2200 caracteres). No regenera la imagen. Usa el WhatsApp de Clara (`+54 9 11 3178-1733`).
   - **🖼️ Editar imagen**: Cambia pill / título / cuerpo on-image y regenera Feed + Story automáticamente.
   - **Canal**: por pieza elegís **Feed + Story**, **Solo Feed** o **Solo Story** (vale para el cron y para Publicar ya).
   - **Activar / Pausar**: botón para apagar o encender el cron automático (por defecto **activo**). Pausado = el cron no publica; la cola y Publicar ya siguen disponibles.
   - **Idempotencia diaria + anti-duplicado**: una sola pieza por día AR; locks permanentes por canal; piezas publicadas o fallidas con canal reservado **no** se reencolan.
3. **Reporte de canales publicados**:
   - `✅ Feed + Story`, `✅ Solo Post` o `✅ Solo Story`.
   - `⏳ Publicando…` / `⚠️ Falló (bloqueada)` cuando corresponde.
   - Historial de publicaciones con fecha (solo lectura; sin re-encolar).

*(Credenciales System User, `private/admin-config.php`, `instagram_api_base` y cron: [docs/instagram-autopost.md](instagram-autopost.md)).*

---

## 📊 3. Turnos de Campaña (`/admin/campana`)

Este módulo permite medir el retorno de la inversión publicitaria y la trazabilidad de los pacientes que agendaron a partir de pautas digitales o enlaces promocionales.

### 🔄 Funcionamiento y Trazabilidad

1. **Lectura directa de Google Calendar:** El sistema inspecciona los turnos agendados en el calendario **`consultorio`** dentro del rango de fechas seleccionado.
2. **Rango de fechas configurable:** Por defecto carga los últimos dos meses, pero podés ajustar libremente las fechas **Desde** y **Hasta** y tocar **Filtrar**.
3. **Cruce con el Directorio de Pacientes:** Identifica al paciente por su nombre, teléfono o DNI registrado en el sistema.
4. **Identificación de Campaña:**
   - Si el turno fue agendado a través de un enlace de campaña (con etiquetas UTM o parámetro `utm_source=instagram`), el paciente queda automáticamente marcado con el tilde **¿Viene de campaña?**.
   - **Edición manual con un clic:** En la tabla de turnos podés marcar o desmarcar la casilla **¿Viene de campaña?** en cualquier momento para corregir o validar pacientes referidos por redes que hayan agendado manualmente o por WhatsApp.
5. **Exportación a CSV:**
   - El botón **`📥 Exportar CSV`** descarga un archivo compatible con Excel / Google Sheets con las columnas: `Fecha`, `Hora`, `Paciente`, `WhatsApp`, `DNI`, `Profesional`, `Técnica` y `Es de campaña (Sí/No)`.

---

## 💡 4. Recomendaciones para Pauta y Publicaciones

1. **Enlace a la turnera en la biografía:**  
   En el perfil de Instagram `@kinesicabrude`, el enlace principal debe apuntar directamente a:  
   `https://www.kinesica.com.ar/agendar`
2. **WhatsApp directo con mensaje predeterminado:**  
   Para campañas cuyo objetivo sea mensaje a WhatsApp, utilizá el enlace con mensaje inicial:  
   `https://wa.me/5491131781733?text=Hola,%20vi%20la%20publicación%20en%20Instagram%20y%20quisiera%20consultar%20por%20un%20turno`
3. **Frecuencia automatizada de publicación:**  
   - Con la cola activa, el cron publica en los días/hora configurados desde admin (default Lun/Mié/Vie desde 10:00 AR).
   - Si ese día ya hubo un **Publicar ya**, el cron salta el día (una sola pieza por fecha).
   - Norberto puede mantener entre 5 y 10 piezas seleccionadas con ❤️ en la lista para tener cobertura automática para las próximas semanas.
