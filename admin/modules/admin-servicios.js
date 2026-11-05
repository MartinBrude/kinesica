/**
 * Kinésica Admin - Supervisión de Servicios, Cuotas y Consumos
 * Monitorea WhatsApp Meta, Gemini AI, Google Cloud y Hostinger (Web, MariaDB, Correo, Almacenamiento).
 * Permite cargar directamente cualquier excedente o renovación a la vista de Gastos.
 */

import { api } from "./api.js?v=77";
import { escapeHtml } from "./dom.js?v=78";

function computeStatusBadge(used, limit) {
  if (!limit || limit <= 0) return '<span class="status-pill status-ok">Ilimitado / Sin costo</span>';
  const pct = Math.min(100, Math.round((used / limit) * 100));
  if (pct >= 90) return `<span class="status-pill status-danger">⚠️ ${pct}% consumido</span>`;
  if (pct >= 65) return `<span class="status-pill status-warn">⚡ ${pct}% en uso</span>`;
  return `<span class="status-pill status-ok">✓ ${pct}% (En cuota gratuita)</span>`;
}

function renderProgressBar(used, limit) {
  if (!limit || limit <= 0) return '<div class="quota-progress-track"><div class="quota-progress-bar bar-ok" style="width: 5%;"></div></div>';
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90 ? "bar-danger" : pct >= 65 ? "bar-warn" : "bar-ok";
  return `<div class="quota-progress-track"><div class="quota-progress-bar ${barColor}" style="width: ${Math.max(3, pct)}%;"></div></div>`;
}

function cardHtml({ icon, title, sub, badge, bodyHtml, note, link, linkText, gasto }) {
  const btnGasto = gasto
    ? `<button type="button" class="btn light btn-sm btn-gasto-action" data-gasto='${escapeHtml(JSON.stringify(gasto))}'>➕ Cargar en Gastos</button>`
    : "";
  return `
    <article class="servicio-card">
      <div class="servicio-card-header">
        <div class="servicio-title-group">
          <span class="servicio-icon">${icon}</span>
          <div>
            <h3 class="servicio-title">${escapeHtml(title)}</h3>
            <p class="servicio-sub">${escapeHtml(sub)}</p>
          </div>
        </div>
        ${badge}
      </div>
      <div class="servicio-metrics">${bodyHtml}</div>
      <div class="servicio-footer">
        <span class="servicio-note">💡 ${escapeHtml(note)}</span>
        <div class="servicio-actions">
          <a href="${escapeHtml(link || '#')}" target="_blank" rel="noopener noreferrer" class="btn light btn-sm">${escapeHtml(linkText)}</a>
          ${btnGasto}
        </div>
      </div>
    </article>
  `;
}

export function renderServicios(data) {
  const container = document.getElementById("admin-servicios-content");
  if (!container) return;

  const countPill = document.getElementById("admin-servicios-period-label");
  if (countPill && data.period) {
    countPill.textContent = `Período: ${data.period.month || "Mes actual"}`;
  }

  const periodMonth = (data.period && data.period.month) || "Mes actual";
  const wa = data.whatsapp || {};
  const gem = data.gemini || {};
  const host = data.hostinger || {};
  const st = data.storage || {};
  const lnk = data.links || {};

  const waConvs = wa.month_active_conversations || 0;
  const waLimit = wa.free_conversations_limit || 1000;
  const waExcess = Math.max(0, waConvs - waLimit);
  const waTemplates = wa.month_utility_templates_sent || 0;
  const waHasExcess = waExcess > 0;
  const waEstUsd = waHasExcess ? Math.round(waExcess * 0.045 * 100) / 100 : 0;

  container.innerHTML = `
    <div class="servicios-grid">
      <!-- 1. WHATSAPP (META) -->
      ${cardHtml({
        icon: "💬",
        title: "WhatsApp Cloud API (Meta)",
        sub: "Atención de Clara y avisos",
        badge: waHasExcess
          ? `<span class="status-pill status-danger">⚠️ ${waExcess} convs en exceso</span>`
          : computeStatusBadge(waConvs, waLimit),
        bodyHtml: `
          <div class="metric-row"><span class="metric-label">Conversaciones activas:</span><span class="metric-val"><strong>${waConvs}</strong> / ${waLimit}</span></div>
          ${renderProgressBar(waConvs, waLimit)}
          <div class="metric-breakdown">
            <div>📥 Mensajes recibidos: <strong>${wa.month_inbound_messages || 0}</strong> · 📤 Enviados: <strong>${wa.month_outbound_messages || 0}</strong></div>
            <div>📅 Recordatorios 24h: <strong>${waTemplates}</strong> plantillas enviadas</div>
            ${waHasExcess ? `<div class="metric-billable-alert">⚠️ Excedente sobre cuota gratuita: ${waExcess} conversaciones (~US$ ${waEstUsd})</div>` : ""}
          </div>
        `,
        note: "1.000 conversaciones/mes gratuitas. Solo genera facturación si se superan las 1.000 en el mes calendario.",
        link: lnk.meta_billing,
        linkText: "Facturación Meta ↗",
        gasto: { concepto: "Meta WhatsApp Cloud API", detalle: `Excedente ${periodMonth} (${waExcess} convs sobre 1.000)`, moneda: "USD", monto: waEstUsd > 0 ? waEstUsd : "" },
      })}

      <!-- 2. GEMINI (IA DE CLARA) -->
      ${cardHtml({
        icon: "✨",
        title: "Google Gemini (IA de Clara)",
        sub: "Comprensión clínica (Google AI Studio)",
        badge: computeStatusBadge(gem.today_requests || 0, gem.daily_free_limit || 1500),
        bodyHtml: `
          <div class="metric-row"><span class="metric-label">Consultas resueltas hoy:</span><span class="metric-val"><strong>${gem.today_requests || 0}</strong> / ${gem.daily_free_limit || 1500} día</span></div>
          ${renderProgressBar(gem.today_requests || 0, gem.daily_free_limit || 1500)}
          <div class="metric-breakdown">
            <div>⚡ Acumulado del mes: <strong>${gem.month_requests || 0} solicitudes</strong></div>
            <div>🛡️ Modalidad: <strong>Free Tier (AI Studio)</strong></div>
          </div>
        `,
        note: "No cobra automáticamente. Al agotarse el cupo diario se pausa temporalmente (error 429) sin generar cargos.",
        link: lnk.google_ai_studio,
        linkText: "Google AI Studio ↗",
      })}

      <!-- 3. GOOGLE CLOUD (PLACES API & MAPAS) -->
      ${cardHtml({
        icon: "📍",
        title: "Google Cloud Platform",
        sub: "Places API & Maps JS (Reseñas y Mapa)",
        badge: '<span class="status-pill status-ok">✓ Crédito USD $200/mes</span>',
        bodyHtml: `
          <div class="metric-row"><span class="metric-label">Sincronización reseñas:</span><span class="metric-val"><strong>GitHub Actions diario</strong></span></div>
          ${renderProgressBar(30, 10000)}
          <div class="metric-breakdown">
            <div>🔄 Frecuencia: <strong>1 consulta/día (~30 peticiones/mes)</strong></div>
            <div>💳 Cobertura: <strong>Consumo < 0.5% del crédito mensual</strong></div>
          </div>
        `,
        note: "Crédito mensual recurrente de USD $200. Si se supera y hay tarjeta asociada facturaría en Google Cloud.",
        link: lnk.google_cloud_billing,
        linkText: "Google Cloud Billing ↗",
        gasto: { concepto: "Google Cloud Platform", detalle: `Places API & Maps (${periodMonth})`, moneda: "USD", monto: "" },
      })}

      <!-- 4. HOSTINGER (INFRAESTRUCTURA COMPLETA) -->
      ${cardHtml({
        icon: "🗄️",
        title: "Hostinger (Hosting, Web, BD & Correo)",
        sub: "Servidor PHP, MariaDB, correos mail() y disco",
        badge: '<span class="status-pill status-ok">✓ 100% Incluido en Plan</span>',
        bodyHtml: `
          <div class="metric-row"><span class="metric-label">Espacio MariaDB:</span><span class="metric-val"><strong>${host.size_mb || 0} MB</strong> ocupados</span></div>
          ${renderProgressBar(host.size_mb || 0, 1024)}
          <div class="metric-breakdown">
            <div>✉️ Servidor de correo propio: <strong>${host.today_emails || 0} hoy / ${host.month_emails || 0} mes</strong> (incluido en abono)</div>
            <div>📁 Archivos multimedia: <strong>${st.uploads_count || 0} archivos (${st.uploads_size_mb || 0} MB)</strong></div>
            <div>👥 Pacientes: <strong>${(host.tables && host.tables.pacientes) || 0}</strong> · 📋 Historias clínicas: <strong>${(host.tables && host.tables.fichas) || 0}</strong></div>
          </div>
        `,
        note: "Todo incluido en el abono periódico de Hostinger: servidor web, base de datos MariaDB y servidor de correo PHP mail(). $0 costo variable.",
        link: lnk.hostinger,
        linkText: "Panel Hostinger (hPanel) ↗",
        gasto: { concepto: "Business Web Hosting", detalle: `Renovación Hostinger kinesica.com.ar (${periodMonth})`, moneda: "EUR", monto: 65.88 },
      })}
    </div>
  `;
}

export async function loadServiciosData() {
  const container = document.getElementById("admin-servicios-content");
  if (!container) return;
  try {
    const data = await api("servicios.php");
    if (data) renderServicios(data);
  } catch (err) {
    if (container) {
      container.innerHTML = `<div class="admin-servicios-error" style="padding: 24px; text-align: center; color: var(--danger, #b3261e);"><p>No se pudieron cargar las métricas.</p><small>${escapeHtml(err?.message || "Error")}</small></div>`;
    }
  }
}

export function initServiciosUI({ onReload } = {}) {
  const btnReload = document.getElementById("admin-btn-servicios-reload");
  if (btnReload && !btnReload.dataset.bound) {
    btnReload.dataset.bound = "1";
    btnReload.addEventListener("click", () => {
      btnReload.disabled = true;
      btnReload.textContent = "Actualizando...";
      loadServiciosData().finally(() => {
        btnReload.disabled = false;
        btnReload.textContent = "↻ Actualizar métricas";
        if (typeof onReload === "function") onReload();
      });
    });
  }

  const container = document.getElementById("admin-servicios-content");
  if (container && !container.dataset.boundGasto) {
    container.dataset.boundGasto = "1";
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-gasto-action");
      if (!btn || !btn.dataset.gasto) return;
      try {
        const payload = JSON.parse(btn.dataset.gasto);
        import("./app-tabs.js").then((tabs) => {
          tabs.switchTab("admin", "gastos");
          import("./admin-gastos-modal.js").then((modal) => {
            modal.openCreateGastoModal(payload);
          });
        });
      } catch (_) {}
    });
  }
}
