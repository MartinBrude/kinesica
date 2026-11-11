/**
 * Frecuencia de publicación automática (días ISO 1–7 + hora AR).
 */
import { api } from "./api.js?v=79";

const DAY_LABELS = [
  { iso: 1, short: "Lun" }, { iso: 2, short: "Mar" }, { iso: 3, short: "Mié" },
  { iso: 4, short: "Jue" }, { iso: 5, short: "Vie" }, { iso: 6, short: "Sáb" },
  { iso: 7, short: "Dom" },
];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** @type {{days:number[],hour:number}} */
let publishSchedule = { days: [1, 3, 5], hour: 10 };

function normDays(days) {
  return [...new Set((Array.isArray(days) ? days : []).map((d) => Number(d)).filter((n) => n >= 1 && n <= 7))]
    .sort((a, b) => a - b);
}
function isoToJs(day) { return day === 7 ? 0 : day; }

export function applyScheduleFromPayload(raw) {
  const days = normDays(raw?.days);
  const hour = Number.isFinite(Number(raw?.hour)) ? Math.max(0, Math.min(23, Number(raw.hour))) : 10;
  publishSchedule = { days: days.length ? days : [1, 3, 5], hour };
}

export function getPublishSchedule() {
  return { days: [...publishSchedule.days], hour: publishSchedule.hour };
}

export function formatScheduleLabel(sched = getPublishSchedule()) {
  const days = (sched.days || []).map((d) => DAY_LABELS.find((x) => x.iso === d)?.short || d).join("/");
  return `${days || "—"} · ${String(sched.hour ?? 10).padStart(2, "0")}:00 hs (AR)`;
}

export function getNextPublishSlots(count) {
  const { days, hour } = getPublishSchedule();
  const jsDays = new Set((days || []).map(isoToJs));
  const hh = String(hour ?? 10).padStart(2, "0");
  const slots = [];
  const d = new Date();
  for (let guard = 0; slots.length < count && guard < 400; guard++) {
    d.setDate(d.getDate() + 1);
    if (!jsDays.has(d.getDay())) continue;
    const name = DAY_LABELS.find((x) => isoToJs(x.iso) === d.getDay())?.short || "";
    slots.push(`${name} ${d.getDate()} de ${MONTHS[d.getMonth()]} · ${hh}:00 hs`);
  }
  return slots;
}

export function scheduleFormHtml() {
  const { days, hour } = getPublishSchedule();
  const set = new Set(days);
  const checks = DAY_LABELS.map(({ iso, short }) => `
    <label class="creativos-day-chip${set.has(iso) ? " is-on" : ""}">
      <input type="checkbox" name="ig-day" value="${iso}" ${set.has(iso) ? "checked" : ""}>
      <span>${short}</span>
    </label>`).join("");
  const hours = Array.from({ length: 24 }, (_, h) => {
    const label = `${String(h).padStart(2, "0")}:00`;
    return `<option value="${h}"${h === hour ? " selected" : ""}>${label}</option>`;
  }).join("");
  return `
    <div class="creativos-schedule-form" data-ig-schedule>
      <p class="creativos-schedule-label">Frecuencia automática · 1 pieza/día</p>
      <div class="creativos-day-row">${checks}</div>
      <div class="creativos-schedule-row">
        <label class="creativos-hour-label">Hora (Argentina)
          <select id="creativos-schedule-hour" class="creativos-hour-select">${hours}</select>
        </label>
        <button type="button" class="btn btn-sm btn-creativos-schedule-save">💾 Guardar frecuencia</button>
      </div>
    </div>`;
}

export async function savePublishSchedule(days, hour) {
  const clean = normDays(days);
  if (!clean.length) {
    throw Object.assign(new Error("Elegí al menos un día de publicación"), { auth: false });
  }
  const data = await api("instagram_cola.php", {
    method: "POST",
    body: { action: "update_schedule", days: clean, hour: Math.max(0, Math.min(23, Number(hour) || 0)) },
  });
  if (data?.schedule) applyScheduleFromPayload(data.schedule);
  const { applyColaPayload } = await import("./admin-creativos-cola.js?v=11");
  applyColaPayload(data);
}

export async function handleScheduleSaveClick(btn) {
  const root = btn.closest("[data-ig-schedule]") || document;
  const days = [...root.querySelectorAll('input[name="ig-day"]:checked')].map((el) => Number(el.value));
  const hourEl = root.querySelector("#creativos-schedule-hour") || document.getElementById("creativos-schedule-hour");
  if (!days.length) {
    window.alert("Elegí al menos un día de la semana.");
    return;
  }
  btn.disabled = true;
  try {
    await savePublishSchedule(days, Number(hourEl?.value ?? 10));
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo guardar la frecuencia");
  } finally {
    btn.disabled = false;
  }
}
