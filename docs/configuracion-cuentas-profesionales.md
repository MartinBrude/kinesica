# Guía de Acceso, Cuentas y Uso del Panel de Administración

> **Instructivo para el equipo de Kinésica** (Lic. Norberto Brude, Lic. María Gulín, Martín Brude y colaboradores).  
> Paso a paso para ingresar al sistema (con código por correo electrónico o con la app Authenticator del celular), cambiar o recuperar la contraseña, gestionar cuentas de usuarios y recorrer todas las secciones del panel `/admin/`.

---

## 📌 Enlace de Acceso al Sistema

El panel de administración, historias clínicas y configuración del consultorio se encuentra en:  
👉 **[https://www.kinesica.com.ar/admin/](https://www.kinesica.com.ar/admin/)**

Podés acceder desde cualquier computadora, tablet o teléfono con navegador web (Google Chrome, Safari, Firefox o Edge).

---

## 👤 Cuentas, Roles y Gestión de Usuarios

| Usuario | Nombre completo | Correo asociado | Teléfono | Rol en el sistema | Segundo factor (2FA) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `@norberto` | **Lic. Norberto Brude** | `norberto1712@gmail.com` | `+54 9 11 6156-4311` | **Administrador** (acceso total) | Código por mail o App Authenticator |
| `@maria` | **Lic. María Gulín** | `consultorio.kinesica@gmail.com` | `+54 9 11 2853-1224` | **Administrador** (acceso total y clínico) | Código por mail o App Authenticator |
| `@martin` | **Martín Brude** | `martin.brude@gmail.com` | `+34 658 44 49 35` | **Administrador** (soporte técnico y desarrollo) | Código por mail o App Authenticator |
| `@facundo` | **Facundo Vivardo** | `facu86@gmail.com` | `+54 9 11 6484-0132` | **Colaborador** (gestión y soporte) | Código por mail o App Authenticator |

### 🎭 Jerarquía de Roles
- **👑 Administrador (`admin`):** Acceso total a todas las secciones del panel, incluyendo la pestaña **Administración** (`/admin/administracion`), altas, bajas y edición de usuarios, gastos operativos, configuración clínica, simulador de Clara y auditoría.
- **🩺 Profesional (`professional`):** Acceso completo al área operativa y médica: Historias Clínicas (fichas ATM CDI-TTM), Directorio de Pacientes, Consultorio (agenda y honorarios) y Recordatorios.
- **🤝 Colaborador (`colaborador`):** Acceso enfocado en tareas de apoyo, visualización y gestión operativa sin permisos de modificación de credenciales o configuración sensible de administradores.

> [!TIP]
> **Podés ingresar con tu usuario o con tu correo electrónico:**  
> En el casillero **"Usuario"** de la pantalla de acceso podés escribir indistintamente tu nombre de usuario (`norberto`, `maria`, `facundo`) o tu dirección de email completa (`consultorio.kinesica@gmail.com`, etc.).

---

### 👥 Administración de Usuarios y Ficha de Detalle

Desde la pestaña **Administración** (`/admin/administracion`), los administradores disponen de un módulo moderno de gestión de usuarios:

1. **Botón "+ Nuevo usuario":**  
   Permite dar de alta a un profesional o colaborador indicando su nombre, apellido, usuario, correo, teléfono y asignando su rol (`Administrador`, `Profesional` o `Colaborador`). Al crearlo, el sistema le envía automáticamente un correo de bienvenida con un **enlace válido por 48 horas** para definir su contraseña personal.

2. **Tabla Minimalista de Usuarios:**  
   Para mantener la pantalla limpia y legible en cualquier dispositivo, la grilla principal muestra únicamente el **Profesional/Usuario** (avatar y arroba), su **Rol** (badge identificador), su **Estado** (Activo / Inactivo) y el botón **"Ver ficha"**.

3. **Vista Detalle (Ficha de Usuario):**  
   Al presionar **"Ver ficha"**, se abre un modal completo que centraliza la información y las acciones operativas:
   - **Datos de Contacto:** Visualización clara de email y teléfono con botones directos para **copiar al portapapeles** y **abrir chat de WhatsApp (`wa.me`)** en un clic.
   - **Permisos del Rol:** Resumen explicativo de los permisos asignados según su categoría.
   - **Seguridad y Accesos:** Estado del segundo factor de autenticación (2FA enrolado vía App Authenticator o vía correo electrónico), fecha y hora del último ingreso y antigüedad de la cuenta.
   - **Acciones Centralizadas:**
     - ✏️ **Editar datos:** Modificar nombre, teléfono, correo o rol.
     - ✉️ **Enviar acceso:** Dispara al instante un correo seguro para restablecer o crear contraseña.
     - 🚫 / 🔄 **Dar de baja / Reactivar:** Cambia el estado a *Inactivo* (o lo reactiva) sin borrar historiales clínicos ni desvincular registros de pacientes.

---

## 🔐 Dos formas de ingresar: Código por Mail o App Authenticator

Para proteger la confidencialidad médica de las historias clínicas, además de tu usuario y contraseña el sistema pide un **código de seguridad de 6 dígitos (2FA)**. Podés elegir el método que te resulte más cómodo en cada momento:

### 📧 Método 1 (Más simple, sin instalar nada): Código de 6 dígitos por Correo Electrónico
1. Entrá a **[https://www.kinesica.com.ar/admin/](https://www.kinesica.com.ar/admin/)**.
2. Escribí tu **Usuario** (o tu email) y tu **Contraseña**.
3. Debajo del casillero de código, hacé clic en **`¿No tenés la app? Enviame un código al mail`**.
4. En segundos vas a recibir un correo en tu Gmail con el asunto **"Código de acceso a Kinésica"** y un número grande de **6 dígitos** (válido durante **15 minutos** y de un solo uso).
5. Escribí esos 6 dígitos en el campo **"Código"** y hacé clic en **"Entrar"**.

---

### 📱 Método 2 (Opcional, sin esperar correos): App Authenticator en el celular

Si preferís no abrir el correo cada vez que ingresás, podés vincular por única vez una aplicación gratuita en tu teléfono que genera el código de 6 dígitos cada 30 segundos (incluso sin conexión a internet):

#### Paso A: Descargar la app en el celular
- **Opción A (Recomendada): Google Authenticator** ([Android — Play Store](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2) / [iPhone — App Store](https://apps.apple.com/app/google-authenticator/id388497605)).
- **Opción B: Microsoft Authenticator** (si ya la usás en tu teléfono, funciona igual).

#### Paso B: Vincular el Authenticator por primera vez (Enrolamiento)
1. Ingresá a **[https://www.kinesica.com.ar/admin/](https://www.kinesica.com.ar/admin/)**.
2. Escribí tu **Usuario**, tu **Contraseña**, dejá el campo **Código** vacío y tocá **"Entrar"**.
3. Si tu cuenta todavía no tiene un Authenticator vinculado, verás la pantalla **"Código del celular"** con una **clave de configuración** de letras y números agrupados de a cuatro (ej: `ABCD EFGH IJKL MNOP...`).
4. Abrí **Google Authenticator** en tu celular ➔ tocá el botón **`+`** ➔ elegí **"Ingresar clave de configuración"**:
   - **Nombre de la cuenta:** `Kinésica`
   - **Tu clave:** copiá la clave de letras y números que muestra la pantalla.
   - **Tipo de clave:** *"Basada en tiempo"*.
   - Tocá **"Agregar"**.
5. Volvé a la pantalla de Kinésica, escribí tu **Contraseña**, los **6 dígitos** que muestra la app de tu celular y hacé clic en **"Confirmar"**.

*(Recordá que aunque hayas vinculado la app Authenticator, siempre podés seguir usando también el botón **"Enviame un código al mail"** cuando no tengas el teléfono a mano).*

---

## 🔑 Cómo cambiar o recuperar tu contraseña

Si querés cambiar tu contraseña por una nueva o si la olvidaste:

1. En la pantalla de ingreso de **[https://www.kinesica.com.ar/admin/](https://www.kinesica.com.ar/admin/)**, hacé clic en **"Olvidé mi contraseña"** (si ya tenías sesión abierta, primero tocá **"Salir"** arriba a la derecha).
2. Escribí tu usuario (`norberto`, `maria` o `facundo`) o tu correo registrado (`norberto1712@gmail.com`, `consultorio.kinesica@gmail.com`, etc.) y hacé clic en **"Enviar enlace"**.
3. Abrí tu correo en Gmail y buscá el mensaje con asunto:  
   📩 **"Contraseña de Kinésica"**.
4. Hacé clic en el enlace del correo *(por seguridad vence a los 30 minutos; si es un enlace de bienvenida para una cuenta nueva, dura 48 horas)*.
5. En la pantalla que se abre:
   - **Contraseña nueva:** escribí tu nueva clave (debe tener **al menos 10 caracteres**).
   - **Repetir contraseña:** volvé a escribirla igual para confirmar.
   - Hacé clic en **"Guardar contraseña"**.

---

## 🧭 Mapa del Panel de Administración (`/admin/`)

Una vez adentro del sistema, en la barra de navegación contás con las siguientes secciones:

| Pestaña | Ruta directa | Qué podés hacer en esta sección |
| :--- | :--- | :--- |
| **🏠 Inicio** | `/admin/` | Ver de un vistazo el estado general del consultorio, si **Clara (WhatsApp)** y las **Reservas Web** están activas o pausadas (con botones rápidos para alternar al instante) y accesos directos a las tareas más frecuentes. |
| **📋 Historias Clínicas** | `/admin/fichas` | Crear y editar fichas clínicas de **ATM (criterios CDI-TTM)** en 6 pasos (con escala visual EVA y fotos clínicas), comparar la evolución sesión a sesión (**"Comparar sesiones"**) e imprimir o exportar informes A4 en PDF con firma y sello digital. |
| **👥 Pacientes** | `/admin/pacientes` | Consultar el **Directorio Unificado de Pacientes**, buscar por nombre, DNI o teléfono, revisar historial de sesiones y abrir o crear fichas vinculadas con un solo clic. |
| **🕒 Consultorio** | `/admin/consultorio` | Configurar los **horarios de atención** de cada profesional (con control automático de **1 sola camilla física**), el texto visible en el encabezado de la web y los **honorarios vigentes** (`$ ATM`, `$ General` y medios de pago). |
| **💬 Clara & Mensajes** | `/admin/clara` | Editar los textos del menú de Clara (`A` a `E`, submenús, opciones adicionales `F`, `G`... y textos de recordatorios de 24 hs) y probar cómo responde en tiempo real con el **Simulador Interactivo de WhatsApp**. |
| **📱 Interacciones** | `/admin/interacciones` | Auditar las conversaciones de WhatsApp en tiempo real: ver mensajes recibidos, respuestas automáticas de Clara, derivaciones a profesionales (`wa.me`) y filtrar por paciente o fecha. |
| **⏰ Recordatorios** | `/admin/recordatorios` | Supervisar el despacho de recordatorios de 24 hs: ver la previsión de turnos de mañana en **"A enviar"** (detectando a tiempo pacientes sin teléfono cargado), historial de mensajes **"Enviados"** (WhatsApp o Email de contingencia), **"Fallidos"**, **"Omitidos"** (bloqueos como `No dar` o cancelados) y disparar envíos manuales con el botón **`⚡ Disparar manualmente`**. |
| **⚙️ Administración** *(solo rol Admin)* | `/admin/administracion` | Gestión de cuentas del equipo (botón **"+ Nuevo usuario"**, tabla de usuarios, vista detalle con edición, envío de accesos y bajas/reactivaciones), control de **Gastos operativos** (con cotización histórica EUR/USD/ARS) y acceso a Google Sheets y Manual. |
| **📖 Manual** | `/admin/manual.html` | Visualizador centralizado e interactivo de toda la documentación operativa y técnica del consultorio. |

---

## ❓ Preguntas Frecuentes y Solución de Inconvenientes

### 1. El sistema dice "El código no coincide" o "El código venció"
- **Si usás código por mail:** Asegurate de usar el código del **último** correo recibido (cada vez que pedís uno nuevo, el anterior queda invalidado) y dentro de los **15 minutos** de enviado.
- **Si usás Google Authenticator:** Los códigos de la app cambian cada 30 segundos. Si seguís viendo error, verificá que la hora de tu celular esté en automática:
  - *Android:* Ajustes ➔ Sistema (o Fecha y hora) ➔ Activar **"Fecha y hora automáticas"**.
  - *iPhone:* Configuración ➔ General ➔ Fecha y hora ➔ Activar **"Definir automáticamente"**.

### 2. El sistema dice "Demasiados intentos fallidos"
- Si se ingresan datos incorrectos 5 veces seguidas, el sistema protege la cuenta bloqueando nuevos intentos durante **30 minutos** (o **15 minutos** para el envío de códigos por correo). Esperá ese lapso e intentá nuevamente.

### 3. ¿Qué hago si cambié o perdí el teléfono?
- **Para entrar enseguida:** Usá el enlace **"¿No tenés la app? Enviame un código al mail"** en la pantalla de login. Entrás con el código que llega a tu Gmail sin necesitar el teléfono.
- **Para pasar Google Authenticator al teléfono nuevo:** En la app del teléfono viejo tocá el menú ➔ **"Transferir cuentas"** ➔ **"Exportar cuentas"** y escaneá el QR desde el teléfono nuevo. Si no tenés el teléfono viejo, desde **Administración** (o avisándole a Martín) se puede reiniciar la vinculación TOTP.

### 4. ¿Cómo cerrar la sesión de forma segura?
- Al terminar tu jornada, hacé clic en el botón **"Salir"** ubicado arriba a la derecha.

---

## 📋 Resumen Rápido (Checklist)

- [ ] Entré a `kinesica.com.ar/admin/` con mi usuario (o email) y mi contraseña.
- [ ] Elegí cómo validar el segundo paso: **Código por mail** (llega a mi Gmail) o **Google Authenticator** en el celular.
- [ ] Configuré mi contraseña personal de al menos 10 caracteres desde *"Olvidé mi contraseña"* (o desde el enlace de bienvenida).
- [ ] ¡Ya puedo gestionar historias clínicas de ATM, pacientes, horarios, honorarios, recordatorios y administración!
