/**
 * Kinésica - Webhook de Google Sheets para Primeras Sesiones y Actualización de Pacientes
 * ======================================================================================
 * Este script se vincula a la hoja de Google Sheets de Kinésica:
 * https://docs.google.com/spreadsheets/d/1kyGkYea0Iu_OrXxF-yONqhs2rG1O8YUWbbSmQe37GCk/edit
 *
 * Configuración en Google Apps Script:
 * 1. Abrir: https://script.google.com/u/0/home/projects/1LgkvfR8vL03ZaePCQFdkUipWDeuYVrUGr329NKctPQfqSTCLB2iVR0mz/edit
 * 2. Reemplazar el código del archivo Código.gs con este script.
 * 3. En Configuración del proyecto → Propiedades de la secuencia de comandos,
 *    crear WEBHOOK_SECRET con el valor de secrets.env (no está en este archivo).
 * 4. Hacer clic en "Implementar" -> "Administrar implementaciones" -> Editar -> Nueva versión -> Implementar.
 *
 * Soporta tres acciones principales enviadas por Clara (n8n) y agente_base_datos.py:
 * 1. "insert": Agrega un nuevo paciente de primera sesión presencial (sin duplicar).
 * 2. "update_name": Busca al paciente por número de teléfono y actualiza su Nombre y Apellido.
 * 3. "send_email": Envía correo de contingencia a Norberto (MailApp) si falla WhatsApp.
 *
 * NOTA IMPORTANTE — Códigos de estado HTTP:
 * Google Apps Script NO permite controlar el código HTTP de respuesta en doPost().
 * ContentService siempre devuelve HTTP 200, independientemente del resultado.
 * El éxito o rechazo de cada llamada se comunica EXCLUSIVAMENTE a través del campo
 * "status" en el JSON de respuesta: "success", "error", "not_found" o "already_exists".
 * El cliente (n8n / agente_base_datos.py) debe leer el cuerpo JSON para determinar
 * el resultado, no el código HTTP.
 * Ejemplo de rechazo por secreto inválido: HTTP 200 con { status: "error", message: "Unauthorized: Invalid secret" }
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "No post data received" }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    // Verificación de Secreto de Seguridad (Previene accesos no autorizados al Webhook)
    const WEBHOOK_SECRET = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (!WEBHOOK_SECRET || !payload.secret || payload.secret !== WEBHOOK_SECRET) {
      return createJsonResponse({ status: "error", message: "Unauthorized: Invalid secret" }, 401);
    }

    const action = payload.action || "insert";

    if (action === "update_name") {
      return handleUpdateName(sheet, payload);
    } else if (action === "send_email") {
      return handleSendEmail(payload);
    } else if (action === "get_directory") {
      return handleGetDirectory(sheet);
    } else {
      return handleInsertPatient(sheet, payload);
    }

  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

/**
 * Maneja el envío de correos electrónicos de contingencia a Norberto
 * cuando WhatsApp no está disponible o falla la entrega de mensajes.
 * SEGURIDAD CRÍTICA: Restringido estrictamente a la casilla oficial de Norberto
 * para evitar que el script actúe como un open relay de spam/phishing.
 */
function handleSendEmail(payload) {
  const OFFICIAL_RECIPIENT = "norberto1712@gmail.com";
  const to = OFFICIAL_RECIPIENT; // Destino único inviolable
  const subject = payload.subject || "🚨 [KINÉSICA] Alerta Operativa / Falla en WhatsApp";
  const body = payload.body || payload.message || "Aviso de contingencia de Kinésica Bot.";

  const mailOptions = {
    to: to,
    subject: subject,
    body: body
  };

  if (payload.htmlBody) {
    mailOptions.htmlBody = payload.htmlBody;
  }

  MailApp.sendEmail(mailOptions);

  return createJsonResponse({
    status: "success",
    action: "send_email",
    recipient: to,
    subject: subject
  });
}

/**
 * Maneja la actualización del nombre de un paciente existente.
 * Busca por coincidencia de los últimos 8 dígitos del teléfono.
 */
/**
 * Sanitiza campos de texto para mitigar ataques de inyección de fórmulas en hojas de cálculo (CWE-1236).
 * Si el valor inicia con caracteres interpretables por hojas de cálculo (=, +, -, @, \t, \r),
 * antepone un apóstrofe (') para forzar su interpretación como texto plano.
 */
function sanitizeFormulaInjection(value) {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

function handleUpdateName(sheet, payload) {
  const rawTargetPhone = String(payload.telefono || "").replace(/[^0-9]/g, "");
  const targetLast8 = rawTargetPhone.slice(-8);
  const nuevoNombre = sanitizeFormulaInjection((payload.nuevo_nombre || payload.nombre_apellido || "").trim());

  if (!nuevoNombre) {
    return createJsonResponse({ status: "error", message: "Nuevo nombre no proporcionado" }, 400);
  }

  const data = sheet.getDataRange().getValues();
  let updatedRows = 0;

  // Recorrer filas (omitiendo cabecera en fila 0)
  for (let i = 1; i < data.length; i++) {
    const rowPhone = String(data[i][2] || "").replace(/[^0-9]/g, "");
    const rowLast8 = rowPhone.slice(-8);

    // Comparar últimos 8 dígitos del teléfono o inclusión
    if (targetLast8 && (rowLast8 === targetLast8 || rowPhone.includes(rawTargetPhone) || rawTargetPhone.includes(rowPhone))) {
      const rowNumber = i + 1; // 1-indexed para SpreadsheetApp
      sheet.getRange(rowNumber, 1).setValue(nuevoNombre);
      updatedRows++;
    }
  }

  if (updatedRows > 0) {
    return createJsonResponse({
      status: "success",
      action: "update_name",
      updatedRows: updatedRows,
      nuevo_nombre: nuevoNombre
    });
  } else {
    return createJsonResponse({
      status: "not_found",
      message: "No se encontró ningún paciente con el teléfono provisto para actualizar nombre."
    });
  }
}

/**
 * Maneja el registro de una nueva primera sesión presencial.
 */
function handleInsertPatient(sheet, payload) {
  const nombre = sanitizeFormulaInjection((payload.nombre_apellido || "").trim());
  const dni = sanitizeFormulaInjection((payload.dni || "No provisto").trim());
  const telefono = String(payload.telefono || "").trim();
  const fecha = sanitizeFormulaInjection((payload.fecha_primera_sesion || "").trim());
  const motivo = sanitizeFormulaInjection((payload.motivo_consulta || "Consulta general").trim());

  if (!nombre) {
    return createJsonResponse({ status: "error", message: "Nombre no proporcionado" }, 400);
  }

  const data = sheet.getDataRange().getValues();
  const cleanPhone = telefono.replace(/[^0-9]/g, "");
  const cleanLast8 = cleanPhone.slice(-8);

  // Evitar duplicados por teléfono y fecha
  for (let i = 1; i < data.length; i++) {
    const existingPhone = String(data[i][2] || "").replace(/[^0-9]/g, "");
    const existingDate = String(data[i][3] || "").trim();
    if (cleanLast8 && existingPhone.slice(-8) === cleanLast8 && existingDate === fecha) {
      return createJsonResponse({
        status: "already_exists",
        message: "El paciente ya se encuentra registrado con esa fecha de sesión."
      });
    }
  }

  // Asegurar formato de texto para el teléfono (con comilla inicial para no perder el +)
  const phoneFormatted = telefono.startsWith("'") ? telefono : "'" + telefono;

  // Insertar nueva fila
  sheet.appendRow([nombre, dni, phoneFormatted, fecha, motivo]);

  const lastRow = sheet.getLastRow();
  const rowRange = sheet.getRange(lastRow, 1, 1, 5);

  // Formato estético Kinésica para filas de datos
  rowRange.setVerticalAlignment("middle");
  if (lastRow % 2 === 0) {
    rowRange.setBackground("#F4F9F5"); // Verde menta muy suave para filas pares
  } else {
    rowRange.setBackground("#FFFFFF");
  }

  return createJsonResponse({
    status: "success",
    action: "insert",
    row: lastRow,
    data: { nombre, dni, telefono: phoneFormatted, fecha, motivo }
  });
}

/**
 * Devuelve el directorio de pacientes registrado en la planilla de Google Sheets
 * en formato { "nombre normalizado": "telefono" } para resolución automática de recordatorios.
 */
function handleGetDirectory(sheet) {
  const data = sheet.getDataRange().getValues();
  const directory = {};
  const emails = {};
  for (let i = 1; i < data.length; i++) {
    const rawName = String(data[i][0] || "").trim();
    const cleanName = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const rawPhone = String(data[i][2] || "").replace(/[^0-9]/g, '');
    let email = "";
    for (let c = 0; c < data[i].length; c++) {
      const value = String(data[i][c] || "").trim();
      if (isValidEmailAddress(value)) {
        email = value.toLowerCase();
        break;
      }
    }
    if (cleanName && rawPhone && rawPhone.length >= 8) {
      let phone = rawPhone;
      if (phone.startsWith('549') && phone.length >= 12) phone = phone.substring(0, 13);
      else if (phone.startsWith('54') && !phone.startsWith('549') && phone.length >= 12) phone = '549' + phone.slice(2, 12);
      else if (phone.startsWith('11') && phone.length === 10) phone = '549' + phone;
      directory[cleanName] = phone;
    }
    if (cleanName && email) {
      emails[cleanName] = email;
    }
  }
  return createJsonResponse({
    status: "success",
    action: "get_directory",
    total: Object.keys(directory).length,
    directory: directory,
    emails: emails
  });
}

function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    if (params && params.action === "get_directory") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getActiveSheet();
      return handleGetDirectory(sheet);
    }
  } catch (err) {}
  return createJsonResponse({
    status: "online",
    service: "Kinésica Patients Webhook",
    timestamp: new Date().toISOString()
  });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
