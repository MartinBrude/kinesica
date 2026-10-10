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
} from "../ficha-rules.mjs";
import { formatDate } from "./api.js";
import { debounce } from "./dom.js";
import { todayISO } from "./form.js";

const libraryView = document.querySelector("#view-library");
const listEl = document.querySelector("#library-list");
const patientSelect = document.querySelector("#pdf-patient");
const searchInput = document.querySelector("#search");
const pageSizeSelect = document.querySelector("#page-size");
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

function showForm() {
  if (typeof activeShowForm === "function") {
    activeShowForm();
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
  if (formView) formView.hidden = true;
  if (compareView) compareView.hidden = true;
  if (libraryView) libraryView.hidden = false;
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
      span.textContent = `Página ${page + 1} de ${totalPages} (${rows.length} en total)`;

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
  mineButton.textContent = onlyMine ? "Ver todos los pacientes" : "Ver solo mis pacientes";
  mineButton.classList.toggle("green", onlyMine);
  mineButton.classList.toggle("light", !onlyMine);
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
 * Renderiza la tarjeta de una ficha individual.
 * @param {object} item Datos de la ficha
 * @param {object} callbacks Callbacks para interactuar con la fila
 * @returns {HTMLElement}
 */
export function fichaRow(item, { onOpen, onNewSession, onPdf, onDelete, onDownloadJson, todayStr }) {
  const row = document.createElement("article");
  row.className = "card-row";
  const cdi = (item.cdi || []).join(", ") || "Sin criterio CDI";
  row.innerHTML = `<div><h3></h3><p></p></div><div class="row-controls"></div>`;
  row.querySelector("h3").textContent = item.nombre || "Sin nombre";
  row.querySelector("p").textContent = `${item.profesionalNombre || "Sin profesional"} · ${formatDate(item.fechaSesion)} · DNI ${item.dni || "—"} · ${cdi}`;

  const actions = row.querySelector(".row-controls");

  const open = document.createElement("button");
  open.type = "button";
  open.className = "btn light";
  open.textContent = "Abrir";
  open.addEventListener("click", () => onOpen(item));

  const again = document.createElement("button");
  again.type = "button";
  again.className = "btn light";
  again.textContent = "Nueva ficha";
  again.addEventListener("click", () => onNewSession(item));

  const pdf = document.createElement("button");
  pdf.type = "button";
  pdf.className = "btn green";
  pdf.textContent = "PDF";
  pdf.addEventListener("click", () => onPdf(item));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn ghost btn-icon-del";
  del.title = "Quitar ficha";
  del.setAttribute("aria-label", "Quitar ficha");
  del.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>`;
  del.addEventListener("click", () => {
    const name = item.nombre || "esta ficha";
    if (!window.confirm(`¿Quitar la ficha de ${name} del ${formatDate(item.fechaSesion)}? Esta acción no se puede deshacer.`)) {
      return;
    }
    onDelete(item);
  });

  const json = document.createElement("button");
  json.type = "button";
  json.className = "btn light";
  json.textContent = "JSON";
  json.addEventListener("click", () => onDownloadJson(item));

  actions.append(open, again, json, pdf, del);
  return row;
}

let activeSessionUserGetter = null;
let activeRowCallbacks = {};

/**
 * Renderiza la vista de biblioteca completa aplicando filtrado y paginación con DocumentFragment.
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
    const prevPatient = patientSelect.value;
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
    patientSelect.value = seenPatients.has(prevPatient) || prevPatient === "__all__"
      ? prevPatient
      : "__all__";
  }

  // Fragment para optimizar inserción en el DOM con un solo repaint
  const fragment = document.createDocumentFragment();

  if (focusedPatient) {
    const pSessions = items.filter((item) => patientKey(item) === focusedPatient);
    const pName = pSessions[0]?.nombre || "Paciente";
    const header = document.createElement("div");
    header.className = "card-row";
    header.style.background = "var(--sky)";
    header.style.marginBottom = "8px";

    const titleDiv = document.createElement("div");
    titleDiv.innerHTML = `<h3 style="margin:0;"></h3><p style="margin:4px 0 0; color:var(--muted); font-size:13px;"></p>`;
    titleDiv.querySelector("h3").textContent = `Fichas de ${pName} (${pSessions.length})`;
    titleDiv.querySelector("p").textContent = `DNI: ${pSessions[0]?.dni || "—"}`;

    const controls = document.createElement("div");
    controls.className = "row-controls";

    if (pSessions.length >= 2 && activeRowCallbacks.onCompare) {
      const compBtn = document.createElement("button");
      compBtn.type = "button";
      compBtn.className = "btn green";
      compBtn.textContent = "Comparar evolución";
      compBtn.addEventListener("click", () => activeRowCallbacks.onCompare(focusedPatient));
      controls.append(compBtn);
    }

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "btn light";
    backBtn.textContent = "← Volver a pacientes";
    backBtn.addEventListener("click", () => {
      focusedPatient = null;
      renderLibrary();
    });
    controls.append(backBtn);

    header.append(titleDiv, controls);
    fragment.append(header);

    const slice = pageWindow(pSessions);
    for (const item of slice) {
      fragment.append(fichaRow(item, activeRowCallbacks));
    }
  } else if (!grouped) {
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = searchInput?.value || onlyMine
        ? "No se encontraron fichas con los filtros actuales."
        : "No hay fichas guardadas todavía.";
      fragment.append(p);
    } else {
      const slice = pageWindow(items);
      for (const item of slice) {
        fragment.append(fichaRow(item, activeRowCallbacks));
      }
    }
  } else {
    // Vista agrupada por paciente
    const groupMap = new Map();
    for (const item of items) {
      const key = patientKey(item);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(item);
    }
    const groups = [...groupMap.entries()];
    if (!groups.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No hay pacientes cargados.";
      fragment.append(p);
    } else {
      const slice = pageWindow(groups);
      for (const [key, sessions] of slice) {
        const latest = sessions[0];
        const row = document.createElement("article");
        row.className = "card-row";
        row.innerHTML = `<div><h3></h3><p></p></div><div class="row-controls"></div>`;
        row.querySelector("h3").textContent = latest.nombre || "Sin nombre";
        const count = sessions.length === 1 ? "1 ficha" : `${sessions.length} fichas`;
        row.querySelector("p").textContent = `${count} · última ${formatDate(latest.fechaSesion)} · DNI ${latest.dni || "—"}`;

        const open = document.createElement("button");
        open.type = "button";
        open.className = "btn light";
        open.textContent = "Ver fichas";
        open.addEventListener("click", () => {
          focusedPatient = key;
          page = 0;
          renderLibrary();
        });

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn ghost btn-icon-del-text";
        del.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>Quitar todas`;
        del.addEventListener("click", () => {
          const all = loadAll().filter((item) => patientKey(item) === key);
          const name = latest.nombre || "este paciente";
          const countStr = all.length === 1 ? "la ficha" : `las ${all.length} fichas`;
          if (!window.confirm(`¿Quitar ${countStr} de ${name}? Esta acción no se puede deshacer.`)) {
            return;
          }
          if (activeRowCallbacks.onDeleteBatch) {
            activeRowCallbacks.onDeleteBatch(all);
          }
        });

        const rowControls = row.querySelector(".row-controls");
        if (sessions.length >= 2 && activeRowCallbacks.onCompare) {
          const comp = document.createElement("button");
          comp.type = "button";
          comp.className = "btn light";
          comp.textContent = "Comparar";
          comp.title = "Comparar evolución de este paciente";
          comp.addEventListener("click", (e) => {
            e.stopPropagation();
            activeRowCallbacks.onCompare(key);
          });
          rowControls.append(open, comp, del);
        } else {
          rowControls.append(open, del);
        }

        row.addEventListener("click", (event) => {
          if (event.target.closest("button")) return;
          focusedPatient = key;
          page = 0;
          renderLibrary();
        });

        fragment.append(row);
      }
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

  if (btnNew) {
    btnNew.addEventListener("click", () => {
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
      showForm();
      const missing = missingFields(data);
      if (missing.length) {
        window.alert(`El archivo se abrió, pero falta completar: ${missing.join(", ")}.`);
      }
    });
  }
}
