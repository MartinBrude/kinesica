/**
 * Kinésica GAS — Prueba de notificación y sincronización del respaldo del calendario.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

/**
 * Función de prueba para verificar el envío desde el editor de Google Apps Script:
 * 1. Seleccioná "testNotifyNorberto" en el menú desplegable superior.
 * 2. Hacé clic en "Ejecutar".
 * 3. En el Registro de ejecución verás si el WhatsApp llegó con éxito o el error exacto de Meta.
 */
function testNotifyNorberto() {
  const result = notifyPractitionerNewWebBooking("norberto", {
    appointmentType: "call",
    nombre: "Paciente de Prueba",
    telefono: "5491161564311",
    dni: "12345678",
    date: "2026-10-15",
    time: "10:00",
    motivo: "Prueba de notificación WhatsApp Norberto",
    isMenor: false,
    nombreFamiliar: "",
    notas: "Mensaje de prueba generado desde el editor de Apps Script"
  });
  console.log("Resultado del test: " + (result ? "✅ ENVIADO POR WHATSAPP EXITOSAMENTE" : "⚠️ NO SE PUDO ENVIAR POR WHATSAPP (Se activó el email de contingencia)"));
}

/**
 * Sincroniza la fotografía de bloques ocupados (próximos 60 días) hacia el respaldo en kinesica.com.ar
 * y reconcilia automáticamente cualquier turno tomado en Modo Respaldo que esté pendiente de impacto.
 */
function syncCalendarBackupToServer() {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty("GAS_API_SECRET") || props.getProperty("WEBHOOK_SECRET") || "";
  const backupUrl = props.getProperty("CALENDAR_BACKUP_URL") || "https://www.kinesica.com.ar/admin/api/calendar_backup.php";
  if (!secret) {
    console.warn("[calendar_backup] Falta GAS_API_SECRET o WEBHOOK_SECRET en ScriptProperties para push_snapshot.");
    return { status: "skipped", reason: "missing_secret" };
  }

  const cal = getKinesicaCalendar();
  const now = new Date();
  const end = new Date(now.getTime() + MAX_BOOKING_DAYS * 24 * 3600 * 1000);
  const events = cal.getEvents(now, end);
  const busyIntervals = events.map(function (ev) {
    return {
      start: ev.getStartTime().getTime(),
      end: ev.getEndTime().getTime()
    };
  });

  const res = UrlFetchApp.fetch(backupUrl, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: {
      "X-Webhook-Secret": secret
    },
    payload: JSON.stringify({
      action: "push_snapshot",
      secret: secret,
      busy_intervals: busyIntervals
    })
  });

  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    console.warn("[calendar_backup] push_snapshot devolvió HTTP " + res.getResponseCode());
    return { status: "error", code: res.getResponseCode() };
  }

  let data = null;
  try {
    data = JSON.parse(res.getContentText());
  } catch (e) {
    return { status: "error", reason: "invalid_json" };
  }

  const pending = (data && Array.isArray(data.pending_to_reconcile)) ? data.pending_to_reconcile : [];
  const syncedIds = [];
  pending.forEach(function (entry) {
    if (!entry || !entry.payload) return;
    try {
      const p = Object.assign({}, entry.payload, { from_backup_server: true });
      const out = JSON.parse(handleBookAppointment(p).getContent());
      if (out && out.status === "success" && entry.bookingRequestId) {
        syncedIds.push(entry.bookingRequestId);
      }
    } catch (reconcileErr) {
      console.error("[calendar_backup] Error al reconciliar reserva " + entry.bookingRequestId + ": " + reconcileErr);
    }
  });

  if (syncedIds.length > 0) {
    try {
      UrlFetchApp.fetch(backupUrl, {
        method: "post",
        contentType: "application/json",
        muteHttpExceptions: true,
        headers: { "X-Webhook-Secret": secret },
        payload: JSON.stringify({
          action: "push_snapshot",
          secret: secret,
          busy_intervals: busyIntervals,
          synced_request_ids: syncedIds
        })
      });
    } catch (e) {}
  }

  return { status: "success", busyCount: busyIntervals.length, reconciled: syncedIds.length };
}

/**
 * Ejecutá esta función UNA SOLA VEZ desde el editor de Google Apps Script para dejar instalado
 * el sincronizador automático cada 15 minutos hacia el espejo de respaldo de Kinésica.
 */
function installCalendarBackupTriggers() {
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach(function (t) {
    if (t.getHandlerFunction() === "syncCalendarBackupToServer") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("syncCalendarBackupToServer")
    .timeBased()
    .everyMinutes(15)
    .create();
  return "Trigger syncCalendarBackupToServer instalado (cada 15 min).";
}
