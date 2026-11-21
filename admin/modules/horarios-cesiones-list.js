/**
 * Kinésica Admin - Listado y Consulta de Excepciones de Horario
 * Permite consultar el historial, filtrar por estado y anular/eliminar cambios.
 */

import { escapeHtml } from "./dom.js?v=79";

export function getOverrideStatusBadge(ov, todayIso) {
  if (!ov.active) return `<span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:600; padding:2px 8px; border-radius:12px; font-size:12px;">Anulada</span>`;
  if (todayIso > ov.end_date) return `<span class="badge" style="background:#f1f5f9; color:#64748b; font-weight:600; padding:2px 8px; border-radius:12px; font-size:12px;">Expirada</span>`;
  if (todayIso >= ov.start_date && todayIso <= ov.end_date) return `<span class="badge" style="background:#dcfce7; color:#166534; font-weight:600; padding:2px 8px; border-radius:12px; font-size:12px;">Activa hoy</span>`;
  return `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:600; padding:2px 8px; border-radius:12px; font-size:12px;">Próxima</span>`;
}

export function formatOverrideDescription(ov) {
  const isTransfer = ov.action === "transfer";
  const toName = ov.to_practitioner === "maria" ? "María" : "Norberto";
  const fromName = ov.from_practitioner === "norberto" ? "Norberto" : "María";
  const title = isTransfer ? `Disponible para ${toName} (cede ${fromName})` : "Cierre total de consultorio";
  const dates = ov.start_date === ov.end_date ? ov.start_date : `Del ${ov.start_date} al ${ov.end_date}`;
  const ranges = Array.isArray(ov.custom_ranges) && ov.custom_ranges.length > 0
    ? ov.custom_ranges
    : (ov.custom_range ? [ov.custom_range] : []);
  let hours = "Jornada completa";
  if (ov.time_scope === "custom_hours" && ranges.length > 0) {
    hours = ranges.map((r) => `${r.start} a ${r.end} hs`).join(" y ");
  }
  const reason = ov.reason ? ` · <em>${escapeHtml(ov.reason)}</em>` : "";
  const audit = ov.created_by ? ` · <span style="color:#64748b;">Por ${escapeHtml(ov.created_by)}</span>` : "";
  const annulled = !ov.active && ov.annulled_by ? ` · <span style="color:#dc2626;">Anulado por ${escapeHtml(ov.annulled_by)}</span>` : "";
  return { title, dates, hours, extra: `${reason}${audit}${annulled}` };
}

export function renderCesionesList({ container, overrides = [], onAnular, onDelete }) {
  if (!container) return;
  const todayIso = new Date().toISOString().split("T")[0];

  if (!overrides || overrides.length === 0) {
    container.innerHTML = `
      <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:20px; text-align:center; color:#64748b; font-size:14px;">
        No hay excepciones ni cesiones programadas. El consultorio funciona con el cronograma semanal habitual.
      </div>
    `;
    return;
  }

  const renderRows = (filter = "all") => {
    return overrides.filter((ov) => {
      if (filter === "active") return ov.active && todayIso <= ov.end_date;
      if (filter === "annulled") return !ov.active;
      if (filter === "expired") return ov.active && todayIso > ov.end_date;
      return true;
    }).map((ov) => {
      const { title, dates, hours, extra } = formatOverrideDescription(ov);
      const badge = getOverrideStatusBadge(ov, todayIso);
      const isAnnulable = ov.active && ov.end_date >= todayIso;
      const actionBtn = isAnnulable
        ? `<button type="button" class="btn light small btn-anular-cesion" data-id="${escapeHtml(ov.id)}" style="color:#b91c1c; border-color:#fca5a5; font-weight:600;">Anular</button>`
        : `<button type="button" class="btn light small btn-delete-cesion" data-id="${escapeHtml(ov.id)}" style="color:#64748b; border-color:#cbd5e1; font-size:11px;">Eliminar</button>`;

      return `
        <div class="cesion-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border:1px solid var(--line); border-radius:6px; margin-bottom:10px; background:#fff; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <strong style="color:var(--navy); font-size:14px;">${escapeHtml(title)}</strong>
              ${badge}
            </div>
            <div style="font-size:13px; color:#475569;">
              📅 ${escapeHtml(dates)} &nbsp;|&nbsp; 🕒 ${escapeHtml(hours)}${extra}
            </div>
          </div>
          <div>${actionBtn}</div>
        </div>
      `;
    }).join("");
  };

  const activeCount = overrides.filter((ov) => ov.active && todayIso <= ov.end_date).length;
  const annulledCount = overrides.filter((ov) => !ov.active).length;

  container.innerHTML = `
    <div class="cesiones-list-card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
        <h4 style="margin:0; font-size:15px; color:var(--navy);">Consultar Cambios y Excepciones (${overrides.length})</h4>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:12px; color:#64748b; font-weight:600;">Ver:</label>
          <select id="select-filter-cesiones" style="height:30px; font-size:12px; border:1px solid var(--line); border-radius:4px; padding:0 6px;">
            <option value="all">Todos (${overrides.length})</option>
            <option value="active">Vigentes y Próximos (${activeCount})</option>
            <option value="annulled">Anulados (${annulledCount})</option>
            <option value="expired">Pasados / Expirados</option>
          </select>
        </div>
      </div>
      <div id="cesiones-list-rows-wrapper">${renderRows("all")}</div>
    </div>
  `;

  const rowsWrapper = container.querySelector("#cesiones-list-rows-wrapper");
  const filterSel = container.querySelector("#select-filter-cesiones");

  const bindButtons = () => {
    container.querySelectorAll(".btn-anular-cesion").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (id && typeof onAnular === "function") onAnular(id);
      });
    });
    container.querySelectorAll(".btn-delete-cesion").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (id && typeof onDelete === "function") onDelete(id);
      });
    });
  };

  filterSel.addEventListener("change", () => {
    const html = renderRows(filterSel.value);
    rowsWrapper.innerHTML = html || `<div style="text-align:center; padding:16px; color:#64748b; font-size:13px;">No hay registros para este filtro.</div>`;
    bindButtons();
  });

  bindButtons();
}
