/**
 * Kinésica - Webhook de Google Apps Script para Reservas Web y Google Calendar
 * ==============================================================================
 * Este script se puede desplegar como una Aplicación Web en Google Apps Script
 * (con permisos para Google Calendar y Google Sheets).
 *
 * Proyecto: https://script.google.com/home/projects/1oDT31aCTKOB35n1kS-iKzVHUn0ILDz8ZlRPwLEyvnnMsOTyZ5AYVebIm/edit
 * Deploy (clasp): npm run gas:login (una vez) → npm run gas:deploy
 * Ver booking/README.md §4.
 *
 * Propiedades del script (consola GAS): CALENDAR_NAME, SPREADSHEET_ID,
 * WHATSAPP_TOKEN, NORBERTO_PHONE, WHATSAPP_PHONE_NUMBER_ID, N8N_ALERT_WEBHOOK_URL,
 * GAS_API_SECRET / WEBHOOK_SECRET, etc.
 */

// Duración y franjas de Kinésica
const CALL_DURATION_MINUTES = 10;
const SESSION_DURATION_MINUTES = 60;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const CALL_BUFFER_HOURS = 1; // Para llamadas de 10m: mínimo 1 hora de anticipación (no ofrecer nada en la siguiente hora)
const SESSION_BUFFER_HOURS = 2; // Para turnos presenciales de 1h: mínimo 2 horas de margen de traslado
const SAME_DAY_BUFFER_HOURS = 2; // Compatibilidad retroactiva
const MAX_BOOKING_DAYS = 60; // Máximo 60 días de anticipación para turnos

// FALLBACK TÉCNICO de horarios (0 domingo … 6 sábado). La única fuente real es el admin
// (settings.php → practitioner_hours), que se lee en runtime con fetchAdminPractitionerHours().
// Este objeto solo se usa si settings.php no responde y no hay caché.
const PRACTITIONER_HOURS = {
  norberto: {
    1: [{ start: "17:30", end: "19:30" }], // Lunes 17:30 a 19:30 hs
    2: [{ start: "16:30", end: "19:30" }], // Martes 16:30 a 19:30 hs
    3: [{ start: "09:00", end: "16:30" }], // Miércoles 9 a 16:30 hs
    4: [{ start: "15:00", end: "19:00" }], // Jueves 15 a 19 hs
    5: [{ start: "13:30", end: "19:30" }]  // Viernes 13:30 a 19:30 hs
  },
  maria: {
    1: [{ start: "09:00", end: "17:00" }], // Lunes 9 a 17 hs
    2: [{ start: "09:00", end: "16:00" }], // Martes 9 a 16 hs
    5: [{ start: "09:00", end: "13:00" }]  // Viernes 9 a 13 hs
  }
};

const ADMIN_SETTINGS_URL_DEFAULT = "https://www.kinesica.com.ar/admin/api/settings.php";
// Secundaria (sin www): por si el host principal rechaza la consulta desde los servidores de Google.
const ADMIN_SETTINGS_URL_SECONDARY = "https://kinesica.com.ar/admin/api/settings.php";
const ADMIN_HOURS_CACHE_KEY = "admin_practitioner_hours_v1";
const ADMIN_HOURS_CACHE_SECONDS = 120;
// Última copia buena de los horarios del admin (persistente): se usa si settings.php no responde.
const ADMIN_HOURS_LAST_GOOD_PROP = "ADMIN_HOURS_LAST_GOOD";
const GAS_CODE_VERSION = "v31-confirm-hmac-token";
const BOOKING_IDEMPOTENCY_PREFIX = "booking_result_v1_";
