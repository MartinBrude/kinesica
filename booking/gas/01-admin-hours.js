/**
 * Kinésica GAS — Horarios del admin: fetch a settings.php, caché y última copia buena.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

function isValidHoursObject(h) {
  return Boolean(h && typeof h === "object" && (h.norberto || h.maria));
}

/** Horarios enviados por la web: estructura válida, días 1–5, franjas HH:mm dentro de 08:00–20:00. */
function sanitizeClientHours(raw) {
  try {
    let parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && parsed.h && typeof parsed.h === "object") {
      parsed = parsed.h;
    }
    if (!isValidHoursObject(parsed)) return null;
    const out = {};
    const okTime = function(t) { return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); };
    const toMin = function(t) { const p = t.split(":").map(Number); return p[0] * 60 + p[1]; };
    let ok = true;
    ["maria", "norberto"].forEach(function(pid) {
      const days = parsed[pid] || {};
      out[pid] = {};
      Object.keys(days).forEach(function(k) {
        if (!/^[1-5]$/.test(String(k))) { ok = false; return; }
        const list = Array.isArray(days[k]) ? days[k] : [];
        if (list.length > 4) { ok = false; return; }
        out[pid][String(k)] = list.map(function(w) {
          if (!w || !okTime(w.start) || !okTime(w.end)) { ok = false; return null; }
          const a = toMin(w.start), b = toMin(w.end);
          if (a >= b || a < DAY_START_HOUR * 60 || b > DAY_END_HOUR * 60) { ok = false; return null; }
          return { start: w.start, end: w.end };
        });
      });
    });
    return ok ? out : null;
  } catch (e) {
    return null;
  }
}

/** Diagnóstico de la última resolución de horarios (lo muestra ?action=ping). */
let ADMIN_HOURS_DIAG = { loaded: false, http_code: null, source: null, fetched_at: null, error: null, url: null };

/** Lee practitioner_hours del admin (settings.php) con caché corta. Devuelve null si falla. */
let ADMIN_HOURS_MEMO; // memo por ejecución (evita refetch en un rango de días)

function fetchAdminPractitionerHours() {
  if (ADMIN_HOURS_MEMO !== undefined) return ADMIN_HOURS_MEMO;
  ADMIN_HOURS_MEMO = fetchAdminPractitionerHoursUncached();
  return ADMIN_HOURS_MEMO;
}

function fetchSettingsHoursFrom(url) {
  const fullUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + "_t=" + Date.now();
  const res = UrlFetchApp.fetch(fullUrl, {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true,
    headers: { "Accept": "application/json", "Cache-Control": "no-cache", "X-Kinesica-Client": "apps-script-booking" }
  });
  const code = res.getResponseCode();
  ADMIN_HOURS_DIAG.http_code = code;
  ADMIN_HOURS_DIAG.url = url;
  if (code !== 200) {
    ADMIN_HOURS_DIAG.error = "HTTP " + code + ": " + String(res.getContentText() || "").slice(0, 120);
    console.warn("[admin_hours] " + url + " respondió HTTP " + code);
    return null;
  }
  let data = null;
  try {
    data = JSON.parse(res.getContentText());
  } catch (e) {
    ADMIN_HOURS_DIAG.error = "respuesta no JSON: " + String(res.getContentText() || "").slice(0, 120);
    console.warn("[admin_hours] " + url + " devolvió algo que no es JSON (¿desafío anti-bots?)");
    return null;
  }
  const hours = data && data.practitioner_hours;
  if (!isValidHoursObject(hours)) {
    ADMIN_HOURS_DIAG.error = "JSON sin practitioner_hours válido";
    console.warn("[admin_hours] " + url + " no trae practitioner_hours válido");
    return null;
  }
  return hours;
}

function fetchAdminPractitionerHoursUncached() {
  let cache = null;
  try {
    cache = CacheService.getScriptCache();
    const cached = cache.get(ADMIN_HOURS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (isValidHoursObject(parsed)) {
        ADMIN_HOURS_DIAG = { loaded: true, http_code: null, source: "cache", fetched_at: null, error: null, url: null };
        return parsed;
      }
    }
  } catch (e) {}

  let props = null;
  try { props = PropertiesService.getScriptProperties(); } catch (e) {}
  const configured = props ? props.getProperty("SETTINGS_URL") : null;
  const urls = [configured || ADMIN_SETTINGS_URL_DEFAULT, ADMIN_SETTINGS_URL_SECONDARY]
    .filter(function(u, idx, arr) { return u && arr.indexOf(u) === idx; });

  ADMIN_HOURS_DIAG = { loaded: false, http_code: null, source: null, fetched_at: new Date().toISOString(), error: null, url: null };
  for (let k = 0; k < urls.length; k++) {
    try {
      const hours = fetchSettingsHoursFrom(urls[k]);
      if (hours) {
        ADMIN_HOURS_DIAG.loaded = true;
        ADMIN_HOURS_DIAG.source = "admin";
        ADMIN_HOURS_DIAG.error = null;
        try { if (cache) cache.put(ADMIN_HOURS_CACHE_KEY, JSON.stringify(hours), ADMIN_HOURS_CACHE_SECONDS); } catch (e) {}
        try { if (props) props.setProperty(ADMIN_HOURS_LAST_GOOD_PROP, JSON.stringify({ hours: hours, at: ADMIN_HOURS_DIAG.fetched_at })); } catch (e) {}
        return hours;
      }
    } catch (e) {
      ADMIN_HOURS_DIAG.error = String(e && e.message ? e.message : e).slice(0, 200);
      ADMIN_HOURS_DIAG.url = urls[k];
      console.warn("[admin_hours] fallo al consultar " + urls[k] + ": " + ADMIN_HOURS_DIAG.error);
    }
  }
  return null;
}

function readLastGoodAdminHours() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(ADMIN_HOURS_LAST_GOOD_PROP);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && isValidHoursObject(parsed.hours)) return parsed;
  } catch (e) {}
  return null;
}

/**
 * Horarios vigentes (consultas y reservas):
 * 1) admin (settings.php, con caché 2 min), 2) última copia buena del admin guardada en el script,
 * 3) los horarios que manda la web (validados: días 1–5, franjas dentro de 08:00–20:00),
 * 4) fallback técnico PRACTITIONER_HOURS.
 */
function resolveActivePractitionerHours(customHoursRaw, opts) {
  const adminHours = fetchAdminPractitionerHours();
  if (adminHours) return adminHours;
  const lastGood = readLastGoodAdminHours();
  if (lastGood) {
    ADMIN_HOURS_DIAG.source = "last_good";
    ADMIN_HOURS_DIAG.last_good_at = lastGood.at || null;
    return lastGood.hours;
  }
  if (customHoursRaw) {
    const client = sanitizeClientHours(customHoursRaw);
    if (client) {
      ADMIN_HOURS_DIAG.source = "request";
      return client;
    }
    console.warn("[admin_hours] horarios enviados por la web inválidos; se usa el fallback técnico");
  }
  ADMIN_HOURS_DIAG.source = "fallback";
  if (opts && opts.forBooking) console.warn("[admin_hours] reserva validada con horarios de respaldo del código");
  return PRACTITIONER_HOURS;
}
