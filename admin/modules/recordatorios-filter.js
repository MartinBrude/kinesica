/**
 * Filtros y píldoras de conteo para Recordatorios.
 */

const STATUS_FILTERS = {
  sent: "sent",
  sent_email: "sent_email",
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

export function filterRecordatoriosList(items, term, activeStatusFilter) {
  const rawTerm = String(term || "").trim();
  const cleanTerm = normalize(rawTerm);
  const digitsTerm = rawTerm.replace(/\D/g, "");

  return (items || []).filter((item) => {
    if (!item || typeof item !== "object") return false;
    const status = String(item.status || "");
    if (activeStatusFilter === "skipped") {
      if (status !== "skipped" && status !== "run_skipped") return false;
    } else if (activeStatusFilter !== "all" && STATUS_FILTERS[activeStatusFilter]) {
      if (status !== activeStatusFilter) return false;
    }
    if (!cleanTerm) return true;
    const waDigits = String(item.wa_id || "").replace(/\D/g, "");
    const nameMatch = normalize(item.patient_name).includes(cleanTerm);
    const summaryMatch = normalize(item.event_summary).includes(cleanTerm);
    const phoneMatch =
      normalize(item.wa_id).includes(cleanTerm) ||
      (digitsTerm.length >= 3 && waDigits.includes(digitsTerm));
    const reasonMatch = normalize(item.skip_reason_label || item.skip_reason).includes(cleanTerm);
    return nameMatch || summaryMatch || phoneMatch || reasonMatch;
  });
}

export function renderRecordatoriosStats(statsEl, { counts, activeStatusFilter }) {
  if (!statsEl) return;
  const c = counts || {};
  const pill = (filter, label, count, extraClass = "") => {
    const active = activeStatusFilter === filter;
    return `<button type="button"
      class="recordatorios-stat-pill filter-pill ${extraClass} ${active ? "is-active" : ""}"
      data-filter="${filter}"
      aria-pressed="${active}">
      ${label} ${count || 0}
    </button>`;
  };
  const skippedCount = (c.skipped || 0) + (c.run_skipped || 0);
  const sentWa = c.sent || 0;
  const sentMail = c.sent_email || 0;
  statsEl.innerHTML = [
    pill("sent", "✓ WhatsApp", sentWa, "filter-sent"),
    pill("sent_email", "✉ Email", sentMail, "filter-sent"),
    pill("failed", "✕ Fallidos", c.failed, "filter-failed"),
    pill("missing_phone", "☎ Sin contacto", c.missing_phone, "filter-phone"),
    pill("skipped", "⊘ Omitidos", skippedCount, "filter-skipped"),
  ].join("");
}
