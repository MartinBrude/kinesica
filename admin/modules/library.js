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
} from "../ficha-rules.mjs?v=87";
import { formatDate } from "./api.js?v=77";
import { debounce, dialogAlert, dialogConfirm, escapeHtml } from "./dom.js?v=78";
import { todayISO } from "./form.js?v=77";

const libraryView = document.querySelector("#view-library");
const listEl = document.querySelector("#library-list");
const patientSelect = document.querySelector("#pdf-patient");
const searchInput = document.querySelector("#search");
const pageSizeSelect = document.querySelector("#page-size");
const sortPatientsSelect = document.querySelector("#sort-patients");
const libraryPager = document.querySelector("#library-pager");
const mineButton = document.querySelector("#btn-mine");
const filterProfSelect = document.querySelector("#filter-library-prof");
const btnGroup = document.querySelector("#btn-group");
const btnNew = document.querySelector("#btn-new");
const btnSeed = document.querySelector("#btn-seed");
const btnExport = document.querySelector("#btn-export");

let cache = [];
let libraryLoaded = false;
let grouped = false;
let focusedPatient = null;
let page = 0;
let onlyMine = false;
let activeFilterProf = "todos";
let mineDefaultApplied = false;
let expandedPatients = new Set();
let patientSortMode = "name";
try {
  const s = localStorage.getItem("kinesica_patient_sort");
  if (s === "recent" || s === "name") patientSortMode = s;
} catch {}

let activeSessionUserGetter = null;
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

const IMPORT_BATCH = 20;

function sessionIdentity(item) {
  return `${patientKey(item)}|${String(item?.fechaSesion || "")}`;
}

function planImport(rawItems) {
  const byId = new Map(cache.filter((ficha) => ficha && ficha.id).map((ficha) => [ficha.id, ficha]));
  const bySession = new Map();
  for (const ficha of cache) {
    const key = sessionIdentity(ficha);
    if (key !== "|") bySession.set(key, ficha);
  }
  const planned = new Map();
  for (const item of rawItems) {
    const coerced = coerceFicha({ ...blank(), ...item });
    const known = (item.id && byId.get(item.id)) || bySession.get(sessionIdentity(coerced));
    const id = (known && known.id) || (typeof item.id === "string" && item.id) || crypto.randomUUID();
    const data = { ...coerced, id };
    planned.set(id, data);
    byId.set(id, data);
    const key = sessionIdentity(data);
    if (key !== "|") bySession.set(key, data);
  }
  return [...planned.values()];
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
  libraryLoaded = true;
}

export function resetLibrary() {
  cache = [];
  libraryLoaded = false;
}

/**
 * Muestra la vista de biblioteca y oculta las demás.
 */
export function showLibrary() {
  const formView = document.querySelector("#view-form");
  const compareView = document.querySelector("#view-compare");
  const gateView = document.querySelector("#view-gate");
  const dashView = document.querySelector("#view-dashboard");
  const pacView = document.querySelector("#view-pacientes");
  const horView = document.querySelector("#view-horarios");
  if (gateView) gateView.hidden = true;
  if (formView) formView.hidden = true;
  if (compareView) compareView.hidden = true;
  if (dashView) dashView.hidden = true;
  if (pacView) pacView.hidden = true;
  if (horView) horView.hidden = true;
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
    .filter((item) => {
      if (activeFilterProf === "todos") return true;
      const prof = (item?.profesional || "").toLowerCase();
      if (activeFilterProf === "indistinto") {
        return prof === "indistinto" || prof === "";
      }
      return prof === activeFilterProf;
    })
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
export function downloadJSON(data, todayStr = "", fileStem = "") {
  const isArray = Array.isArray(data);
  const rawName = fileStem
    || (isArray
      ? "fichas-atm"
      : `ficha-${(data.nombre || "paciente")}`);
  const safeName = rawName.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, "_").replace(/_+/g, "_");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName}-${todayStr || new Date().toISOString().slice(0, 10)}.json`;
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

// ----------------------------------------------------
// Renderizado de Filas (delegado a library-rows.js)
// ----------------------------------------------------
import { sessionRow, patientGroupRow, fichaRow } from "./library-rows.js?v=1";
export { sessionRow, patientGroupRow, fichaRow };

export function renderLibrary() {
  if (!listEl) return;
  const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;

  if (sessionUser && !mineDefaultApplied) {
    mineDefaultApplied = true;
    onlyMine = sessionUser.username === "norberto" || sessionUser.username === "maria";
  }
  syncMineButton();

  const noPatients = libraryLoaded && loadAll().length === 0;
  const toolbar = libraryView?.querySelector(".library-toolbar");
  if (toolbar) toolbar.classList.toggle("is-idle", noPatients || !libraryLoaded);
  const controlsLocked = noPatients || !libraryLoaded;
  if (patientSelect) patientSelect.disabled = controlsLocked;
  if (searchInput) searchInput.disabled = controlsLocked;
  if (filterProfSelect) {
    filterProfSelect.disabled = controlsLocked;
    filterProfSelect.value = activeFilterProf;
  }
  if (mineButton) mineButton.disabled = controlsLocked;
  if (sortPatientsSelect) sortPatientsSelect.disabled = controlsLocked;

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

  if (!libraryLoaded) {
    const status = document.createElement("p");
    status.className = "library-loading";
    status.setAttribute("role", "status");
    status.textContent = "Cargando fichas…";
    fragment.append(status);
  } else if (!groups.length) {
    const p = document.createElement("p");
    p.className = noPatients ? "empty empty-none" : "empty";
    p.textContent = searchInput?.value || activeFilterProf !== "todos"
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
    onDownloadJsonAll: (items) => {
      const stem = `fichas-${(items[0]?.nombre || "paciente").replace(/\s+/g, "_")}`;
      downloadJSON(items, todayStr, stem);
    },
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

  if (filterProfSelect) {
    filterProfSelect.addEventListener("change", (e) => {
      activeFilterProf = e.target.value;
      focusedPatient = null;
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
      if (sessionUser && sessionUser.role !== "admin" && sessionUser.username !== "martin") return;
      if (!(await dialogConfirm("¿Agregar 20 fichas de prueba?"))) return;
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
        if (!error.auth) dialogAlert(error.message);
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
        dialogAlert("No hay fichas para exportar.");
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
      if (file.size > 8 * 1024 * 1024) {
        dialogAlert("El archivo supera los 8 MB.");
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        dialogAlert("El archivo no es un JSON válido.");
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        dialogAlert("El archivo no es una ficha.");
        return;
      }

      if (Array.isArray(parsed)) {
        const raw = parsed.filter((item) => item && typeof item === "object" && !Array.isArray(item));
        if (!raw.length) {
          dialogAlert("El archivo no tiene fichas.");
          return;
        }
        const fichas = planImport(raw);
        const already = fichas.filter((item) => cache.some((ficha) => ficha.id === item.id)).length;
        const fileBtn = fileOpen.closest("label");
        const fileLabel = fileBtn ? fileBtn.childNodes[0] : null;
        const previousLabel = fileLabel && fileLabel.textContent;
        if (fileOpen) fileOpen.disabled = true;
        const failed = [];
        try {
          for (let offset = 0; offset < fichas.length; offset += IMPORT_BATCH) {
            const batch = fichas.slice(offset, offset + IMPORT_BATCH);
            if (fileLabel) {
              fileLabel.textContent = `Importando ${Math.min(offset + batch.length, fichas.length)}/${fichas.length}… `;
            }
            const results = await Promise.allSettled(batch.map((item) => upsert(item)));
            results.forEach((result) => {
              if (result.status === "rejected") failed.push(result.reason);
            });
            if (failed.some((error) => error && error.auth)) break;
          }
          showLibrary();
          if (failed.some((error) => error && error.auth)) return;
          const saved = fichas.length - failed.length;
          const replaced = already ? ` ${already === 1 ? "1 ya estaba y se actualizó." : `${already} ya estaban y se actualizaron.`}` : "";
          if (!failed.length) {
            dialogAlert((saved === 1 ? "Se importó 1 ficha." : `Se importaron ${saved} fichas.`) + replaced);
          } else {
            const message = failed[0] && failed[0].message;
            dialogAlert(`Se importaron ${saved} de ${fichas.length}.${replaced} ${message || ""}`.trim());
          }
        } finally {
          if (fileLabel && previousLabel) fileLabel.textContent = previousLabel;
          fileOpen.disabled = false;
        }
        return;
      }

      const data = planImport([parsed])[0];
      fillForm(data);
      showForm(0);
      const missing = missingFields(data);
      if (missing.length) {
        dialogAlert(`El archivo se abrió, pero falta completar: ${missing.join(", ")}.`);
      }
    });
  }
}

/**
 * Micro animación que lleva la atención a "Nueva sesión" una vez por login.
 * La marca se limpia al cerrar sesión (ver auth.js).
 */
(function attentionOnLogin() {
  const lib = document.querySelector("#view-library");
  const cta = document.querySelector("#btn-new");
  if (!lib || !cta) return;

  const KEY = "kinesica_cta_seen";
  const maybePlay = () => {
    if (lib.hidden) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch (_) {}
    cta.classList.remove("cta-attention");
    void cta.offsetWidth;
    cta.classList.add("cta-attention");
    cta.addEventListener(
      "animationend",
      (e) => {
        if (e.animationName === "cta-halo") cta.classList.remove("cta-attention");
      },
      { once: false },
    );
  };

  new MutationObserver(maybePlay).observe(lib, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  maybePlay();
})();
