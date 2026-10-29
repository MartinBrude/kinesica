/**
 * Kinésica Admin - Fila de Sesión Individual (Biblioteca)
 * Genera el marcado DOM para una sesión particular dentro del acordeón de paciente.
 */

import { escapeHtml, dialogConfirm } from "./dom.js?v=78";
import { formatDate } from "./api.js?v=77";
import { getSessionUser } from "./auth.js?v=81";

export function sessionRow(item, patient, callbacks = {}, sessionIndex = 1, totalSessions = 1) {
  const row = document.createElement("div");
  row.className = "session-row";

  const isInitial = sessionIndex === 1;
  const label = isInitial ? "Evaluación inicial" : `Sesión N° ${sessionIndex}`;

  // Indicador EVA de dolor
  let evaBadgeHtml = "";
  if (item.eva !== undefined && item.eva !== null && String(item.eva).trim() !== "") {
    const val = Number(item.eva);
    const colorClass = val <= 3 ? "eva-green" : val <= 6 ? "eva-yellow" : "eva-red";
    evaBadgeHtml = `<span class="session-chip ${colorClass}">EVA ${val}/10</span>`;
  }

  // Apertura bucal
  let aperturaHtml = "";
  if (item.aperturaLibre) {
    aperturaHtml = `<span class="session-chip">Apertura ${escapeHtml(item.aperturaLibre)} mm</span>`;
  }

  // Criterio CDI
  let cdiHtml = "";
  if (Array.isArray(item.cdi) && item.cdi.length) {
    cdiHtml = `<span class="session-chip">CDI: ${escapeHtml(item.cdi.join(", "))}</span>`;
  }

  // Anotaciones de la sesión
  let anotacionesHtml = "";
  if (item.anotaciones && item.anotaciones.trim()) {
    const preview = item.anotaciones.trim().length > 30
      ? `${item.anotaciones.trim().slice(0, 30)}…`
      : item.anotaciones.trim();
    anotacionesHtml = `<span class="session-chip session-chip-notes" title="${escapeHtml(item.anotaciones.trim())}">📝 ${escapeHtml(preview)}</span>`;
  }

  // Fotos clínicas adjuntas
  let fotoHtml = "";
  const totalFotos = Array.isArray(item.fotosUrls) && item.fotosUrls.length > 0
    ? item.fotosUrls.length
    : (item.fotoUrl ? 1 : 0);
  if (totalFotos > 0) {
    const fotoLabel = totalFotos === 1 ? "📷 Foto" : `📷 ${totalFotos} fotos`;
    const fotoTitle = totalFotos === 1 ? "1 foto clínica adjunta" : `${totalFotos} fotos clínicas adjuntas`;
    fotoHtml = `<span class="session-chip session-chip-foto" title="${fotoTitle}">${fotoLabel}</span>`;
  }

  // Profesional
  const profName = item.profesionalNombre || (item.profesional === "norberto" ? "Norberto" : item.profesional === "maria" ? "María" : "");
  const profHtml = profName ? `<span class="session-prof">${escapeHtml(profName)}</span>` : "";

  row.innerHTML = `
    <div class="session-info">
      <span class="session-num">${label}</span>
      <span class="session-date">${formatDate(item.fechaSesion)}</span>
      ${profHtml}
      <div class="session-chips">
        ${evaBadgeHtml}
        ${aperturaHtml}
        ${cdiHtml}
        ${anotacionesHtml}
        ${fotoHtml}
      </div>
    </div>
    <div class="session-actions"></div>
  `;

  const actions = row.querySelector(".session-actions");

  const pdfBtn = document.createElement("button");
  pdfBtn.type = "button";
  pdfBtn.className = "btn green";
  pdfBtn.textContent = "PDF";
  pdfBtn.title = `Imprimir ficha de esta sesión (${formatDate(item.fechaSesion)})`;
  pdfBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (callbacks.onPdf) callbacks.onPdf(item);
  });

  const jsonBtn = document.createElement("button");
  jsonBtn.type = "button";
  jsonBtn.className = "btn ghost";
  jsonBtn.textContent = "JSON";
  jsonBtn.hidden = true;

  const isColaborador = getSessionUser()?.role === "colaborador";
  if (!isColaborador) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn ghost btn-icon-del";
    delBtn.title = "Quitar ficha";
    delBtn.setAttribute("aria-label", "Quitar ficha");
    delBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>`;
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const name = patient?.nombre || item.nombre || "esta ficha";
      const ok = await dialogConfirm(`¿Quitar la ficha de ${name} del ${formatDate(item.fechaSesion)}? Esta acción no se puede deshacer.`, { danger: true });
      if (!ok) return;
      if (callbacks.onDelete) callbacks.onDelete(item);
    });
    actions.append(delBtn);
  }

  actions.prepend(pdfBtn);

  row.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    if (callbacks.onOpen) callbacks.onOpen(item);
  });

  return row;
}
