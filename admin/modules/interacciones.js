/**
 * Kinésica Admin - Módulo de Interacciones WhatsApp (Clara)
 *
 * Muestra el historial cronológico de personas que le escribieron a Clara,
 * agrupadas por fecha, con su resumen de consulta y acceso directo para
 * abrir WhatsApp y responderles en un solo click.
 */

import { api } from "./api.js?v=77";
import { escapeHtml } from "./dom.js?v=78";

let cachedInteractions = [];
let filteredInteractions = [];
let currentPage = 0;
let pageSize = 20;
let activeStatusFilter = "all"; // "all" | "pending" | "answered"
let isViewActive = false;

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const DAY_NAMES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
];

function formatDateHeader(dateStr) {
  if (!dateStr || dateStr === "Otras fechas") return "Otras fechas";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  const dateObj = new Date(y, m, d);
  const dayName = DAY_NAMES[dateObj.getDay()] || "";
  const monthName = MONTH_NAMES[m] || "";

  // Comparar con hoy
  const today = new Date();
  const isToday =
    today.getFullYear() === y &&
    today.getMonth() === m &&
    today.getDate() === d;

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === y &&
    yesterday.getMonth() === m &&
    yesterday.getDate() === d;

  let prefix = "";
  if (isToday) prefix = " (Hoy)";
  else if (isYesterday) prefix = " (Ayer)";

  return `${dayName} ${d} de ${monthName} de ${y}${prefix}`;
}

export function showInteraccionesView() {
  const view = document.getElementById("view-interacciones");
  if (!view) return;

  isViewActive = true;
  view.hidden = false;

  const otherViews = [
    "#view-dashboard",
    "#view-library",
    "#view-pacientes",
    "#view-consultorio",
    "#view-clara",
    "#view-admin",
    "#view-form",
    "#view-compare",
    "#view-gate"
  ];
  otherViews.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.hidden = true;
  });

  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "interacciones" }));
  } catch {}

  loadInteracciones();
}

export function hideInteraccionesView() {
  const view = document.getElementById("view-interacciones");
  if (view) {
    view.hidden = true;
    isViewActive = false;
  }
}

export async function loadInteracciones(force = false) {
  const container = document.getElementById("interacciones-list-container");
  const statsEl = document.getElementById("interacciones-stats");
  if (!container) return;

  if (container.children.length === 0 || force) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        <span class="loading-spinner"></span> Cargando conversaciones recientes...
      </div>
    `;
  }

  try {
    const resp = await api("interacciones.php");
    if (!resp || !resp.ok) {
      container.innerHTML = `
        <div class="interacciones-empty">
          <p>⚠️ No se pudieron cargar las interacciones en este momento.</p>
        </div>
      `;
      return;
    }

    cachedInteractions = resp.items || [];
    applyFilters(true);
  } catch (err) {
    container.innerHTML = `
      <div class="interacciones-empty">
        <p>⚠️ Error al conectar con el servidor: ${escapeHtml(err.message || String(err))}</p>
      </div>
    `;
  }
}

function applyFilters(resetPage = true) {
  const searchInput = document.getElementById("interacciones-search");
  const term = (searchInput?.value || "").toLowerCase().trim();

  filteredInteractions = cachedInteractions.filter((item) => {
    // 1. Filtro de estado excluyente
    if (activeStatusFilter === "pending" && Boolean(item.answered)) {
      return false;
    }
    if (activeStatusFilter === "answered" && !item.answered) {
      return false;
    }

    // 2. Filtro de búsqueda textual
    if (!term) return true;
    const nameMatch = (item.patient_name || "").toLowerCase().includes(term);
    const phoneMatch =
      (item.wa_id || "").includes(term) ||
      (item.phone_formatted || "").includes(term);
    const summaryMatch = (item.summary || "").toLowerCase().includes(term);
    const msgMatch = (item.messages || []).some((m) =>
      (m.text || "").toLowerCase().includes(term)
    );
    return nameMatch || phoneMatch || summaryMatch || msgMatch;
  });

  if (resetPage) {
    currentPage = 0;
  }
  renderCurrentView();
  updateStatsHeader();
}

function updateStatsHeader() {
  const statsEl = document.getElementById("interacciones-stats");
  if (!statsEl) return;
  const totalContacts = new Set(cachedInteractions.map((i) => i.wa_id)).size;
  const answeredCount = cachedInteractions.filter((i) => Boolean(i.answered)).length;
  const pendingCount = cachedInteractions.length - answeredCount;

  const isPendingActive = activeStatusFilter === "pending";
  const isAnsweredActive = activeStatusFilter === "answered";

  statsEl.innerHTML = `
    <span class="interacciones-stat-pill">👥 ${totalContacts} personas</span>
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
}

function renderCurrentView() {
  const totalRows = filteredInteractions.length;
  const effectivePageSize = pageSize > 0 ? pageSize : 20;
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));

  currentPage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const start = currentPage * effectivePageSize;
  const pagedItems = filteredInteractions.slice(start, start + effectivePageSize);

  renderInteractions(pagedItems);
  renderPager(totalRows, totalPages);
}

function renderPager(totalRows, totalPages) {
  const pagerEl = document.getElementById("interacciones-pager");
  if (!pagerEl) return;

  if (totalRows <= pageSize || totalRows === 0) {
    pagerEl.hidden = true;
    pagerEl.innerHTML = "";
    return;
  }

  pagerEl.hidden = false;
  pagerEl.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn ghost";
  prevBtn.textContent = "← Anterior";
  prevBtn.disabled = currentPage === 0;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage -= 1;
      renderCurrentView();
      document.getElementById("view-interacciones")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  const span = document.createElement("span");
  const unit = totalRows === 1 ? "conversación" : "conversaciones";
  span.textContent = `Página ${currentPage + 1} de ${totalPages} (${totalRows} ${unit})`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn ghost";
  nextBtn.textContent = "Siguiente →";
  nextBtn.disabled = currentPage >= totalPages - 1;
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages - 1) {
      currentPage += 1;
      renderCurrentView();
      document.getElementById("view-interacciones")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  pagerEl.append(prevBtn, span, nextBtn);
}

function renderInteractions(items) {
  const container = document.getElementById("interacciones-list-container");
  if (!container) return;

  if (!items || items.length === 0) {
    let emptyMsg = "No se encontraron conversaciones con los filtros actuales.";
    if (activeStatusFilter === "pending") {
      emptyMsg = "No hay consultas pendientes de respuesta.";
    } else if (activeStatusFilter === "answered") {
      emptyMsg = "No hay consultas marcadas como respondidas.";
    }

    container.innerHTML = `
      <div class="interacciones-empty">
        <p>${escapeHtml(emptyMsg)}</p>
        ${
          activeStatusFilter !== "all"
            ? `<button type="button" class="btn secondary" id="btn-reset-status-filter" style="margin-top: 10px; font-size: 13px;">Mostrar todas</button>`
            : ""
        }
      </div>
    `;

    const resetBtn = document.getElementById("btn-reset-status-filter");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        activeStatusFilter = "all";
        applyFilters(true);
      });
    }
    return;
  }

  // Agrupar por fecha
  const groups = {};
  items.forEach((item) => {
    const d = item.date || "Otras fechas";
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  let html = "";

  sortedDates.forEach((dateKey) => {
    const groupItems = groups[dateKey];
    const headerTitle = formatDateHeader(dateKey);

    html += `
      <section class="interacciones-date-group">
        <div class="interacciones-date-header">
          <span>📅 ${escapeHtml(headerTitle)}</span>
          <span class="interacciones-date-badge">${groupItems.length} ${groupItems.length === 1 ? "contacto" : "contactos"}</span>
        </div>
        <div class="interacciones-list">
    `;

    groupItems.forEach((conv) => {
      const cleanWa = (conv.wa_id || "").replace(/[^0-9]/g, "");
      const waUrl = `https://wa.me/${cleanWa}`;
      const name = conv.patient_name || "Paciente sin nombre";
      const phoneDisplay = conv.phone_formatted || `+${cleanWa}`;
      const timeStr = conv.time || "";
      const categoryLabel = (conv.category_label || "Consulta WhatsApp").replace(/^[💬\s]+/, "");
      const summaryText = conv.summary || "Consulta recibida";
      const cardId = `conv-card-${escapeHtml(conv.id || cleanWa)}`;
      const threadId = `thread-${escapeHtml(conv.id || cleanWa)}`;
      const isAnswered = Boolean(conv.answered);

      // Avatar inicial
      const initial = name !== "Paciente sin nombre" ? name.trim().charAt(0).toUpperCase() : "👤";

      html += `
        <article class="interaccion-card ${isAnswered ? "is-answered" : ""}" id="${cardId}">
          <div class="interaccion-header">
            <div class="interaccion-user-info">
              <div class="interaccion-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
              <div class="interaccion-titles">
                <h3 class="interaccion-name">${escapeHtml(name)}</h3>
                <span class="interaccion-phone">
                  📞 ${escapeHtml(phoneDisplay)} &bull; ${escapeHtml(timeStr)} hs
                  <span class="interaccion-badge">${escapeHtml(categoryLabel)}</span>
                  <span class="interaccion-status-pill ${isAnswered ? "answered" : "pending"}" id="status-pill-${escapeHtml(conv.id)}">
                    ${isAnswered ? "✓ Respondida" : "⏳ Pendiente"}
                  </span>
                </span>
              </div>
            </div>

            <div class="interaccion-actions">
              <label class="interaccion-answered-label" title="Marcar si ya se le respondió al paciente">
                <input type="checkbox" class="interaccion-answered-checkbox" data-conv-id="${escapeHtml(conv.id)}" ${isAnswered ? "checked" : ""}>
                <span>Consulta respondida</span>
              </label>

              <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct" title="Abrir chat en WhatsApp">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.074-2.123-.518-1.745-.724-2.888-2.484-2.975-2.6-.088-.116-.708-.941-.708-1.792s.448-1.27.607-1.446c.159-.175.347-.219.462-.219.116 0 .232.001.332.006.106.005.249-.04.39.299.144.35.491 1.199.535 1.286.044.088.073.19.015.305-.058.116-.088.188-.174.29-.088.102-.185.228-.264.307-.089.088-.182.184-.078.362.103.179.462.763.992 1.236.684.609 1.26.798 1.439.887.179.088.283.073.388-.047.106-.119.454-.528.575-.709.121-.179.243-.151.409-.089.165.059 1.053.496 1.234.585.18.089.301.133.346.208.045.075.045.436-.099.841z"/>
                </svg>
                Abrir WhatsApp
              </a>
            </div>
          </div>

          <div class="interaccion-summary">
            <strong>Resumen de consulta:</strong> ${escapeHtml(summaryText)}
          </div>

          <button type="button" class="interaccion-toggle-btn" data-thread-toggle="${threadId}">
            <span>▶ Ver conversación completa (${(conv.messages || []).length} mensajes)</span>
          </button>

          <div class="interaccion-chat-thread" id="${threadId}" hidden>
            ${renderChatMessages(conv.messages || [], name)}
          </div>
        </article>
      `;
    });

    html += `
        </div>
      </section>
    `;
  });

  container.innerHTML = html;

  // Bind toggles de hilos
  container.querySelectorAll("[data-thread-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-thread-toggle");
      const threadEl = document.getElementById(targetId);
      if (!threadEl) return;
      const isHidden = threadEl.hidden;
      threadEl.hidden = !isHidden;
      const span = btn.querySelector("span");
      if (span) {
        span.textContent = isHidden
          ? span.textContent.replace("▶", "▼")
          : span.textContent.replace("▼", "▶");
      }
    });
  });

  // Bind checkboxes de "Consulta respondida"
  container.querySelectorAll(".interaccion-answered-checkbox").forEach((chk) => {
    chk.addEventListener("change", async () => {
      const convId = chk.getAttribute("data-conv-id");
      const isChecked = chk.checked;
      const cardEl = chk.closest(".interaccion-card");
      const pillEl = document.getElementById(`status-pill-${convId}`);

      // Actualizar visualmente de inmediato
      if (cardEl) {
        cardEl.classList.toggle("is-answered", isChecked);
      }
      if (pillEl) {
        pillEl.className = `interaccion-status-pill ${isChecked ? "answered" : "pending"}`;
        pillEl.textContent = isChecked ? "✓ Respondida" : "⏳ Pendiente";
      }

      // Actualizar en el cache local
      const targetConv = cachedInteractions.find((i) => i.id === convId);
      if (targetConv) {
        targetConv.answered = isChecked;
      }

      // Si hay un filtro activo, re-aplicar para actualizar la vista
      if (activeStatusFilter !== "all") {
        applyFilters(false);
      } else {
        updateStatsHeader();
      }

      // Persistir en servidor
      try {
        const resp = await api("interacciones.php", {
          method: "POST",
          body: JSON.stringify({
            action: "toggle_answered",
            id: convId,
            answered: isChecked,
          }),
        });
        if (!resp || !resp.ok) {
          throw new Error(resp?.error || "Error al actualizar estado");
        }
      } catch (err) {
        // Revertir en caso de falla
        chk.checked = !isChecked;
        if (cardEl) {
          cardEl.classList.toggle("is-answered", !isChecked);
        }
        if (pillEl) {
          pillEl.className = `interaccion-status-pill ${!isChecked ? "answered" : "pending"}`;
          pillEl.textContent = !isChecked ? "✓ Respondida" : "⏳ Pendiente";
        }
        if (targetConv) {
          targetConv.answered = !isChecked;
        }
        if (activeStatusFilter !== "all") {
          applyFilters(false);
        } else {
          updateStatsHeader();
        }
        console.error("Error al persistir consulta respondida:", err);
      }
    });
  });
}

function renderChatMessages(messages, patientName) {
  if (!messages || messages.length === 0) {
    return `<div style="text-align: center; font-size: 13px; color: var(--muted);">Sin mensajes registrados.</div>`;
  }

  return messages
    .map((m) => {
      const isPatient = m.from === "patient";
      const bubbleClass = isPatient ? "chat-bubble-patient" : "chat-bubble-clara";
      const senderTitle = isPatient ? (patientName || "Paciente") : "🤖 Clara (Asistente Virtual)";
      const formattedText = escapeHtml(m.text || "").replace(/\n/g, "<br>");

      return `
        <div class="chat-bubble ${bubbleClass}">
          <div class="chat-bubble-sender">${escapeHtml(senderTitle)}</div>
          <div class="chat-bubble-content">${formattedText}</div>
          <span class="chat-bubble-time">${escapeHtml(m.time || "")}</span>
        </div>
      `;
    })
    .join("");
}

export function initInteraccionesModule() {
  const searchInput = document.getElementById("interacciones-search");
  const refreshBtn = document.getElementById("btn-refresh-interacciones");
  const pageSizeSelect = document.getElementById("interacciones-page-size");
  const statsEl = document.getElementById("interacciones-stats");

  if (pageSizeSelect) {
    pageSize = Number(pageSizeSelect.value) || 20;
    pageSizeSelect.addEventListener("change", (e) => {
      pageSize = Number(e.target.value) || 20;
      currentPage = 0;
      renderCurrentView();
    });
  }

  if (statsEl) {
    statsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;
      const filterType = btn.getAttribute("data-filter");
      if (!filterType) return;

      // Filtro mutuamente excluyente: Uno, el otro o ninguno
      if (activeStatusFilter === filterType) {
        activeStatusFilter = "all";
      } else {
        activeStatusFilter = filterType;
      }
      applyFilters(true);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applyFilters(true);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadInteracciones(true);
    });
  }
}
