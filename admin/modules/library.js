/**
 * Kinésica Admin - Biblioteca de Historias Clínicas y Pacientes
 * Gestiona el listado de fichas, agrupación de sesiones por paciente,
 * búsqueda normalizada con debounce, paginación e importación/exportación JSON.
 */

import {
  patientKey,
  matchFichaSearch,
  ownsFicha,
  nextSession,
  coerceFicha,
  missingFields,
  exampleFicha,
  ageOn,
} from "../ficha-rules.mjs?v=77";
import { formatDate } from "./api.js?v=77";
import { debounce, escapeHtml } from "./dom.js?v=77";
import { todayISO } from "./form.js?v=77";

const libraryView = document.querySelector("#view-library");
const listEl = document.querySelector("#library-list");
const patientSelect = document.querySelector("#pdf-patient");
const searchInput = document.querySelector("#search");
const pageSizeSelect = document.querySelector("#page-size");
const sortPatientsSelect = document.querySelector("#sort-patients");
const libraryPager = document.querySelector("#library-pager");
const mineButton = document.querySelector("#btn-mine");
const btnGroup = document.querySelector("#btn-group");
const btnNew = document.querySelector("#btn-new");
const btnSeed = document.querySelector("#btn-seed");
const btnExport = document.querySelector("#btn-export");

let cache = [];
let grouped = false;
let focusedPatient = null;
let page = 0;
let onlyMine = false;
let mineDefaultApplied = false;
let expandedPatients = new Set();
let patientSortMode = "name";
try {
  const s = localStorage.getItem("kinesica_patient_sort");
  if (s === "recent" || s === "name") patientSortMode = s;
} catch {}

let activeUpsert = null;
let activeBlank = null;
let activeFillForm = null;
let activeShowForm = null;

function upsert(item) {
  if (typeof activeUpsert === "function") {
    return activeUpsert(item);
  }
  return Promise.resolve(item);
}

function blank() {
  if (typeof activeBlank === "function") {
    return activeBlank();
  }
  return {};
}

function fillForm(data) {
  if (typeof activeFillForm === "function") {
    activeFillForm(data);
  }
}

function showForm(targetStep = 0) {
  if (typeof activeShowForm === "function") {
    activeShowForm(targetStep);
  }
}

const SEED_PEOPLE = [
  ["Lucía Fernández", "30111201"], ["Mateo Ruiz", "30111202"], ["Sofía Álvarez", "30111203"],
  ["Benjamín Castro", "30111204"], ["Valentina Díaz", "30111205"], ["Joaquín Romero", "30111206"],
  ["Emma Suárez", "30111207"], ["Bautista Molina", "30111208"], ["Catalina Vargas", "30111209"],
  ["Thiago Navarro", "30111210"], ["Olivia Pereyra", "30111211"], ["Santino Acosta", "30111212"],
  ["Isabella Medina", "30111213"], ["Felipe Cabrera", "30111214"], ["Martina Ríos", "30111215"],
  ["Gael Paredes", "30111216"], ["Renata Quiroga", "30111217"], ["Ian Ferreyra", "30111218"],
  ["Zoe Maldonado", "30111219"], ["León Herrera", "30111220"],
];

/**
 * Devuelve la lista en memoria de todas las fichas cargadas.
 * @returns {Array<object>}
 */
export function loadAll() {
  return cache;
}

/**
 * Actualiza la caché en memoria de fichas clínicas.
 * @param {Array<object>} items
 */
export function setCache(items) {
  cache = items || [];
}

/**
 * Muestra la vista de biblioteca y oculta las demás.
 */
export function showLibrary() {
  const formView = document.querySelector("#view-form");
  const compareView = document.querySelector("#view-compare");
  const gateView = document.querySelector("#view-gate");
  if (gateView) gateView.hidden = true;
  if (formView) formView.hidden = true;
  if (compareView) compareView.hidden = true;
  if (libraryView) libraryView.hidden = false;
  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "library" }));
  } catch {}
  renderLibrary();
}

/**
 * Filtra las fichas visibles según usuario, término de búsqueda y orden cronológico.
 * @param {object|null} sessionUser Usuario actual
 * @returns {Array<object>}
 */
export function visibleFichas(sessionUser = null) {
  const q = searchInput ? searchInput.value : "";
  return loadAll()
    .filter((item) => !onlyMine || ownsFicha(item, sessionUser?.username))
    .filter((item) => matchFichaSearch(item, q))
    .sort((a, b) => (b.fechaSesion || "").localeCompare(a.fechaSesion || ""));
}

/**
 * Aplica el corte de paginación para una lista de elementos.
 * @param {Array<any>} rows Lista de filas a paginar
 * @returns {Array<any>} Subconjunto de filas según la página actual
 */
export function pageWindow(rows) {
  const size = pageSizeSelect && pageSizeSelect.value === "all"
    ? rows.length
    : Number(pageSizeSelect?.value || 25);
  const totalPages = Math.max(1, Math.ceil(rows.length / (size || 1)));
  page = Math.min(page, totalPages - 1);

  if (libraryPager) {
    libraryPager.innerHTML = "";
    if (rows.length > 0 && size < rows.length) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "btn ghost";
      prev.textContent = "← Anterior";
      prev.disabled = page === 0;
      prev.addEventListener("click", () => {
        page -= 1;
        renderLibrary();
      });

      const span = document.createElement("span");
      const unit = rows.length === 1 ? "paciente" : "pacientes";
      span.textContent = `Página ${page + 1} de ${totalPages} (${rows.length} ${unit})`;

      const next = document.createElement("button");
      next.type = "button";
      next.className = "btn ghost";
      next.textContent = "Siguiente →";
      next.disabled = page >= totalPages - 1;
      next.addEventListener("click", () => {
        page += 1;
        renderLibrary();
      });

      libraryPager.append(prev, span, next);
    }
  }

  const start = page * size;
  return rows.slice(start, start + size);
}

/**
 * Sincroniza el texto y apariencia del botón de filtro personal ("Mis pacientes").
 */
export function syncMineButton() {
  if (!mineButton) return;
  mineButton.setAttribute("aria-pressed", String(onlyMine));
  mineButton.classList.toggle("is-active", onlyMine);
}

/**
 * Descarga una ficha o un conjunto de fichas en formato archivo JSON.
 * @param {object|Array<object>} data
 * @param {string} todayStr
 */
export function downloadJSON(data, todayStr = "") {
  const isArray = Array.isArray(data);
  const name = isArray
    ? "fichas-atm"
    : `ficha-${(data.nombre || "paciente").replace(/\s+/g, "_")}`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${todayStr || new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Renderiza una fila de sesión dentro del acordeón de un paciente.
 * No repite el nombre ni el DNI del paciente; muestra información clínica concisa y directa.
 * @param {object} item Datos de la sesión
 * @param {object} patient Datos del paciente
 * @param {object} callbacks Callbacks para interactuar con la sesión
 * @param {number} sessionIndex Número cronológico de sesión (1..N)
 * @param {number} totalSessions Total de sesiones del paciente
 * @returns {HTMLElement}
 */
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
      </div>
    </div>
    <div class="session-actions"></div>
  `;

  const actions = row.querySelector(".session-actions");

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "btn light";
  openBtn.textContent = "Abrir";
  openBtn.title = `Abrir ficha del ${formatDate(item.fechaSesion)}`;
  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (callbacks.onOpen) callbacks.onOpen(item);
  });

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
  jsonBtn.title = "Descargar JSON de esta sesión";
  jsonBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (callbacks.onDownloadJson) callbacks.onDownloadJson(item);
  });

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
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const name = patient?.nombre || item.nombre || "esta ficha";
    if (!window.confirm(`¿Quitar la ficha de ${name} del ${formatDate(item.fechaSesion)}? Esta acción no se puede deshacer.`)) {
      return;
    }
    if (callbacks.onDelete) callbacks.onDelete(item);
  });

  actions.append(openBtn, pdfBtn, jsonBtn, delBtn);

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

  // Si tiene 1 sola sesión: botón Abrir directo
  if (!isMulti) {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn light";
    openBtn.textContent = "Abrir";
    openBtn.title = `Abrir ficha de ${latest.nombre || "este paciente"}`;
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (callbacks.onOpen) callbacks.onOpen(latest);
    });
    controls.append(openBtn);
  }

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

  // JSON (solo cuando la fila es una única ficha)
  if (!isMulti) {
    const jsonBtn = document.createElement("button");
    jsonBtn.type = "button";
    jsonBtn.className = "btn ghost";
    jsonBtn.textContent = "JSON";
    jsonBtn.title = `Descargar JSON de ${latest.nombre || "este paciente"}`;
    jsonBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (callbacks.onDownloadJson) callbacks.onDownloadJson(latest);
    });
    controls.append(jsonBtn);
  }

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

  // Botón Acordeón para pacientes con múltiples sesiones
  if (isMulti) {
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn ghost btn-toggle-sessions";
    toggleBtn.innerHTML = isExpanded
      ? `Ocultar sesiones (${sessions.length}) <span class="chevron">▴</span>`
      : `Ver sesiones (${sessions.length}) <span class="chevron">▾</span>`;
    toggleBtn.title = isExpanded ? "Plegar sesiones" : "Ver sesiones de este paciente";
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (expandedPatients.has(key)) {
        expandedPatients.delete(key);
      } else {
        expandedPatients.add(key);
      }
      renderLibrary();
    });
    controls.append(toggleBtn);
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
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    const all = loadAll().filter((item) => patientKey(item) === key);
    const name = latest.nombre || "este paciente";
    if (isMulti) {
      const countStr = all.length === 1 ? "la sesión" : `las ${all.length} sesiones`;
      if (!window.confirm(`¿Quitar ${countStr} de ${name}? Esta acción no se puede deshacer.`)) {
        return;
      }
      if (callbacks.onDeleteBatch) {
        callbacks.onDeleteBatch(all);
      }
    } else {
      if (!window.confirm(`¿Quitar la ficha de ${name} del ${formatDate(latest.fechaSesion)}? Esta acción no se puede deshacer.`)) {
        return;
      }
      if (callbacks.onDelete) {
        callbacks.onDelete(latest);
      }
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
export function renderLibrary() {
  if (!listEl) return;
  const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;

  if (sessionUser && !mineDefaultApplied) {
    mineDefaultApplied = true;
    onlyMine = sessionUser.username === "norberto" || sessionUser.username === "maria";
  }
  syncMineButton();

  const items = visibleFichas(sessionUser);

  // Sincronizar selector de pacientes para PDF
  if (patientSelect) {
    const prevPatient = focusedPatient || patientSelect.value;
    patientSelect.innerHTML = '<option value="__all__">Todos los pacientes</option>';
    const seenPatients = new Map();
    for (const item of items) {
      const key = patientKey(item);
      if (!seenPatients.has(key)) {
        seenPatients.set(key, item.nombre || "Sin nombre");
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = `${item.nombre || "Sin nombre"} (DNI ${item.dni || "—"})`;
        patientSelect.append(opt);
      }
    }
    patientSelect.value = (focusedPatient && seenPatients.has(focusedPatient))
      ? focusedPatient
      : (seenPatients.has(prevPatient) || prevPatient === "__all__" ? prevPatient : "__all__");
  }

  // Agrupar todas las fichas en pacientes
  const groupMap = new Map();
  for (const item of items) {
    const key = patientKey(item);
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(item);
  }

  // Si hay un paciente seleccionado específicamente en el filtro/selector
  let groups = [...groupMap.entries()];
  if (focusedPatient) {
    groups = groups.filter(([key]) => key === focusedPatient);
    expandedPatients.add(focusedPatient);
  }

  // Ordenar pacientes: Alfabético por nombre (A-Z) o por Última atención (recientes)
  if (patientSortMode === "recent") {
    groups.sort((a, b) => (b[1][0]?.fechaSesion || "").localeCompare(a[1][0]?.fechaSesion || ""));
  } else {
    // Por defecto alfabético por nombre ("por persona")
    groups.sort((a, b) => (a[1][0]?.nombre || "").localeCompare(b[1][0]?.nombre || "", "es", { sensitivity: "base" }));
  }

  const fragment = document.createDocumentFragment();

  // Si hay filtro de paciente activo (focusedPatient), mostrar un banner rápido con botón para volver
  if (focusedPatient && groups.length) {
    const pName = groups[0][1][0]?.nombre || "Paciente";
    const filterBanner = document.createElement("div");
    filterBanner.className = "card-row";
    filterBanner.style.background = "var(--sky)";
    filterBanner.style.marginBottom = "10px";
    filterBanner.style.padding = "10px 16px";

    const bannerInfo = document.createElement("div");
    bannerInfo.innerHTML = `<h3 style="margin:0; font-size:15px; color:var(--navy);">Filtrando por: <strong>${escapeHtml(pName)}</strong></h3>`;

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "btn light";
    backBtn.textContent = "← Ver todos los pacientes";
    backBtn.addEventListener("click", () => {
      focusedPatient = null;
      if (patientSelect) patientSelect.value = "__all__";
      page = 0;
      renderLibrary();
    });

    filterBanner.append(bannerInfo, backBtn);
    fragment.append(filterBanner);
  }

  if (!groups.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = searchInput?.value || onlyMine
      ? "No se encontraron pacientes con los filtros actuales."
      : "No hay pacientes guardados todavía.";
    fragment.append(p);
  } else {
    const slice = pageWindow(groups);
    for (const [key, sessions] of slice) {
      fragment.append(patientGroupRow(key, sessions, activeRowCallbacks));
    }
  }

  listEl.replaceChildren(fragment);
}

/**
 * Inicializa los controladores de eventos de la biblioteca de fichas.
 * @param {object} callbacks Callbacks y dependencias
 */
export function initLibrary({
  getSessionUser,
  onOpenFicha,
  onNewSessionFicha,
  onPdfFicha,
  onDeleteFicha,
  onDeleteBatchFichas,
  onComparePatient,
  onNewFichaBlank,
  upsertFn,
  blankFn,
  fillFormFn,
  showFormFn,
  todayStr,
}) {
  activeSessionUserGetter = getSessionUser;
  activeUpsert = upsertFn;
  activeBlank = blankFn;
  activeFillForm = fillFormFn;
  activeShowForm = showFormFn;

  activeRowCallbacks = {
    onOpen: onOpenFicha,
    onNewSession: (item) => {
      const copy = nextSession(item, todayISO());
      onNewSessionFicha({ ...copy, id: crypto.randomUUID() });
    },
    onPdf: (item) => onPdfFicha([item]),
    onPdfAll: (items) => onPdfFicha(items),
    onDelete: onDeleteFicha,
    onDeleteBatch: onDeleteBatchFichas,
    onCompare: onComparePatient,
    onDownloadJson: (item) => downloadJSON(item, todayStr),
    todayStr,
  };

  // Búsqueda con debounce para fluidez y rendimiento óptimo del DOM
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      page = 0;
      renderLibrary();
    }, 150));
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      page = 0;
      renderLibrary();
    });
  }

  if (sortPatientsSelect) {
    sortPatientsSelect.value = patientSortMode;
    sortPatientsSelect.addEventListener("change", () => {
      patientSortMode = sortPatientsSelect.value;
      try {
        localStorage.setItem("kinesica_patient_sort", patientSortMode);
      } catch {}
      page = 0;
      renderLibrary();
    });
  }

  if (mineButton) {
    mineButton.addEventListener("click", () => {
      onlyMine = !onlyMine;
      focusedPatient = null;
      page = 0;
      syncMineButton();
      renderLibrary();
    });
  }

  if (btnGroup) {
    btnGroup.addEventListener("click", () => {
      grouped = !grouped;
      focusedPatient = null;
      page = 0;
      btnGroup.textContent = grouped ? "Ver todas las fichas" : "Agrupar por paciente";
      btnGroup.classList.toggle("green", grouped);
      btnGroup.classList.toggle("light", !grouped);
      renderLibrary();
    });
  }

  if (patientSelect) {
    patientSelect.addEventListener("change", () => {
      focusedPatient = patientSelect.value === "__all__" ? null : patientSelect.value;
      page = 0;
      renderLibrary();
    });
  }

  if (btnNew) {
    btnNew.addEventListener("click", () => {
      const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
      const items = visibleFichas(sessionUser);
      if (focusedPatient) {
        const pSessions = items.filter((item) => patientKey(item) === focusedPatient);
        if (pSessions.length && typeof activeRowCallbacks.onNewSession === "function") {
          activeRowCallbacks.onNewSession(pSessions[0]);
          return;
        }
      }
      if (typeof onNewFichaBlank === "function") onNewFichaBlank();
    });
  }

  if (btnSeed) {
    btnSeed.addEventListener("click", async () => {
      const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
      if (sessionUser && sessionUser.username !== "martin") return;
      if (!window.confirm("¿Agregar 20 fichas de prueba?")) return;
      btnSeed.disabled = true;
      try {
        for (let i = 0; i < SEED_PEOPLE.length; i += 1) {
          const [nombre, dni] = SEED_PEOPLE[i];
          const day = String(i + 1).padStart(2, "0");
          const data = {
            ...blank(),
            ...exampleFicha(),
            id: crypto.randomUUID(),
            nombre,
            dni,
            fechaSesion: `2026-09-${day}`,
          };
          await upsert(data);
        }
        showLibrary();
      } catch (error) {
        if (!error.auth) window.alert(error.message);
      } finally {
        btnSeed.disabled = false;
      }
    });
  }

  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
      const items = visibleFichas(sessionUser);
      if (!items.length) {
        window.alert("No hay fichas para exportar.");
        return;
      }
      downloadJSON(items.length === 1 ? items[0] : items, todayStr);
    });
  }

  const fileOpen = document.querySelector("#file-open");
  if (fileOpen) {
    fileOpen.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;

      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        window.alert("El archivo no es un JSON válido.");
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        window.alert("El archivo no es una ficha.");
        return;
      }

      if (Array.isArray(parsed)) {
        const fichas = parsed.filter((item) => item && typeof item === "object" && !Array.isArray(item));
        if (!fichas.length) {
          window.alert("El archivo no tiene fichas.");
          return;
        }
        try {
          for (const item of fichas) {
            await upsert(coerceFicha({ ...blank(), ...item, id: item.id || crypto.randomUUID() }));
          }
          showLibrary();
          window.alert(fichas.length === 1 ? "Se cargó 1 ficha." : `Se cargaron ${fichas.length} fichas.`);
        } catch (error) {
          if (!error.auth) window.alert(error.message);
        }
        return;
      }

      const data = coerceFicha({ ...blank(), ...parsed, id: parsed.id || crypto.randomUUID() });
      fillForm(data);
      showForm(0);
      const missing = missingFields(data);
      if (missing.length) {
        window.alert(`El archivo se abrió, pero falta completar: ${missing.join(", ")}.`);
      }
    });
  }
}
