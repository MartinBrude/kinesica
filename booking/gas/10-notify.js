/**
 * Kinésica GAS — Espejo de turnos al admin y avisos de nuevas reservas (WhatsApp/mail).
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

/**
 * POST action=register a admin/api/turnos.php (secret = GAS_API_SECRET / WEBHOOK_SECRET).
 * Script property opcional: TURNOS_MIRROR_URL (default producción).
 */
function mirrorTurnoToAdmin(data) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("TURNOS_MIRROR_URL")
    || "https://www.kinesica.com.ar/admin/api/turnos.php";
  const secret = props.getProperty("GAS_API_SECRET") || props.getProperty("WEBHOOK_SECRET") || "";
  if (!secret || !data || !data.eventId) {
    return;
  }
  const payload = {
    action: "register",
    secret: secret,
    eventId: String(data.eventId || ""),
    date: String(data.date || ""),
    time: String(data.time || ""),
    nombre: String(data.nombre || ""),
    telefono: String(data.telefono || ""),
    dni: String(data.dni || ""),
    practitionerId: String(data.practitionerId || ""),
    summary: String(data.summary || ""),
    source: "gas"
  };
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true
  });
}

/**
 * Teléfono y mail del profesional que atiende el turno.
 * María se configura en las propiedades del script: MARIA_PHONE y MARIA_EMAIL.
 */
function resolvePractitionerContact(practitionerId) {
  const props = PropertiesService.getScriptProperties();
  if (practitionerId === "maria") {
    return {
      id: "maria",
      name: "María",
      phone: props.getProperty("MARIA_PHONE") || "541128531224",
      email: props.getProperty("MARIA_EMAIL") || "manosmagicas7116@gmail.com"
    };
  }
  return {
    id: "norberto",
    name: "Norberto",
    phone: props.getProperty("NORBERTO_PHONE") || "541161564311",
    email: props.getProperty("NORBERTO_EMAIL") || "norberto1712@gmail.com"
  };
}

/**
 * Avisa al profesional del turno por WhatsApp y, si no sale, por mail.
 */
function notifyPractitionerNewWebBooking(practitionerId, data) {
  const contact = resolvePractitionerContact(practitionerId);
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("WHATSAPP_TOKEN") || props.getProperty("META_ACCESS_TOKEN");
  const phoneId = props.getProperty("WHATSAPP_PHONE_NUMBER_ID") || "1340013275870491";
  const n8nWebhookUrl = props.getProperty("N8N_ALERT_WEBHOOK_URL");

  const tipoDetalle = data.appointmentType === "session"
    ? "🩺 Turno presencial en consultorio (60 min)"
    : "📞 Llamada de orientación previa (10 min)";

  const cleanPhone = String(data.telefono || "").replace(/[^0-9]/g, "");
  const waLink = cleanPhone ? ("wa.me/" + cleanPhone) : "No provisto";
  const fechaAmigable = formatFriendlyDate(data.date);

  let message = "📌 *NUEVA RESERVA PARA " + contact.name.toUpperCase() + "*\n" +
    "• *Profesional:* " + contact.name + "\n" +
    "• *Tipo:* " + tipoDetalle + "\n" +
    "• *Paciente:* " + data.nombre + "\n" +
    "• *Fecha y Hora:* " + fechaAmigable + " a las " + data.time + " hs\n" +
    "• *WhatsApp:* " + waLink + "\n" +
    "• *DNI:* " + (data.dni || "No provisto") + "\n" +
    "• *Especialidad:* " + (data.especialidad || data.technique || data.motivo || "No especifica");

  if (data.isMenor && data.nombreFamiliar) {
    message += "\n• *Adulto Responsable (Menor):* " + data.nombreFamiliar;
  }
  if (data.notas) {
    message += "\n• *Notas del paciente:* " + data.notas;
  }
  message += "\n\n*(Agendado automáticamente a través de kinesica.com.ar/turnos.html)*";

  let sent = false;

  // 1. Envío directo mediante Meta WhatsApp Cloud API (Graph v21.0)
  if (token && contact.phone) {
    try {
      const url = "https://graph.facebook.com/v21.0/" + phoneId + "/messages";
      const res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: {
          "Authorization": "Bearer " + token
        },
        payload: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: contact.phone,
          type: "text",
          text: { body: message }
        }),
        muteHttpExceptions: true,
        deadline: 8
      });
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        sent = true;
      } else {
        console.warn("Meta WhatsApp Cloud API devolvió código " + code + ": " + res.getContentText());
      }
    } catch (e) {
      console.error("Excepción al despachar WhatsApp a " + contact.name + ": " + e.toString());
    }
  }

  // 2. Envío secundario mediante Webhook n8n (si está configurado N8N_ALERT_WEBHOOK_URL)
  if (!sent && n8nWebhookUrl) {
    try {
      const res = UrlFetchApp.fetch(n8nWebhookUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          action: "web_booking_alert",
          to: contact.phone,
          body: message,
          booking: data
        }),
        muteHttpExceptions: true,
        deadline: 8
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        sent = true;
      }
    } catch (e) {
      console.error("Excepción al despachar webhook de n8n: " + e.toString());
    }
  }

  // 3. Resguardo por Correo Electrónico (Zero-Ghosting garantizado si WhatsApp no estuviese disponible)
  if (!sent) {
    try {
      if (!contact.email) {
        console.error("Sin mail de respaldo para " + contact.name + ". Configurá MARIA_EMAIL o NORBERTO_EMAIL.");
      } else {
      const cleanSubject = "📌 [KINÉSICA] Reserva para " + contact.name + ": " + data.nombre + " - " + fechaAmigable + " " + data.time + " hs";
      const plainBody = message.replace(/\*([^*]+)\*/g, "$1");
      MailApp.sendEmail({
        to: contact.email,
        subject: cleanSubject,
        body: plainBody
      });
      }
    } catch (e) {
      console.error("Excepción en MailApp fallback: " + e.toString());
    }
  }

  return sent;
}

/**
 * Formatea una fecha YYYY-MM-DD en texto legible en español (ej: "Jueves 08/10")
 */
function formatFriendlyDate(dateStr) {
  try {
    const parts = dateStr.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return dias[d.getDay()] + " " + parts[2] + "/" + parts[1];
  } catch (e) {
    return dateStr;
  }
}

function createJsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
