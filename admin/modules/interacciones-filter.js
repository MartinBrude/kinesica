/**
 * Kinésica Admin - Filtrado y Estadísticas de Interacciones
 * Reglas de búsqueda por texto/teléfono/mensaje y renderizado de píldoras de conteo.
 */

export function filterInteractionsList(items, term, activeStatusFilter) {
  const rawTerm = String(term || "").trim();
  const normalize = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const cleanTerm = normalize(rawTerm);
  const digitsTerm = rawTerm.replace(/\D/g, "");

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

    const waDigits = String(item.wa_id || "").replace(/\D/g, "");
    const phoneFormatted = String(item.phone_formatted || "");
    const isMartin =
      waDigits === "34658444935" ||
      waDigits.endsWith("658444935") ||
      phoneFormatted.includes("658 44 49 35");

    const effectiveName = isMartin ? "Martín Brude" : String(item.patient_name || "");
    const nameMatch = normalize(effectiveName).includes(cleanTerm);
    const martinMatch =
      isMartin &&
      ("martin brude".includes(cleanTerm) ||
        "brude".includes(cleanTerm) ||
        "martin".includes(cleanTerm));

    const phoneMatch =
      String(item.wa_id || "").toLowerCase().includes(cleanTerm) ||
      phoneFormatted.toLowerCase().includes(cleanTerm) ||
      (digitsTerm.length >= 3 && (waDigits.includes(digitsTerm) || phoneFormatted.replace(/\D/g, "").includes(digitsTerm)));

    const summaryMatch = normalize(item.summary).includes(cleanTerm);
    const msgMatch = Array.isArray(item.messages) && item.messages.some((m) =>
      normalize(m?.text).includes(cleanTerm)
    );
    return nameMatch || martinMatch || phoneMatch || summaryMatch || msgMatch;
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
