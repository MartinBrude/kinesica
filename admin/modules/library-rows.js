/**
 * Kinésica Admin - Renderizado de Filas y Tarjetas de Pacientes (Biblioteca)
 * Genera el marcado DOM para acordeones de pacientes agrupados, sesiones individuales
 * e indicadores clínicos (EVA, apertura bucal, CDI).
 */

import { escapeHtml } from "./dom.js?v=78";

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

  // Foto clínica adjunta
  let fotoHtml = "";
  if (item.fotoUrl) {
    fotoHtml = `<span class="session-chip session-chip-foto" title="Foto clínica adjunta">📷 Foto</span>`;
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

  actions.append(pdfBtn, delBtn);

  row.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    if (callbacks.onOpen) callbacks.onOpen(item);
  });

  return row;
}

/**
 * Renderiza la tarjeta de un paciente en el directorio de la clínica.
 * Diseñado con navegación directa por persona y acordeón inline sin pantallas intermedias.
 * @param {string} key Clave única del paciente
 * @param {Array<object>} sessions Lista de fichas del paciente (ordenadas desc por fecha)
 * @param {object} callbacks Callbacks para interactuar con la fila
 * @returns {HTMLElement}
 */
export function patientGroupRow(key, sessions, callbacks = {}) {
  const latest = sessions[0] || {};
  const isMulti = sessions.length > 1 || grouped;
  const isSearchActive = Boolean(searchInput && searchInput.value.trim().length > 0);
  const isExpanded = expandedPatients.has(key) || (isSearchActive && isMulti);

  const card = document.createElement("article");
  card.className = `patient-card ${isExpanded ? "is-expanded" : ""}`;

  // Cabecera del paciente
  const header = document.createElement("div");
  header.className = "patient-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "patient-title-group";

  // Fila superior: Nombre + badge sesiones + badge edad
  const titleRow = document.createElement("div");
  titleRow.className = "patient-title-row";

  const nameEl = document.createElement("h3");
  nameEl.textContent = latest.nombre || "Sin nombre";

  const sessBadge = document.createElement("span");
  sessBadge.className = "patient-badge";
  sessBadge.textContent = sessions.length === 1 ? "1 sesión" : `${sessions.length} sesiones`;

  titleRow.append(nameEl, sessBadge);

  const calcAge = latest.edad || ageOn(latest.nacimiento, latest.fechaSesion);
  if (calcAge) {
    const ageBadge = document.createElement("span");
    ageBadge.className = "patient-badge age";
    ageBadge.textContent = `${calcAge} años`;
    titleRow.append(ageBadge);
  }

  // Fila inferior: DNI · Última consulta · CDI
  const metaRow = document.createElement("div");
  metaRow.className = "patient-meta";

  const dniText = document.createElement("span");
  dniText.textContent = `DNI ${latest.dni || "—"}`;
  metaRow.append(dniText);

  const dot1 = document.createElement("span");
  dot1.className = "patient-meta-dot";
  dot1.textContent = "·";
  metaRow.append(dot1);

  const lastText = document.createElement("span");
  lastText.textContent = sessions.length === 1
    ? `Evaluación inicial: ${formatDate(latest.fechaSesion)}`
    : `Última visita: ${formatDate(latest.fechaSesion)}`;
  metaRow.append(lastText);

  if (Array.isArray(latest.cdi) && latest.cdi.length) {
    const dot2 = document.createElement("span");
    dot2.className = "patient-meta-dot";
    dot2.textContent = "·";
    const cdiText = document.createElement("span");
    cdiText.textContent = `CDI: ${latest.cdi.join(", ")}`;
    metaRow.append(dot2, cdiText);
  }

  titleGroup.append(titleRow, metaRow);

  // Controles de la cabecera
  const controls = document.createElement("div");
  controls.className = "row-controls";

  // + Nueva sesión (siempre presente a nivel de paciente)
  const newSess = document.createElement("button");
  newSess.type = "button";
  newSess.className = "btn light";
  newSess.textContent = "+ Nueva sesión";
  newSess.title = `Registrar una nueva consulta para ${latest.nombre || "este paciente"}`;
  newSess.addEventListener("click", (e) => {
    e.stopPropagation();
    if (callbacks.onNewSession) {
      callbacks.onNewSession(latest);
    }
  });
  controls.append(newSess);

  // PDF
  const printGroup = document.createElement("button");
  printGroup.type = "button";
  printGroup.className = "btn green";
  printGroup.textContent = isMulti ? "Historial PDF" : "PDF";
  printGroup.title = isMulti
    ? `Imprimir historial completo de ${latest.nombre || "este paciente"}`
    : `Imprimir ficha de ${latest.nombre || "este paciente"}`;
  printGroup.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMulti) {
      if (callbacks.onPdfAll) callbacks.onPdfAll(sessions);
    } else {
      if (callbacks.onPdf) callbacks.onPdf(latest);
    }
  });
  controls.append(printGroup);



  // Comparar (si tiene >= 2 sesiones)
  if (sessions.length >= 2 && callbacks.onCompare) {
    const comp = document.createElement("button");
    comp.type = "button";
    comp.className = "btn light";
    comp.textContent = "Comparar";
    comp.title = "Comparar evolución de este paciente";
    comp.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onCompare(key);
    });
    controls.append(comp);
  }

  // Quitar / Quitar todas
  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn ghost btn-icon-del-text";
  del.title = isMulti
    ? `Eliminar todas las ${sessions.length} sesiones de este paciente`
    : `Eliminar la ficha de este paciente`;
  del.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>${isMulti ? "Quitar todas" : "Quitar"}`;
  del.addEventListener("click", async (e) => {
    e.stopPropagation();
    const all = loadAll().filter((item) => patientKey(item) === key);
    const name = latest.nombre || "este paciente";
    if (isMulti) {
      const countStr = all.length === 1 ? "la sesión" : `las ${all.length} sesiones`;
      const ok = await dialogConfirm(`¿Quitar ${countStr} de ${name}? Esta acción no se puede deshacer.`, { danger: true });
      if (!ok) return;
      if (callbacks.onDeleteBatch) callbacks.onDeleteBatch(all);
    } else {
      const ok = await dialogConfirm(`¿Quitar la ficha de ${name} del ${formatDate(latest.fechaSesion)}? Esta acción no se puede deshacer.`, { danger: true });
      if (!ok) return;
      if (callbacks.onDelete) callbacks.onDelete(latest);
    }
  });
  controls.append(del);

  header.append(titleGroup, controls);

  // Clic en la cabecera:
  // Si tiene 1 sesión -> abre la ficha directamente
  // Si tiene > 1 sesión -> alterna el acordeón
  header.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    if (!isMulti) {
      if (callbacks.onOpen) callbacks.onOpen(latest);
    } else {
      if (expandedPatients.has(key)) {
        expandedPatients.delete(key);
      } else {
        expandedPatients.add(key);
      }
      renderLibrary();
    }
  });

  card.append(header);

  // Si está expandido y tiene múltiples sesiones, renderizar las sesiones particulares (sin repetir nombre ni DNI)
  if (isExpanded && isMulti) {
    const sessionsList = document.createElement("div");
    sessionsList.className = "patient-sessions";

    const total = sessions.length;
    sessions.forEach((sess, idx) => {
      const sessionNumber = total - idx;
      sessionsList.append(sessionRow(sess, latest, callbacks, sessionNumber, total));
    });

    card.append(sessionsList);
  }

  return card;
}

/**
 * Renderiza la tarjeta de una ficha individual delegando en patientGroupRow.
 * Mantenido por retrocompatibilidad y llamadas directas.
 */
export function fichaRow(item, callbacks = {}) {
  return patientGroupRow(patientKey(item), [item], callbacks);
}

let activeSessionUserGetter = null;
let activeRowCallbacks = {};

/**
 * Renderiza la vista de biblioteca completa aplicando agrupación por persona, filtrado y paginación.
 */
