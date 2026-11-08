# 📢 Manual de Campañas Publicitarias y Galería de Creativos Instagram

Guía operativa para gestionar la captación de pacientes a través de campañas digitales, descargar piezas gráficas institucionales con sus copys redactados, programar publicaciones automáticas en Instagram y realizar el seguimiento de conversiones en el consultorio.

---

## 🧭 Módulos Disponibles en el Panel de Administración

1. **Creativos Instagram (`/admin/creativos`):** Ubicado en el menú superior **Meta**, accesible tanto para administradores como para Norberto. Incluye el catálogo de 93 piezas gráficas, el sistema de Me gusta (`❤️`) para armar la lista de publicación, Drag & Drop para reordenar y la publicación automática en Instagram (@kinesicabrude).
2. **Turnos de campaña (`/admin/campana`):** Ubicado en el menú superior **Administración**, permite la supervisión de citas originadas por campañas publicitarias, conciliación con Google Calendar y exportación de datos a CSV.

---

## 🎨 1. Galería de Creativos Instagram (`/admin/creativos`)

La galería reúne **93 piezas publicitarias y educativas** de alta calidad fotográfica y renders médicos 3D estilo Pomelli, diseñadas con la identidad visual institucional de Kinésica (Charcas 3889, Palermo, CABA).

### 📐 Formatos Disponibles con un Clic

Cada pieza fue renderizada y optimizada en dos formatos estándar de redes sociales:

* **Feed (4:5 — 1080 × 1350 px):** Proporción vertical optimizada para el feed de Instagram y publicaciones orgánicas en Facebook. Maximiza el espacio visual en la pantalla del celular sin recortar textos ni logotipos.
* **Story / Reels (9:16 — 1080 × 1920 px):** Proporción vertical completa para historias de Instagram, estados de WhatsApp y videos breves.

Podés alternar entre ambos formatos con el selector superior **Formato: Feed (4:5) / Story (9:16)**; todas las miniaturas y descargas se adaptan instantáneamente.

### 🏷️ Categorías y Búsqueda

Las piezas están organizadas en 4 grupos temáticos según la necesidad clínica del paciente:
* **Todos**: Catálogo completo (93 piezas).
* **Filosofía y Marca**: Educación sobre causa raíz vs. síntoma, atención 1 a 1 de 60 minutos, dolor crónico.
* **Columna y Postura**: Cervicalgia, lumbalgia, ciatalgia, hernia de disco, dorsalgia, rectificación cervical, escoliosis.
* **Articulaciones y Extremidades**: ATM y bruxismo, manguito rotador, rodilla, fascitis plantar, túnel carpiano.

El **buscador en tiempo real** permite filtrar instantáneamente por cualquier síntoma o patología.

---

## 🚀 2. Sistema de Publicación Automática en Instagram

Directamente desde la interfaz de Creativos, Norberto y los administradores gestionan qué sale publicado sin depender de herramientas externas:

1. **Selección con ❤️ Me gusta**:
   - Cada tarjeta tiene un botón de corazón `🤍 / ❤️`.
   - Al hacer click, el corazón pasa a `❤️ #N` y la pieza se suma a la **Lista para publicar** sin interrumpir la navegación (no abre popups innecesarios).
2. **Pestaña "❤️ Lista para publicar"**:
   - **Drag & Drop**: Reordená la prioridad arrastrando las tarjetas con el mouse.
   - **Botones ⬆️ / ⬇️**: Para subir o bajar una posición en un clic.
   - **Cálculo de slots estimados**: Muestra las fechas proyectadas de publicación (Lunes, Miércoles y Viernes a las 10:00 hs de Argentina).
   - **⚡ Publicar ya**: Publica de inmediato en Instagram tanto el Feed como la Story sin esperar al cron.
3. **Reporte de canales publicados**:
   - `✅ Feed + Story`, `✅ Solo Post` o `✅ Solo Story`.
   - Historial de publicaciones con fecha y botón **🔄 Re-encolar**.

*(Para detalles técnicos de la API de Meta, base de datos y configuración del cron, consultar [docs/instagram-autopost.md](instagram-autopost.md)).*

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
   `https://wa.me/5491161564311?text=Hola,%20vi%20la%20publicación%20en%20Instagram%20y%20quisiera%20consultar%20por%20un%20turno`
3. **Frecuencia automatizada de publicación:**  
   - Con la cola activa, el cron publica 3 veces por semana (Lunes, Miércoles y Viernes a las 10:00 hs).
   - Norberto puede mantener entre 5 y 10 piezas seleccionadas con ❤️ en la lista para tener cobertura automática para las próximas semanas.
