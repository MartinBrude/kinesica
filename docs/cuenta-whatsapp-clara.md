# Primer paso: la cuenta de WhatsApp de Clara

> Guía para crear el número y la cuenta de WhatsApp de Clara, en tu teléfono o en otro.  
> 📖 **Manual de Clara:** [Ver Manual Operativo](MANUAL_CLARA.md) ([Enlace en GitHub](https://github.com/MartinBrude/kinesica/blob/main/docs/manual-clara.md))

---

Clara atiende por un número de WhatsApp propio, distinto del tuyo. Tu línea de siempre sigue en tu teléfono, con tu WhatsApp de siempre.

Alcanza con **un chip prepago nuevo o una eSIM prepaga**. Ese número es solo de Clara. Se usa una única vez: para recibir el mensaje de texto con el código de activación. Después el chip se puede guardar.

Elegí uno de estos dos caminos.

## En tu teléfono

Este camino te deja ver en el momento lo que Clara habla con los pacientes, y responder vos cuando quieras.

1. Seguí usando tu WhatsApp actual para tus mensajes personales.
2. En el mismo teléfono, descargá **WhatsApp Business**. Sirve en Android y en iPhone.
3. Abrila e ingresá el número nuevo de Clara.
4. Te va a pedir un código de 6 dígitos. Ese código llega por mensaje de texto al número de Clara:
   - **Chip físico:** ponelo un momento en cualquier otro teléfono (uno viejo alcanza), solo para leer el mensaje. Anotá el código, volvé a tu teléfono y escribilo en WhatsApp Business.
   - **eSIM:** si tu teléfono la acepta, pedí una eSIM prepaga (por ejemplo en Tuenti) e instalala en tu teléfono. El mensaje llega ahí, sin cambiar de chip.
5. Listo. En la pantalla quedan dos aplicaciones:
   - **WhatsApp**, para tus chats personales.
   - **WhatsApp Business**, para Clara y la atención de los pacientes.

Con la cuenta ya activada, el chip de Clara se puede retirar y guardar. Tu teléfono puede seguir solo con tu línea de siempre.

## En otro teléfono

Este camino deja la cuenta de Clara en un aparato aparte: un teléfono viejo o uno de repuesto.

1. Conseguí el chip prepago o la eSIM de Clara.
2. Poné ese chip, o instalá esa eSIM, en el otro teléfono.
3. Descargá **WhatsApp Business** en ese teléfono.
4. Activala con el número de Clara. El código de 6 dígitos llega por mensaje a ese mismo teléfono: lo leés y lo ingresás ahí.
5. Ese teléfono queda para la atención del consultorio.
6. En tu teléfono, con tu WhatsApp de siempre, agendá el número de Clara como un contacto. Desde ahí le escribís, la supervisás, o armás un grupo donde ella responda.

Cuando esa cuenta esté activa, los pacientes escriben a ese número.

---

## 🚀 Conectar el nuevo número a Meta y Salir a Producción

Cuando tengas el nuevo número activo para Clara, el cambio a producción se hace en 4 pasos:

### 1. Registrar el número en Meta for Developers
1. Entrá a [developers.facebook.com](https://developers.facebook.com/) → Tu app de Kinésica.
2. En el menú izquierdo: **WhatsApp** → **Configuración de la API** (*API Setup*).
3. En **Paso 1: Seleccionar números de teléfono**, hacé clic en **"Administrar"** o **"Agregar número de teléfono"** (en *WhatsApp Manager*).
4. Completá el nombre para mostrar (*Clara | Kinésica*), categoría (*Atención médica*) y el nuevo número.
5. Recibí el código de 6 dígitos por SMS/llamada en ese número y verificalo.
6. Copiá el nuevo **Identificador de número de teléfono** (*Phone Number ID*).

### 2. Generar el Token Permanente (System User Token)
Para que el token no venza cada 24 horas:
1. En [business.facebook.com/settings](https://business.facebook.com/settings) → **Usuarios del sistema** (*System Users*).
2. Creá o seleccioná un usuario del sistema (ej: `Clara Admin`).
3. En **Activos asignados**, asignale tu cuenta de WhatsApp con control total.
4. Hacé clic en **"Generar nuevo token"**, seleccioná la app y marcá los permisos:
   * `whatsapp_business_messaging`
   * `whatsapp_business_management`
5. Copiá el token generado (este no vence).

### 3. Actualizar la configuración en el Bot (`kinesica-bot`)
1. En `secrets.env`:
   * Actualizá `WHATSAPP_PHONE_NUMBER_ID=<nuevo_id>`.
2. En n8n:
   * En **Credentials** → **WhatsApp Cloud API Token**, pegá el nuevo token permanente.
3. Ejecutá el deploy de los workflows:
   ```bash
   python3 deploy.py
   ```

### 4. Actualizar la Web y Google Apps Script (`kinesica`)
1. En Google Apps Script (*Propiedades de la secuencia de comandos*):
   * `WHATSAPP_TOKEN`: El nuevo token permanente.
   * `WHATSAPP_PHONE_NUMBER_ID`: El nuevo Phone Number ID.
2. En el sitio web (`kinesica`):
   * En `scripts/site-contact.mjs`, cambiá `whatsappDigits` al nuevo número de Clara para que los botones de WhatsApp de la web lleven a Clara.
   * Ejecutá:
     ```bash
     npm run assets:build
     ```
   * Hacé commit y push a GitHub para que impacte en producción.
