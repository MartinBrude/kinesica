/**
 * Filtros y píldoras de conteo para Recordatorios.
 * Agrupa según el ciclo de vida: Enviados, A enviar, Fallidos en enviarse y Omitidos.
 */

import { formatDisplayPhone } from "./phone-format.js";

const STATUS_FILTERS = {
  all: "all",
  sent: "sent",
  sent_email: "sent_email",
  pending: "pending",
  failed: "failed",
  missing_phone: "missing_phone",
  skipped: "skipped",
};

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isBlockedRecordatorio(item) {
  if (!item || typeof item !== "object") return false;
  const reason = String(item.skip_reason || "").toLowerCase();
  if (reason === "blocked") return true;
  const name = String(item.patient_name || "").toLowerCase();
  const summary = String(item.event_summary || "").toLowerCase();
  return (
    name.includes("no dar") ||
    summary.includes("no dar") ||
    name.includes("bloqueado") ||
    summary.includes("bloqueado")
  );
}

export function filterRecordatoriosList(items, term, activeStatusFilter) {
  const rawTerm = String(term || "").trim();
  const cleanTerm = normalize(rawTerm);
  const digitsTerm = rawTerm.replace(/\D/g, "");

  return (items || []).filter((item) => {
    if (!item || typeof item !== "object") return false;
    if (isBlockedRecordatorio(item)) return false;
    const status = String(item.status || "");
    if (activeStatusFilter === "sent") {
      if (status !== "sent" && status !== "sent_email") return false;
    } else if (activeStatusFilter === "pending") {
      if (status !== "pending") return false;
    } else if (activeStatusFilter === "failed") {
      if (status !== "failed" && status !== "missing_phone") return false;
    } else if (activeStatusFilter === "skipped") {
      if (status !== "skipped" && status !== "run_skipped") return false;
    } else if (activeStatusFilter !== "all" && STATUS_FILTERS[activeStatusFilter]) {
      if (status !== activeStatusFilter) return false;
    }
    if (!cleanTerm) return true;
    const waDigits = String(item.wa_id || "").replace(/\D/g, "");
    const phoneFormatted = formatDisplayPhone(item.wa_id);
    const nameMatch = normalize(item.patient_name).includes(cleanTerm);
    const summaryMatch = normalize(item.event_summary).includes(cleanTerm);
    const phoneMatch =
      normalize(item.wa_id).includes(cleanTerm) ||
      normalize(phoneFormatted).includes(cleanTerm) ||
      (digitsTerm.length >= 3 && waDigits.includes(digitsTerm));
    const reasonMatch = normalize(item.skip_reason_label || item.skip_reason).includes(cleanTerm);
    const isMissingPhone = !item.wa_id && (item.status === "pending" || item.status === "missing_phone");
    const missingPhoneMatch =
      isMissingPhone &&
      (cleanTerm.includes("telefono") || cleanTerm.includes("whatsapp") || cleanTerm.includes("sin"));
    return nameMatch || summaryMatch || phoneMatch || reasonMatch || missingPhoneMatch;
  });
}

export function renderRecordatoriosStats(statsEl, { counts, activeStatusFilter }) {
  if (!statsEl) return;
  const c = counts || {};
  const pill = (filter, label, count, extraClass = "", title = "") => {
    const active = activeStatusFilter === filter;
    return `<button type="button"
      class="recordatorios-stat-pill filter-pill ${extraClass} ${active ? "is-active" : ""}"
      data-filter="${filter}"
      aria-pressed="${active}"
      title="${title}">
      ${label} ${count || 0}
    </button>`;
  };

  const sentWa = c.sent || 0;
  const sentMail = c.sent_email || 0;
  const sentTotal = sentWa + sentMail;
  const pendingCount = c.pending || 0;
  const failedCount = (c.failed || 0) + (c.missing_phone || 0);
  const skippedCount = (c.skipped || 0) + (c.run_skipped || 0);
  const total = sentTotal + pendingCount + failedCount + skippedCount;

  const sentDetail = sentMail > 0 ? ` (${sentWa} WA · ${sentMail} Mail)` : (sentWa > 0 ? " (WA)" : "");
  const failedClass = failedCount > 0 ? "filter-failed has-alert" : "filter-failed";

  statsEl.innerHTML = [
    pill("all", "📋 Todos", total, "", "Ver todos los recordatorios"),
    pill("sent", `✓ Enviados${sentDetail}`, sentTotal, "filter-sent", "Filtrar recordatorios enviados por WhatsApp o correo"),
    pill("pending", "⏳ A enviar", pendingCount, "filter-pending", "Filtrar recordatorios pendientes por ser enviados"),
    pill("failed", "✕ Fallaron en enviarse", failedCount, failedClass, "Filtrar recordatorios que fallaron o sin contacto (disparables manualmente)"),
    pill("skipped", "⊘ Omitidos", skippedCount, "filter-skipped", "Filtrar turnos omitidos según reglas"),
  ].join("");
}
