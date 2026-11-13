/** Constantes y utilidades de horarios de consultorio. */

export const DEFAULT_HEADER_SCHEDULE = { opens: "08:00", closes: "19:30" };

export const DEFAULT_PRACTITIONER_HOURS = {
  norberto: {
    1: [{ start: "17:30", end: "19:30" }],
    2: [{ start: "16:30", end: "19:30" }],
    3: [{ start: "09:00", end: "16:30" }],
    4: [{ start: "15:00", end: "19:00" }],
    5: [{ start: "13:30", end: "19:30" }],
  },
  maria: {
    1: [{ start: "09:00", end: "17:00" }],
    2: [{ start: "09:00", end: "16:00" }],
    5: [{ start: "09:00", end: "13:00" }],
  },
};

export const DAYS = [
  { dow: 1, name: "Lunes", short: "Lun" },
  { dow: 2, name: "Martes", short: "Mar" },
  { dow: 3, name: "Miércoles", short: "Mié" },
  { dow: 4, name: "Jueves", short: "Jue" },
  { dow: 5, name: "Viernes", short: "Vie" },
];

export const PROF_META = [
  {
    id: "maria",
    name: "Lic. María Gulin",
    shortName: "María",
    specialties: "Kinesiología · RPG · ATM · Acupuntura · Posturología",
    cardClass: "maria-card",
  },
  {
    id: "norberto",
    name: "Lic. Norberto Brude",
    shortName: "Norberto",
    specialties: "Kinesiología · Osteopatía · RPG · ATM · Barral",
    cardClass: "norberto-card",
  },
];

export const TIMELINE_START_MIN = 8 * 60;
export const TIMELINE_END_MIN = 20 * 60;
export const TIMELINE_SPAN_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN;

export function hmToMin(hm) {
  const parts = String(hm || "00:00").split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
}

export function minToHm(totalMin) {
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function buildTimeOptions(minHour = 8, maxHour = 20) {
  const opts = [];
  for (let m = minHour * 60; m <= maxHour * 60; m += 30) opts.push(minToHm(m));
  return opts;
}

export function cloneHours(source) {
  const src = source || DEFAULT_PRACTITIONER_HOURS;
  const out = { norberto: {}, maria: {} };
  ["norberto", "maria"].forEach((pid) => {
    const pDays = (src && src[pid]) || {};
    Object.keys(pDays).forEach((dow) => {
      const list = pDays[dow];
      if (Array.isArray(list) && list.length > 0) {
        out[pid][dow] = list.map((r) => ({
          start: String(r.start || "09:00"),
          end: String(r.end || "13:00"),
        }));
      }
    });
  });
  return out;
}

export function formatHeaderScheduleText(opens, closes) {
  function formatHm24(hm) {
    const parts = String(hm || "").split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
  }
  return `Lunes a viernes: <strong>${formatHm24(opens)} a ${formatHm24(closes)} h</strong>`;
}
