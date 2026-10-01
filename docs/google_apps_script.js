/**
 * Kinésica - Webhook de Google Sheets para Primeras Sesiones y Actualización de Pacientes
 * ======================================================================================
 * Este script se vincula a la hoja de Google Sheets de Kinésica:
 * https://docs.google.com/spreadsheets/d/1kyGkYea0Iu_OrXxF-yONqhs2rG1O8YUWbbSmQe37GCk/edit
 *
 * Configuración en Google Apps Script:
 * 1. Abrir: https://script.google.com/u/0/home/projects/1LgkvfR8vL03ZaePCQFdkUipWDeuYVrUGr329NKctPQfqSTCLB2iVR0mz/edit
 * 2. Reemplazar el código del archivo Código.gs con este script.
 * 3. Hacer clic en "Implementar" -> "Administrar implementaciones" -> Editar -> Nueva versión -> Implementar.
 *
 * Soporta dos acciones principales enviadas por Clara (n8n) y agente_base_datos.py:
 * 1. "insert": Agrega un nuevo paciente de primera sesión presencial (sin duplicar).
 * 2. "update_name": Busca al paciente por número de teléfono y actualiza su Nombre y Apellido.
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "No post data received" });
    }

    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    const action = payload.action || "insert";

    if (action === "update_name") {
      return handleUpdateName(sheet, payload);
    } else {
      return handleInsertPatient(sheet, payload);
    }

  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * Maneja la actualización del nombre de un paciente existente.
 * Busca por coincidencia de los últimos 8 dígitos del teléfono.
 */
function handleUpdateName(sheet, payload) {
  const rawTargetPhone = String(payload.telefono || "").replace(/[^0-9]/g, "");
  const targetLast8 = rawTargetPhone.slice(-8);
  const nuevoNombre = (payload.nuevo_nombre || payload.nombre_apellido || "").trim();

  if (!nuevoNombre) {
    return createJsonResponse({ status: "error", message: "Nuevo nombre no proporcionado" });
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
  const nombre = (payload.nombre_apellido || "").trim();
  const dni = (payload.dni || "No provisto").trim();
  const telefono = String(payload.telefono || "").trim();
  const fecha = (payload.fecha_primera_sesion || "").trim();
  const motivo = (payload.motivo_consulta || "Consulta general").trim();

  if (!nombre) {
    return createJsonResponse({ status: "error", message: "Nombre no proporcionado" });
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

function doGet(e) {
  return createJsonResponse({
    status: "online",
    service: "Kinésica Patients Webhook",
    timestamp: new Date().toISOString()
  });
}

/**
 * Genera la salida JSON para la Web App de Google Apps Script.
 * Nota: ContentService siempre responde con HTTP 200 en Apps Script;
 * el estado lógico se comunica mediante la propiedad "status" del cuerpo JSON.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
