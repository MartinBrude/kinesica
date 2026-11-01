/**
 * Kinésica Admin — Historial de recordatorios WhatsApp 24h.
 */

import { api } from "./api.js?v=77";
import { switchActiveView, escapeHtml } from "./dom.js?v=78";
import { dialogAlert } from "./dom-dialogs.js?v=77";
import {
  renderRecordatoriosList,
  renderRecordatoriosPager,
} from "./recordatorios-render.js?v=6";
import {
  filterRecordatoriosList,
  renderRecordatoriosStats,
} from "./recordatorios-filter.js?v=6";
import { renderRecordatoriosRules } from "./recordatorios-rules.js?v=3";

let cachedItems = [];
let cachedCounts = {};
let filteredItems = [];
let currentPage = 0;
let pageSize = 20;
let activeStatusFilter = "all";
let autoRefreshTimer = null;
let isRefreshing = false;
let hasLoadedOnce = false;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 60000;

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

function recalculateCounts() {
  const counts = {
    pending: 0,
    sent: 0,
    sent_email: 0,
    failed: 0,
    missing_phone: 0,
    skipped: 0,
    run_skipped: 0,
  };
  for (const it of cachedItems) {
    if (isBlockedRecordatorio(it)) continue;
    const st = it.status;
    if (counts[st] !== undefined) {
      counts[st]++;
    }
  }
  cachedCounts = counts;
  return counts;
}

export function showRecordatoriosView() {
  const view = switchActiveView("view-recordatorios");
  if (!view) return;
  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "recordatorios" }));
  } catch {}
  renderRecordatoriosRules(document.getElementById("recordatorios-rules"));

  const isFresh = hasLoadedOnce && (Date.now() - lastLoadedAt < CACHE_TTL_MS);
  if (isFresh) {
    applyFiltersAndRender();
  } else {
    loadRecordatorios(false);
  }
  startAutoRefresh();
}

export function hideRecordatoriosView() {
  const view = document.getElementById("view-recordatorios");
  if (view) view.hidden = true;
  stopAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(() => {
    const view = document.getElementById("view-recordatorios");
    if (
      view &&
      !view.hidden &&
      document.visibilityState === "visible" &&
      !document.querySelector(".recordatorio-modal-backdrop") &&
      Date.now() - lastLoadedAt >= 30000
    ) {
      loadRecordatorios(false);
    }
  }, 45000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function updateHeaderAndTotal(total) {
  const totalEl = document.getElementById("recordatorios-total");
  if (!totalEl) return;
  const countText = `${total} registro${total === 1 ? "" : "s"}`;
  if (isRefreshing) {
    totalEl.innerHTML = `${countText} <span class="recordatorios-reloading-badge"><span class="recordatorios-spinner-sm" aria-hidden="true"></span> Recargando…</span>`;
  } else {
    totalEl.textContent = countText;
  }
}

function applyFiltersAndRender() {
  const container = document.getElementById("recordatorios-list-container");
  const search = document.getElementById("recordatorios-search")?.value || "";

  if (!hasLoadedOnce && isRefreshing) {
    if (container) {
      renderRecordatoriosList(container, [], {
        isLoading: true,
        isRefreshing: true,
        hasLoadedOnce: false,
        totalCached: 0,
        activeStatusFilter,
        searchTerm: search,
      });
    }
    renderRecordatoriosStats(document.getElementById("recordatorios-stats"), {
      counts: cachedCounts,
      activeStatusFilter,
    });
    updateHeaderAndTotal(0);
    return;
  }

  filteredItems = filterRecordatoriosList(cachedItems, search, activeStatusFilter);
  const total = filteredItems.length;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  if (currentPage > maxPage) currentPage = maxPage;
  const slice = filteredItems.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  renderRecordatoriosList(container, slice, {
    isLoading: false,
    isRefreshing,
    hasLoadedOnce,
    totalCached: cachedItems.length,
    activeStatusFilter,
    searchTerm: search,
  });

  renderRecordatoriosPager(document.getElementById("recordatorios-pager"), {
    currentPage,
    pageSize,
    total,
    onPageChange: (p) => {
      currentPage = p;
      applyFiltersAndRender();
    },
  });

  const counts = recalculateCounts();
  renderRecordatoriosStats(document.getElementById("recordatorios-stats"), {
    counts,
    activeStatusFilter,
  });

  updateHeaderAndTotal(total);
}

function renderRecordatoriosSync(resp) {
  const el = document.getElementById("recordatorios-sync");
  if (!el) return;
  const sync = resp?.sync;
  const rec = resp?.reconcile && typeof resp.reconcile === "object" ? resp.reconcile : null;
  const status = (sync && sync.status) || (rec && rec.status) || "";
  const imported = sync && typeof sync.imported === "number" ? sync.imported : rec?.imported_last_run;
  const msg = (sync && sync.message) || (rec && rec.message) || "";
  if (!status && imported == null && !msg) {
    el.hidden = true;
    el.textContent = "";
    el.className = "recordatorios-sync";
    return;
  }
  const bits = [];
  if (status === "not_configured") {
    bits.push("Sync n8n: sin configurar");
  } else if (status === "busy") {
    bits.push("Sync n8n: en curso…");
  } else if (status === "partial") {
    bits.push("Sync n8n: parcial");
  } else if (status === "ok") {
    bits.push("Sync n8n: al día");
  } else if (status) {
    bits.push(`Sync n8n: ${status}`);
  }
  if (typeof imported === "number" && imported > 0) {
    bits.push(`+${imported} importado${imported === 1 ? "" : "s"}`);
  }
  if (msg && status !== "ok") {
    bits.push(msg);
  }
  el.textContent = bits.join(" · ");
  el.hidden = bits.length === 0;
  el.className = "recordatorios-sync" + (status === "partial" || status === "not_configured" ? " is-partial" : status === "ok" ? " is-ok" : "");
}

export async function loadRecordatorios(force = false) {
  const container = document.getElementById("recordatorios-list-container");
  const refreshBtn = document.getElementById("btn-refresh-recordatorios");
  if (!container || isRefreshing) return;
  isRefreshing = true;

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `<span class="recordatorios-spinner-sm" aria-hidden="true"></span> Actualizando...`;
    refreshBtn.style.opacity = "0.75";
  }

  if (!hasLoadedOnce || !cachedItems.length) {
    container.innerHTML = `
      <div class="recordatorios-empty is-loading">
        <span class="recordatorios-spinner" aria-hidden="true"></span>
        <p>Cargando recordatorios...</p>
      </div>`;
  }
  updateHeaderAndTotal(filteredItems.length);

  try {
    const syncQ = force ? "&sync=1" : "";
    const resp = await api(`recordatorios.php?days=14${syncQ}&_t=${Date.now()}`, { cache: "no-store" });
    const ok = Boolean(resp && (resp.ok === true || resp.status === "success"));
    if (!ok) {
      if (!cachedItems.length) {
        container.innerHTML = `<div class="recordatorios-empty"><p>No se pudieron cargar los recordatorios.</p></div>`;
      }
      return;
    }
    const rawItems = Array.isArray(resp.items) ? resp.items : [];
    cachedItems = rawItems.filter((it) => !isBlockedRecordatorio(it));
    recalculateCounts();
    if (resp.counts && typeof resp.counts === "object") {
      cachedCounts = { ...cachedCounts, ...resp.counts };
    }
    hasLoadedOnce = true;
    lastLoadedAt = Date.now();
    renderRecordatoriosSync(resp);
    applyFiltersAndRender();

    if (refreshBtn && force) {
      refreshBtn.textContent = "✓ Actualizado";
      setTimeout(() => {
        if (refreshBtn && !isRefreshing) {
          refreshBtn.textContent = "↻ Actualizar";
          refreshBtn.disabled = false;
          refreshBtn.style.opacity = "1";
        }
      }, 1500);
    }
  } catch {
    if (!cachedItems.length) {
      container.innerHTML = `<div class="recordatorios-empty"><p>Error al cargar recordatorios.</p></div>`;
    }
  } finally {
    isRefreshing = false;
    updateHeaderAndTotal(filteredItems.length);
    if (refreshBtn && (!force || refreshBtn.textContent !== "✓ Actualizado")) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "↻ Actualizar";
      refreshBtn.style.opacity = "1";
    }
  }
}

function openRecordatorioDispatchModal(item, onSuccess) {
  const backdrop = document.createElement("div");
  backdrop.className = "recordatorio-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");

  const name = escapeHtml(item.patient_name || item.event_summary || "Paciente");
  const appt = escapeHtml([item.appointment_date, item.appointment_time].filter(Boolean).join(" · ") || "Sin fecha/hora");
  const isFailed = item.status === "failed" || item.status === "missing_phone";
  const title = isFailed ? "Disparar recordatorio manualmente" : "Enviar recordatorio ahora";
  const currentError = item.error_message || item.error_code || "";

  backdrop.innerHTML = `
    <div class="recordatorio-modal-card">
      <div class="recordatorio-modal-header">
        <h3>⚡ ${title}</h3>
        <button type="button" class="btn ghost btn-close-modal" aria-label="Cerrar">✕</button>
      </div>
      <div class="recordatorio-modal-body">
        <div class="recordatorio-modal-info">
          <div><strong>Paciente:</strong> ${name}</div>
          <div><strong>Turno:</strong> ${appt}</div>
          ${item.event_summary && item.event_summary !== item.patient_name ? `<div><strong>Detalle:</strong> ${escapeHtml(item.event_summary)}</div>` : ""}
          ${isFailed && currentError ? `<div style="color:#b42318;margin-top:6px;font-size:12px;"><strong>Motivo de fallo previo:</strong> ${escapeHtml(currentError)}</div>` : ""}
        </div>
        <div class="recordatorio-modal-field">
          <label for="dispatch-phone">Número de WhatsApp (con código de país, ej: 54911...):</label>
          <input type="tel" id="dispatch-phone" value="${escapeHtml(item.wa_id || "")}" placeholder="5491144556677" autocomplete="off" />
        </div>
        <div class="recordatorio-modal-field">
          <label for="dispatch-email">Correo electrónico (para fallback o envío por email):</label>
          <input type="email" id="dispatch-email" value="${escapeHtml(item.email || "")}" placeholder="paciente@ejemplo.com" autocomplete="off" />
        </div>
        <div class="recordatorio-modal-field">
          <label for="dispatch-channel">Canal de envío:</label>
          <select id="dispatch-channel">
            <option value="auto" selected>Automático (WhatsApp con fallback a Email)</option>
            <option value="whatsapp">Solo WhatsApp (Plantilla oficial)</option>
            <option value="email">Solo Correo Electrónico</option>
          </select>
        </div>
      </div>
      <div class="recordatorio-modal-actions">
        <button type="button" class="btn light btn-close-modal">Cancelar</button>
        <button type="button" class="btn green" id="btn-submit-dispatch">⚡ Enviar recordatorio</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  const phoneInput = backdrop.querySelector("#dispatch-phone");
  phoneInput?.focus();

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKeyDown);

  backdrop.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", close);
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  const submitBtn = backdrop.querySelector("#btn-submit-dispatch");
  submitBtn?.addEventListener("click", async () => {
    const phone = backdrop.querySelector("#dispatch-phone")?.value.trim() || "";
    const email = backdrop.querySelector("#dispatch-email")?.value.trim() || "";
    const channel = backdrop.querySelector("#dispatch-channel")?.value || "auto";

    if (channel === "email" && !email) {
      dialogAlert("Por favor ingresá una dirección de correo válida para enviar por email.", { type: "danger" });
      return;
    }
    if (channel === "whatsapp" && !phone) {
      dialogAlert("Por favor ingresá un número de teléfono para enviar por WhatsApp.", { type: "danger" });
      return;
    }
    if (channel === "auto" && !phone && !email) {
      dialogAlert("Ingresá al menos un número de WhatsApp o un correo electrónico para despachar el recordatorio.", { type: "danger" });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando recordatorio…";

    try {
      const resp = await api("recordatorios.php", {
        method: "POST",
        body: JSON.stringify({
          action: "dispatch",
          id: item.id,
          wa_id: phone,
          email: email,
          channel: channel,
        }),
      });

      if (resp && (resp.ok || resp.status === "success")) {
        close();
        if (resp.item) {
          onSuccess(resp.item);
        } else {
          loadRecordatorios(false);
        }
        dialogAlert(resp.message || "Recordatorio enviado correctamente.", { type: "success" });
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = "⚡ Enviar recordatorio";
        dialogAlert(resp?.error || "No se pudo enviar el recordatorio.", { type: "danger" });
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "⚡ Enviar recordatorio";
      const errorMsg =
        (err && (err.payload?.error || err.message)) ||
        "Error al conectar con el servidor para disparar el recordatorio.";
      dialogAlert(errorMsg, { type: "danger" });
    }
  });
}

export function initRecordatoriosModule() {
  renderRecordatoriosRules(document.getElementById("recordatorios-rules"));
  document.getElementById("btn-refresh-recordatorios")?.addEventListener("click", () => {
    loadRecordatorios(true);
  });
  document.getElementById("recordatorios-search")?.addEventListener("input", () => {
    currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-page-size")?.addEventListener("change", (e) => {
    pageSize = Math.max(10, parseInt(e.target.value, 10) || 20);
    currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-stats")?.addEventListener("click", (e) => {
    if (!hasLoadedOnce && isRefreshing) return;
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    const next = btn.getAttribute("data-filter") || "all";
    activeStatusFilter = activeStatusFilter === next ? "all" : next;
    currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-list-container")?.addEventListener("click", (e) => {
    const resetBtn = e.target.closest('[data-action="reset-filters"]');
    if (resetBtn) {
      activeStatusFilter = "all";
      const searchInput = document.getElementById("recordatorios-search");
      if (searchInput) searchInput.value = "";
      currentPage = 0;
      applyFiltersAndRender();
      return;
    }
    const btn = e.target.closest('[data-action="dispatch-manual"]');
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const item = cachedItems.find((it) => String(it.id) === String(id));
    if (!item) return;
    openRecordatorioDispatchModal(item, (updatedItem) => {
      const idx = cachedItems.findIndex((it) => String(it.id) === String(updatedItem.id));
      if (idx !== -1) {
        cachedItems[idx] = updatedItem;
      }
      recalculateCounts();
      applyFiltersAndRender();
    });
  });
}
