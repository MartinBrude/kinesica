/**
 * Kinésica GAS — Anulación de turnos y aviso al profesional.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

/**
 * Anula un turno en Google Calendar (mismo camino operativo que Clara / web mi-turno).
 * Requiere secret. Opcional: notifica al profesional y a n8n (lista de espera).
 */
function handleCancelAppointment(payload) {
  const eventId = String(payload.eventId || payload.calendar_event_id || "").trim();
  if (!eventId) {
    return createJsonResponse({ status: "error", message: "eventId requerido" }, 400);
  }

  const cal = getKinesicaCalendar();
  let event = null;
  try {
    event = cal.getEventById(eventId);
  } catch (errFind) {
    event = null;
  }
  if (!event) {
    // Idempotente: si ya no está, consideramos OK para que la web cierre el ciclo.
    try {
      mirrorTurnoCancelToAdmin(eventId);
    } catch (eMirror) {}
    return createJsonResponse({
      status: "success",
      action: "cancel",
      eventId: eventId,
      alreadyGone: true,
      message: "El evento ya no estaba en el calendario"
    });
  }

  const title = event.getTitle() || "";
  const start = event.getStartTime();
  const pacienteHint = String(payload.paciente || "").trim();
  const fechaHint = String(payload.fecha || "").trim();
  const horaHint = String(payload.hora || "").trim();
  const practitionerHint = String(
    payload.practitionerId || payload.practitioner || ""
  ).trim().toLowerCase();

  try {
    event.deleteEvent();
  } catch (errDel) {
    // Fallback: marcar cancelado si delete falla
    try {
      if (title.indexOf("[CANCELADO]") === -1) {
        event.setTitle("[CANCELADO] " + title);
      }
    } catch (errMark) {
      return createJsonResponse({ status: "error", message: String(errDel) }, 500);
    }
  }

  try {
    mirrorTurnoCancelToAdmin(eventId);
  } catch (eMirror2) {}

  try {
    notifyPractitionerWebCancel({
      eventId: eventId,
      title: title,
      start: start,
      paciente: pacienteHint,
      fecha: fechaHint,
      hora: horaHint,
      practitionerId: practitionerHint || parsePractitionerIdFromTitle(title),
      source: String(payload.source || "web_mi_turno")
    });
  } catch (eNotify) {
    console.warn("notifyPractitionerWebCancel: " + eNotify);
  }

  return createJsonResponse({
    status: "success",
    action: "cancel",
    eventId: eventId,
    message: "Turno anulado"
  });
}

function mirrorTurnoCancelToAdmin(eventId) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("TURNOS_MIRROR_URL")
    || "https://www.kinesica.com.ar/admin/api/turnos.php";
  const secret = props.getProperty("GAS_API_SECRET") || props.getProperty("WEBHOOK_SECRET") || "";
  if (!secret || !eventId) return;
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      action: "cancel",
      secret: secret,
      eventId: String(eventId),
      source: "gas"
    }),
    muteHttpExceptions: true,
    followRedirects: true
  });
}

function notifyPractitionerWebCancel(data) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("WHATSAPP_TOKEN") || props.getProperty("META_ACCESS_TOKEN");
  const phoneId = props.getProperty("WHATSAPP_PHONE_NUMBER_ID") || "1340013275870491";
  const n8nWebhookUrl = props.getProperty("N8N_ALERT_WEBHOOK_URL");

  // Prefer payload practitionerId; fall back to [NORBERTO]/[MARIA] in Calendar title.
  const practitionerId = String(
    data.practitionerId || data.practitioner || parsePractitionerIdFromTitle(data.title || "") || "norberto"
  ).toLowerCase();
  const contact = resolvePractitionerContact(practitionerId);
  const toPhone = contact.phone;

  let whenLabel = "";
  if (data.fecha && data.hora) {
    whenLabel = data.fecha + " " + data.hora + " hs";
  } else if (data.start) {
    try {
      whenLabel = Utilities.formatDate(data.start, "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm") + " hs";
    } catch (e) {
      whenLabel = String(data.start);
    }
  }

  const message = "❌ *TURNO ANULADO (WEB)*\n" +
    "• *Profesional:* " + contact.name + "\n" +
    "• *Paciente:* " + (data.paciente || data.title || "—") + "\n" +
    "• *Fecha/Hora:* " + (whenLabel || "—") + "\n" +
    "• *Origen:* " + (data.source || "web_mi_turno") + "\n" +
    "• *Evento:* " + (data.eventId || "—") + "\n\n" +
    "_(El paciente anuló desde kinesica.com.ar/mi-turno)_";

  let sent = false;
  if (token && toPhone) {
    try {
      const url = "https://graph.facebook.com/v21.0/" + phoneId + "/messages";
      const res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: toPhone,
          type: "text",
          text: { body: message }
        }),
        muteHttpExceptions: true,
        deadline: 8
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) sent = true;
    } catch (e) {
      console.warn("cancel WA alert: " + e);
    }
  }

  if (n8nWebhookUrl) {
    try {
      UrlFetchApp.fetch(n8nWebhookUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          action: "web_cancel_alert",
          body: message,
          eventId: data.eventId || "",
          practitionerId: contact.id,
          booking: data
        }),
        muteHttpExceptions: true,
        deadline: 8
      });
    } catch (e2) {
      console.warn("cancel n8n alert: " + e2);
    }
  }

  return sent;
}
