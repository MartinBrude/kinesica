/**
 * Estado y utilidades de datos — Recordatorios.
 */

export const recordatoriosStore = {
  cachedItems: [],
  cachedCounts: {},
  filteredItems: [],
  currentPage: 0,
  activeStatusFilter: "all",
  autoRefreshTimer: null,
  isRefreshing: false,
  hasLoadedOnce: false,
  lastLoadedAt: 0,
};

export const CACHE_TTL_MS = 60000;

export function isBlockedRecordatorio(item) {
  if (!item || typeof item !== "object") return false;
  const status = String(item.status || "").toLowerCase();
  if (status === "run_skipped") return true;
  const reason = String(item.skip_reason || "").toLowerCase();
  if (reason === "blocked" || reason === "clara_inactive") return true;
  const name = String(item.patient_name || "").toLowerCase();
  const summary = String(item.event_summary || "").toLowerCase();
  return (
    name.includes("no dar") ||
    summary.includes("no dar") ||
    name.includes("bloqueado") ||
    summary.includes("bloqueado")
  );
}

export function recalculateCounts() {
  const counts = {
    pending: 0,
    sent: 0,
    sent_email: 0,
    failed: 0,
    missing_phone: 0,
    skipped: 0,
    run_skipped: 0,
  };
  for (const it of recordatoriosStore.cachedItems) {
    if (isBlockedRecordatorio(it)) continue;
    const st = it.status;
    if (counts[st] !== undefined) {
      counts[st]++;
    }
  }
  recordatoriosStore.cachedCounts = counts;
  return counts;
}

function recordatorioDedupeScore(it) {
  const st = String(it?.status || "");
  let score = 0;
  if (it?.wa_id) score += 8;
  if (it?.email) score += 2;
  if (st === "sent" || st === "sent_email") score += 16;
  else if (st === "pending" && it?.wa_id) score += 6;
  else if (st === "failed") score += 1;
  else if (st === "missing_phone") score -= 4;
  return score;
}

export function deduplicateRecordatorios(items) {
  const best = new Map();
  for (const it of items) {
    const calId = (it.calendar_event_id || "").trim();
    const pName = (it.patient_name || "").trim().toLowerCase();
    const apptDate = (it.appointment_date || "").trim();
    const apptTime = (it.appointment_time || "").trim();
    const slotKey = pName && apptDate ? `${pName}|${apptDate}|${apptTime}` : "";
    const key = calId && calId !== "_run" ? `cal:${calId}` : slotKey ? `slot:${slotKey}` : `id:${it.id}`;
    const prev = best.get(key);
    if (!prev || recordatorioDedupeScore(it) > recordatorioDedupeScore(prev)) {
      best.set(key, it);
    }
  }
  return Array.from(best.values());
}