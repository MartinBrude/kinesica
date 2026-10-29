/**
 * Kinésica Admin - Filtrado y Estadísticas de Interacciones
 * Reglas de búsqueda por texto/teléfono/mensaje y renderizado de píldoras de conteo.
 */

export function filterInteractionsList(items, term, activeStatusFilter) {
  const cleanTerm = String(term || "").toLowerCase().trim();
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const isArchived = Boolean(item.archived);
    if (activeStatusFilter === "archived") {
      if (!isArchived) return false;
    } else {
      if (isArchived) return false;
      if (activeStatusFilter === "pending" && Boolean(item.answered)) return false;
      if (activeStatusFilter === "answered" && !item.answered) return false;
    }
    if (!cleanTerm) return true;
    const nameMatch = String(item.patient_name || "").toLowerCase().includes(cleanTerm);
    const phoneMatch =
      String(item.wa_id || "").includes(cleanTerm) ||
      String(item.phone_formatted || "").includes(cleanTerm);
    const summaryMatch = String(item.summary || "").toLowerCase().includes(cleanTerm);
    const msgMatch = Array.isArray(item.messages) && item.messages.some((m) =>
      String(m?.text || "").toLowerCase().includes(cleanTerm)
    );
    return nameMatch || phoneMatch || summaryMatch || msgMatch;
  });
}

export function renderStatsHeader(statsEl, { cachedInteractions, activeStatusFilter }) {
  if (!statsEl) return;
  const activeList = cachedInteractions.filter((i) => i && !i.archived);
  const archivedList = cachedInteractions.filter((i) => i && Boolean(i.archived));
  const totalContacts = new Set(activeList.map((i) => String(i?.wa_id || ""))).size;
  const answeredCount = activeList.filter((i) => Boolean(i?.answered)).length;
  const pendingCount = activeList.length - answeredCount;
  const archivedCount = archivedList.length;

  const isPendingActive = activeStatusFilter === "pending";
  const isAnsweredActive = activeStatusFilter === "answered";
  const isArchivedActive = activeStatusFilter === "archived";

  statsEl.innerHTML = `
    <button type="button"
      class="interacciones-stat-pill filter-pill filter-archived ${isArchivedActive ? "is-active" : ""}"
      data-filter="archived"
      aria-pressed="${isArchivedActive}"
      title="${isArchivedActive ? "Filtro activo: mostrando archivadas (click para ver activas)" : "Filtrar conversaciones archivadas"}">
      🗄️ ${archivedCount} archivadas
    </button>
    <button type="button"
      class="interacciones-stat-pill filter-pill filter-pending ${isPendingActive ? "is-active" : ""}"
      data-filter="pending"
      aria-pressed="${isPendingActive}"
      title="${isPendingActive ? "Filtro activo: mostrando pendientes (click para quitar filtro)" : "Filtrar solo pendientes"}">
      ⏳ ${pendingCount} pendientes
    </button>
    <button type="button"
      class="interacciones-stat-pill filter-pill filter-answered ${isAnsweredActive ? "is-active" : ""}"
      data-filter="answered"
      aria-pressed="${isAnsweredActive}"
      title="${isAnsweredActive ? "Filtro activo: mostrando respondidas (click para quitar filtro)" : "Filtrar solo respondidas"}">
      ✓ ${answeredCount} respondidas
    </button>
  `;

  const totalEl = document.getElementById("interacciones-total-contacts");
  if (totalEl) {
    totalEl.textContent = `👥 ${totalContacts} personas`;
  }
}
