/**
 * Kinésica Admin - Monitor de Salud Operativa y Estado de Todas las APIs y Servicios
 * Supervisa en vivo: Mails a Pacientes/Norberto/Martín, Bot WhatsApp, Gemini IA, Reseñas Google, Turnera y APIs Internas.
 */

import { api } from "./api.js?v=79";
import { escapeHtml } from "./dom.js?v=79";

let cachedEstadoData = null;
let isLoadingEstado = false;

function getStatusPill(status, badgeText) {
  if (status === "ok") {
    return `<span class="status-pill status-ok">✓ ${escapeHtml(badgeText || "Operativo")}</span>`;
  }
  if (status === "warning") {
    return `<span class="status-pill status-warn">⚡ ${escapeHtml(badgeText || "Advertencia")}</span>`;
  }
  return `<span class="status-pill status-danger">⚠️ ${escapeHtml(badgeText || "Error / Caído")}</span>`;
}

function getGlobalHealthBanner(totals, checkedAt, isRefreshing) {
  const isOk = totals.error === 0 && totals.warning === 0;
  const isWarn = totals.error === 0 && totals.warning > 0;

  const bg = isOk ? "#ecfdf5" : isWarn ? "#fffbeb" : "#fef2f2";
  const border = isOk ? "#a7f3d0" : isWarn ? "#fde68a" : "#fecaca";
  const textColor = isOk ? "#065f46" : isWarn ? "#92400e" : "#991b1b";
  const icon = isOk ? "🟢" : isWarn ? "🟡" : "🔴";

  let title = "Todos los sistemas y APIs están funcionando correctamente";
  if (totals.error > 0) {
    title = `Atención: ${totals.error} ${totals.error === 1 ? "servicio presenta fallos" : "servicios presentan fallos"}`;
  } else if (totals.warning > 0) {
    title = `Aviso: ${totals.warning} ${totals.warning === 1 ? "servicio requiere atención" : "servicios requieren atención"}`;
  }

  const spinnerHtml = isRefreshing
    ? '<span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px;" aria-hidden="true"></span>'
    : "↻";

  return `
    <div style="background: ${bg}; border: 1px solid ${border}; border-radius: var(--radius); padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
        <span style="font-size: 22px;" aria-hidden="true">${icon}</span>
        <div>
          <div style="font-weight: 700; font-size: 14px; color: ${textColor};">${escapeHtml(title)}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            Total monitoreado: <strong>${totals.total || 0} APIs y servicios</strong> · 
            Operativos: <strong style="color: #10b981;">${totals.ok || 0}</strong> · 
            Advertencias: <strong style="color: #f59e0b;">${totals.warning || 0}</strong> · 
            Errores: <strong style="color: #ef4444;">${totals.error || 0}</strong> · 
            Comprobado: <strong>${escapeHtml(checkedAt || "Ahora")}</strong>
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <button type="button" class="btn light btn-sm" id="btn-refresh-estado-servicios" ${isRefreshing ? "disabled" : ""} style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
          ${spinnerHtml} <span>${isRefreshing ? "Comprobando..." : "Verificar estado en vivo"}</span>
        </button>
      </div>
    </div>
  `;
}

function renderCard(itemKey, item) {
  const pill = getStatusPill(item.status, item.badge);
  const testButtonHtml = item.can_test
    ? `<button type="button" class="btn light btn-sm btn-test-service-mail" data-target="${escapeHtml(item.target_key)}" style="font-size: 11px; padding: 4px 10px; margin-top: 8px;">✉️ Probar entrega de correo</button>`
    : "";

  return `
    <div class="salud-card salud-status-${escapeHtml(item.status || "ok")}">
      <div class="salud-card-top">
        <div style="min-width: 0; flex: 1;">
          <div class="salud-card-type">${escapeHtml(item.type || "Servicio")}</div>
          <h3 class="salud-card-name">${escapeHtml(item.name || itemKey)}</h3>
        </div>
        <div class="salud-card-badge-wrap">${pill}</div>
      </div>
      <div class="salud-card-detail">${escapeHtml(item.detail || "")}</div>
      ${testButtonHtml}
    </div>
  `;
}

function renderCategory(title, icon, items) {
  if (!items || Object.keys(items).length === 0) return "";
  const keys = Object.keys(items);
  const cardsHtml = keys.map((k) => renderCard(k, items[k])).join("");

  return `
    <section class="salud-section-group">
      <div class="salud-group-header">
        <span class="salud-group-icon" aria-hidden="true">${icon}</span>
        <h3 class="salud-group-title">${escapeHtml(title)}</h3>
        <span class="salud-group-count">(${keys.length} items)</span>
      </div>
      <div class="salud-cards-grid">${cardsHtml}</div>
    </section>
  `;
}

export function renderEstadoServicios(data, isRefreshing = false) {
  const container = document.getElementById("clara-estado-monitor-wrap");
  if (!container) return;

  if (!data) {
    container.innerHTML = `
      <div class="admin-view-loading" style="padding: 24px; text-align: center;">
        <span class="loading-spinner" aria-hidden="true"></span>
        <span style="margin-left: 8px; color: var(--muted); font-size: 13px;">Comprobando la salud de todas las APIs y servicios...</span>
      </div>
    `;
    return;
  }

  const totals = data.totals || { total: 0, ok: 0, warning: 0, error: 0 };
  const categories = data.categories || {};

  const bannerHtml = getGlobalHealthBanner(totals, data.checked_at, isRefreshing);
  const groupComms = renderCategory("Comunicaciones y Notificaciones por Correo", "📬", categories.comunicaciones);
  const groupClara = renderCategory("Bot Clara & Motores de Inteligencia Artificial", "🤖", categories.clara_ia);
  const groupAgenda = renderCategory("Agenda, Turnera Web & Sincronización de Reseñas", "📅", categories.agenda_y_web);
  const groupAdmin = renderCategory("APIs Propias de Gestión y Base de Datos", "🛠️", categories.apis_internas_admin);

  container.innerHTML = `
    <div class="salud-monitor-container">
      ${bannerHtml}
      ${groupComms}
      ${groupClara}
      ${groupAgenda}
      ${groupAdmin}
    </div>
  `;

  bindEstadoServiciosEvents();
}

async function handleTestMailClick(btn) {
  const target = btn.getAttribute("data-target");
  if (!target) return;

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="loading-spinner" style="width: 12px; height: 12px; border-width: 2px;" aria-hidden="true"></span> Despachando...`;

  try {
    const res = await api(`estado_servicios.php?action=test_mail&target=${encodeURIComponent(target)}&_t=${Date.now()}`);
    if (res && res.success) {
      btn.innerHTML = `✓ Entregado (${escapeHtml(res.transport || "OK")})`;
      btn.style.color = "#166534";
      btn.style.borderColor = "#bbf7d0";
      btn.style.background = "#dcfce7";
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.color = "";
        btn.style.borderColor = "";
        btn.style.background = "";
      }, 5000);
    } else {
      btn.innerHTML = `⚠️ Error al enviar`;
      btn.style.color = "#991b1b";
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.color = "";
      }, 4000);
    }
  } catch (err) {
    btn.innerHTML = `⚠️ Falló conexión`;
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 4000);
  }
}

export function bindEstadoServiciosEvents() {
  const refreshBtn = document.getElementById("btn-refresh-estado-servicios");
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "1";
    refreshBtn.addEventListener("click", () => {
      loadEstadoServicios(true);
    });
  }

  const testBtns = document.querySelectorAll(".btn-test-service-mail");
  testBtns.forEach((btn) => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => handleTestMailClick(btn));
    }
  });
}

export async function loadEstadoServicios(forceRefresh = false) {
  if (isLoadingEstado) return;
  if (cachedEstadoData && !forceRefresh) {
    renderEstadoServicios(cachedEstadoData, false);
    return;
  }

  isLoadingEstado = true;
  if (cachedEstadoData) {
    renderEstadoServicios(cachedEstadoData, true);
  } else {
    renderEstadoServicios(null, true);
  }

  try {
    const res = await api(`estado_servicios.php?_t=${Date.now()}`);
    if (res && res.totals) {
      cachedEstadoData = res;
      renderEstadoServicios(res, false);
    }
  } catch (err) {
    console.warn("No se pudo cargar el estado de servicios:", err);
    const container = document.getElementById("clara-estado-monitor-wrap");
    if (container) {
      container.innerHTML = `
        <div style="padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius); color: #991b1b; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
          <span>⚠️ Error al conectar con el endpoint de diagnóstico (admin/api/estado_servicios.php).</span>
          <button type="button" class="btn light btn-sm" id="btn-retry-estado-servicios">Reintentar</button>
        </div>
      `;
      document.getElementById("btn-retry-estado-servicios")?.addEventListener("click", () => loadEstadoServicios(true));
    }
  } finally {
    isLoadingEstado = false;
  }
}
