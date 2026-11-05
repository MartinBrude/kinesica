/**
 * Kinésica Admin - Supervisión de Servicios, Cuotas y Consumos
 * Monitorea WhatsApp Meta, Gemini AI, Google Cloud Places, Resend Email y MariaDB en Hostinger.
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
  if (!limit || limit <= 0) {
    return '<div class="quota-progress-track"><div class="quota-progress-bar bar-ok" style="width: 5%;"></div></div>';
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90 ? "bar-danger" : pct >= 65 ? "bar-warn" : "bar-ok";
  return `
    <div class="quota-progress-track">
      <div class="quota-progress-bar ${barColor}" style="width: ${Math.max(3, pct)}%;"></div>
    </div>
  `;
}

function cardHtml({ icon, title, sub, badge, bodyHtml, note, link, linkText }) {
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
        <a href="${escapeHtml(link || '#')}" target="_blank" rel="noopener noreferrer" class="btn light btn-sm">${escapeHtml(linkText)}</a>
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

  const wa = data.whatsapp || {};
  const gem = data.gemini || {};
  const gc = data.google_cloud || {};
  const res = data.resend || {};
  const db = data.database || {};
  const st = data.storage || {};
  const lnk = data.links || {};

  container.innerHTML = `
    <div class="servicios-grid">
      <!-- 1. WHATSAPP CLOUD API (META) -->
      ${cardHtml({
        icon: "💬",
        title: "WhatsApp Cloud API (Meta)",
        sub: "Atención de Clara y avisos",
        badge: computeStatusBadge(wa.month_active_conversations || 0, wa.free_conversations_limit || 1000),
        bodyHtml: `
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
        `,
        note: "1.000 conversaciones/mes de servicio gratuitas. Las plantillas utility (recordatorios) aplican tarifa según país si superan cupo.",
        link: lnk.meta_billing,
        linkText: "Facturación Meta ↗",
      })}

      <!-- 2. GOOGLE GEMINI (CLARA IA) -->
      ${cardHtml({
        icon: "✨",
        title: "Google Gemini (IA de Clara)",
        sub: "Comprensión clínica y atención (Google AI Studio)",
        badge: computeStatusBadge(gem.today_requests || 0, gem.daily_free_limit || 1500),
        bodyHtml: `
          <div class="metric-row">
            <span class="metric-label">Consultas IA resueltas hoy:</span>
            <span class="metric-val"><strong>${gem.today_requests || 0}</strong> / ${gem.daily_free_limit || 1500} por día</span>
          </div>
          ${renderProgressBar(gem.today_requests || 0, gem.daily_free_limit || 1500)}
          <div class="metric-breakdown">
            <div>⚡ Acumulado este mes: <strong>${gem.month_requests || 0} solicitudes</strong></div>
            <div>🛡️ Modalidad: <strong>Free Tier en Google AI Studio</strong></div>
          </div>
        `,
        note: "No cobra automáticamente. Si se agota el cupo diario se limita temporalmente (error 429) sin generar cargos.",
        link: lnk.google_ai_studio,
        linkText: "Planes Google AI Studio ↗",
      })}

      <!-- 3. GOOGLE CLOUD (PLACES API & MAPAS) -->
      ${cardHtml({
        icon: "📍",
        title: "Google Cloud Platform",
        sub: "Places API (New) & Maps JS (Reseñas y Mapa)",
        badge: '<span class="status-pill status-ok">✓ Crédito USD $200/mes</span>',
        bodyHtml: `
          <div class="metric-row">
            <span class="metric-label">Sincronización de reseñas:</span>
            <span class="metric-val"><strong>GitHub Actions diario</strong></span>
          </div>
          ${renderProgressBar(30, 10000)}
          <div class="metric-breakdown">
            <div>🔄 Frecuencia: <strong>1 consulta diaria (~30 peticiones/mes)</strong></div>
            <div>💳 Cobertura: <strong>Consumo < 0.5% del crédito gratuito mensual</strong></div>
          </div>
        `,
        note: "Google Cloud otorga un crédito mensual recurrente de USD $200. Con límites y alertas configuradas no genera costo adicional.",
        link: lnk.google_cloud_billing,
        linkText: "Google Cloud Billing ↗",
      })}

      <!-- 4. RESEND EMAIL TRANSACCIONAL -->
      ${cardHtml({
        icon: "✉️",
        title: "Resend (Emails y Códigos)",
        sub: "Códigos de acceso y notificaciones por correo",
        badge: computeStatusBadge(res.month_sent || 0, res.month_free_limit || 3000),
        bodyHtml: `
          <div class="metric-row">
            <span class="metric-label">Envíos del mes:</span>
            <span class="metric-val"><strong>${res.month_sent || 0}</strong> / ${res.month_free_limit || 3000} mes</span>
          </div>
          ${renderProgressBar(res.month_sent || 0, res.month_free_limit || 3000)}
          <div class="metric-breakdown">
            <div>✉️ Enviados hoy: <strong>${res.today_sent || 0}</strong> (tope: 100/día)</div>
            <div>🔑 Estado API Key: <strong>${res.configured ? "✓ Configurada" : "No detectada (Usa fallback mail)"}</strong></div>
          </div>
        `,
        note: "Resend bloquea los envíos si se alcanzan 100/día o 3.000/mes sin facturación automática sorpresa.",
        link: lnk.resend_dashboard,
        linkText: "Panel Resend ↗",
      })}

      <!-- 5. BASE DE DATOS Y HOSTING (HOSTINGER) -->
      ${cardHtml({
        icon: "🗄️",
        title: "Base de Datos & Almacenamiento",
        sub: "MariaDB y archivos multimedia en Hostinger",
        badge: '<span class="status-pill status-ok">✓ Tarifa plana fija</span>',
        bodyHtml: `
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
        `,
        note: "Plan contratado en Hostinger con abono periódico fijo. No hay cobros variables por consultas a la base ni por tráfico web.",
        link: lnk.hostinger,
        linkText: "Panel Hostinger (hPanel) ↗",
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
