/**
 * Render de filas, encabezados de día y pager de Recordatorios.
 * Paginación: ventana ayer–hoy–mañana; el resto, un día por página.
 */

import { escapeHtml } from "./dom.js?v=79";
import { formatDisplayPhone, extractPhoneCandidate } from "./phone-format.js";
import { capitalizePersonName } from "./pacientes-format.js";

/** Radio de la ventana principal: 1 día atrás y 1 adelante respecto de hoy (AR). */
export const RECORDATORIOS_DAY_RADIUS = 1;

export function todayISOArgentina() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function addDaysISO(iso, delta) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function itemDay(item) {
  return String(item?.run_day || item?.appointment_date || "sin-fecha").trim() || "sin-fecha";
}

/**
 * Página 0: días en [hoy−1, hoy+1]. Páginas siguientes: un día cada una.
 */
export function buildRecordatorioPages(items, { radius = RECORDATORIOS_DAY_RADIUS } = {}) {
  const list = Array.isArray(items) ? items : [];
  const byDay = new Map();
  for (const item of list) {
    const day = itemDay(item);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(item);
  }

  const dated = [...byDay.keys()]
    .filter((d) => d !== "sin-fecha" && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort((a, b) => b.localeCompare(a));
  const sinFecha = byDay.get("sin-fecha") || [];

  const today = todayISOArgentina();
  const min = addDaysISO(today, -Math.abs(radius));
  const max = addDaysISO(today, Math.abs(radius));
  // Más reciente primero (hoy antes que ayer; sábado antes que viernes).
  const nearDays = dated.filter((d) => d >= min && d <= max).sort((a, b) => b.localeCompare(a));
  const otherDays = dated.filter((d) => d < min || d > max);

  const pages = [];
  if (nearDays.length) {
    pages.push({
      key: "near",
      label: "Ayer · Hoy · Mañana",
      days: nearDays,
      items: nearDays.flatMap((d) => byDay.get(d) || []),
    });
  }
  for (const d of otherDays) {
    pages.push({
      key: d,
      label: formatRunDayHeader(d),
      days: [d],
      items: byDay.get(d) || [],
    });
  }
  if (sinFecha.length) {
    pages.push({
      key: "sin-fecha",
      label: "Sin fecha",
      days: ["sin-fecha"],
      items: sinFecha,
    });
  }
  return pages;
}

export function formatRunDayHeader(isoDay) {
  if (!isoDay || isoDay === "sin-fecha") return "Sin fecha";
  try {
    const [y, m, d] = isoDay.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDay;
  }
}

export function isAppointmentPast(apptDate, apptTime) {
  if (!apptDate) return false;
  let timeStr = "23:59:59";
  if (apptTime) {
    const m = String(apptTime).match(/(\d{1,2}):(\d{2})/);
    if (m) {
      timeStr = m[1].padStart(2, "0") + ":" + m[2] + ":00";
    }
  }
  // Buenos Aires es UTC-3 sin horario de verano
  const isoStr = apptDate + "T" + timeStr + "-03:00";
  const apptDt = new Date(isoStr);
  if (Number.isNaN(apptDt.getTime())) return false;
  return apptDt.getTime() < Date.now();
}

