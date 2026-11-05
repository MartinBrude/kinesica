/**
 * Kinésica Admin - Supervisión de Servicios, Cuotas y Consumos
 * Monitorea el consumo de WhatsApp Meta, IA Gemini, Resend Email y Almacenamiento MariaDB.
 */

import { api } from "./api.js?v=77";
import { escapeHtml } from "./dom.js?v=78";

let cachedServicios = null;

function computeStatusBadge(used, limit, label = "cuota") {
  if (!limit || limit <= 0) return '<span class="status-pill status-ok">Ilimitado / Sin costo</span>';
  const pct = Math.min(100, Math.round((used / limit) * 100));
  if (pct >= 90) {
    return `<span class="status-pill status-danger">⚠️ ${pct}% consumido</span>`;
  }
  if (pct >= 65) {
    return `<span class="status-pill status-warn">⚡ ${pct}% en uso</span>`;
  }
  return `<span class="status-pill status-ok">✓ ${pct}% (En cuota gratuita)</span>`;
}

function renderProgressBar(used, limit) {
  if (!limit || limit <= 0) {
    return '<div class="quota-progress-track"><div class="quota-progress-bar bar-ok" style="width: 5%;"></div></div>';
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  let barColor = "bar-ok";
  if (pct >= 90) barColor = "bar-danger";
  else if (pct >= 65) barColor = "bar-warn";
  return `
    <div class="quota-progress-track">
      <div class="quota-progress-bar ${barColor}" style="width: ${Math.max(3, pct)}%;"></div>
    </div>
  `;
}

export function renderServicios(data) {
  const container = document.getElementById("admin-servicios-content");
  if (!container) return;

  const countPill = document.getElementById("admin-servicios-period-label");
  if (countPill && data.period) {
    countPill.textContent = `Período: ${escapeHtml(data.period.month || "Mes actual")}`;
  }

  const wa = data.whatsapp || {};
  const gem = data.gemini || {};
  const res = data.resend || {};
  const db = data.database || {};
  const st = data.storage || {};
  const lnk = data.links || {};

  container.innerHTML = `
    <div class="servicios-grid">
      <!-- 1. META WHATSAPP CLOUD API -->
      <article class="servicio-card">
        <div class="servicio-card-header">
          <div class="servicio-title-group">
            <span class="servicio-icon">💬</span>
            <div>
              <h3 class="servicio-title">WhatsApp Cloud API (Meta)</h3>
              <p class="servicio-sub">Conversaciones de atención de Clara y avisos</p>
            </div>
          </div>
          ${computeStatusBadge(wa.month_active_conversations || 0, wa.free_conversations_limit || 1000)}
        </div>

        <div class="servicio-metrics">
          <div class="metric-row">
            <span class="metric-label">Conversaciones activas (este mes):</span>
            <span class="metric-val"><strong>${wa.month_active_conversations || 0}</strong> / ${wa.free_conversations_limit || 1000}</span>
          </div>
          ${renderProgressBar(wa.month_active_conversations || 0, wa.free_conversations_limit || 1000)}

          <div class="metric-breakdown">
            <div>📥 Mensajes recibidos: <strong>${wa.month_inbound_messages || 0}</strong></div>
            <div>📤 Respuestas enviadas: <strong>${wa.month_outbound_messages || 0}</strong></div>
            <div>📅 Recordatorios 24h (Plantillas): <strong>${wa.month_utility_templates_sent || 0}</strong></div>
          </div>
        </div>

        <div class="servicio-footer">
          <span class="servicio-note">💡 1.000 conversaciones/mes gratuitas. Las plantillas salientes pueden facturar si se supera el tope o hay tarjeta asociada.</span>
          <a href="${escapeHtml(lnk.meta_billing || '#')}" target="_blank" rel="noopener noreferrer" class="btn light btn-sm">Consola Facturación Meta ↗</a>
        </div>
      </article>

      <!-- 2. GOOGLE GEMINI (CLARA IA) -->
      <article class="servicio-card">
        <div class="servicio-card-header">
          <div class="servicio-title-group">
            <span class="servicio-icon">✨</span>
            <div>
              <h3 class="servicio-title">Google Gemini (IA de Clara)</h3>
              <p class="servicio-sub">Comprensión conversacional y extracción clínica</p>
            </div>
          </div>
          ${computeStatusBadge(gem.today_requests || 0, gem.daily_free_limit || 1500)}
        </div>

        <div class="servicio-metrics">
          <div class="metric-row">
            <span class="metric-label">Consultas IA resueltas hoy:</span>
            <span class="metric-val"><strong>${gem.today_requests || 0}</strong> / ${gem.daily_free_limit || 1500} por día</span>
          </div>
          ${renderProgressBar(gem.today_requests || 0, gem.daily_free_limit || 1500)}

          <div class="metric-breakdown">
            <div>⚡ Acumulado este mes: <strong>${gem.month_requests || 0} solicitudes</strong></div>
            <div>🛡️ Plan actual: <strong>Free Tier (AI Studio)</strong></div>
          </div>
        </div>

        <div class="servicio-footer">
          <span class="servicio-note">💡 No cobra automáticamente. Si se agota el cupo diario se limita temporalmente (error 429) sin generar cargos.</span>
          <a href="${escapeHtml(lnk.google_ai_studio || '#')}" target="_blank" rel="noopener noreferrer" class="btn light btn-sm">Planes Google AI Studio ↗</a>
        </div>
      </article>

      <!-- 3. RESEND EMAIL TRANSACCIONAL -->
      <article class="servicio-card">
        <div class="servicio-card-header">
          <div class="servicio-title-group">
            <span class="servicio-icon">✉️</span>
            <div>
              <h3 class="servicio-title">Resend (Emails y Códigos)</h3>
              <p class="servicio-sub">Códigos de acceso al panel y notificaciones por correo</p>
            </div>
          </div>
          ${computeStatusBadge(res.month_sent || 0, res.month_free_limit || 3000)}
        </div>

        <div class="servicio-metrics">
          <div class="metric-row">
            <span class="metric-label">Envíos del mes:</span>
            <span class="metric-val"><strong>${res.month_sent || 0}</strong> / ${res.month_free_limit || 3000} mes</span>
          </div>
          ${renderProgressBar(res.month_sent || 0, res.month_free_limit || 3000)}

          <div class="metric-breakdown">
            <div>✉️ Enviados hoy: <strong>${res.today_sent || 0}</strong> (tope: 100/día)</div>
            <div>🔑 Estado API Key: <strong>${res.configured ? "✓ Configurada" : "No detectada (Usa fallback mail)"}</strong></div>
          </div>
        </div>

        <div class="servicio-footer">
          <span class="servicio-note">💡 Resend bloquea los envíos si se alcanzan 100/día o 3.000/mes sin facturación automática sorpresa.</span>
          <a href="${escapeHtml(lnk.resend_dashboard || '#')}" target="_blank" rel="noopener noreferrer" class="btn light btn-sm">Panel Resend ↗</a>
        </div>
      </article>

      <!-- 4. BASE DE DATOS Y HOSTING (HOSTINGER) -->
      <article class="servicio-card">
        <div class="servicio-card-header">
          <div class="servicio-title-group">
            <span class="servicio-icon">🗄️</span>
            <div>
              <h3 class="servicio-title">Base de Datos & Almacenamiento</h3>
              <p class="servicio-sub">MariaDB (Hostinger) y multimedia en disco</p>
            </div>
          </div>
          <span class="status-pill status-ok">✓ Tarifa plana fija</span>
        </div>

        <div class="servicio-metrics">
          <div class="metric-row">
            <span class="metric-label">Espacio MariaDB:</span>
            <span class="metric-val"><strong>${db.size_mb || 0} MB</strong> ocupados</span>
          </div>
          ${renderProgressBar(db.size_mb || 0, 1024)}

          <div class="metric-breakdown">
            <div>📁 Archivos multimedia: <strong>${st.uploads_count || 0} archivos (${st.uploads_size_mb || 0} MB)</strong></div>
            <div>👥 Pacientes registrados: <strong>${(db.tables && db.tables.pacientes) || 0}</strong></div>
            <div>📋 Historias clínicas ATM: <strong>${(db.tables && db.tables.fichas) || 0}</strong></div>
          </div>
        </div>

        <div class="servicio-footer">
          <span class="servicio-note">💡 Hosting con abono fijo. No existen costos variables por cantidad de consultas a la base ni por tráfico web.</span>
          <a href="${escapeHtml(lnk.google_cloud_billing || '#')}" target="_blank" rel="noopener noreferrer" class="btn light btn-sm">Google Cloud Billing ↗</a>
        </div>
      </article>
    </div>
  `;
}

export async function loadServiciosData() {
  const container = document.getElementById("admin-servicios-content");
  if (!container) return;

  try {
    const data = await api("servicios.php");
    if (data) {
      cachedServicios = data;
      renderServicios(data);
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="admin-servicios-error" style="padding: 24px; text-align: center; color: var(--danger, #b3261e);">
          <p>No se pudieron cargar las métricas de consumo en tiempo real.</p>
          <small>${escapeHtml(err?.message || "Error de conexión")}</small>
        </div>
      `;
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
}
