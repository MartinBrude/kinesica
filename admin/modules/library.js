/**
 * Kinésica Admin - Biblioteca de Historias Clínicas y Pacientes
 * Gestiona el listado de fichas, agrupación de sesiones por paciente,
 * búsqueda normalizada con debounce, paginación e importación/exportación JSON.
 */

import { matchFichaSearch, nextSession, missingFields } from "../ficha-rules.mjs?v=87";
import { dialogAlert, switchActiveView } from "./dom.js?v=78";
import { todayISO } from "./form.js?v=88";
import { sessionRow, patientGroupRow, fichaRow, setRowsContext } from "./library-rows.js?v=3";
import { downloadJSON, planImport, executeBatchImport } from "./library-io.js";
import { pageWindow as calcPageWindow } from "./library-pager.js";
import { initLibraryToolbar } from "./library-toolbar.js";
import { renderLibraryList } from "./library-render.js";

export { sessionRow, patientGroupRow, fichaRow, downloadJSON };

export function pageWindow(rows) {
  return calcPageWindow(rows, pageSizeSelect, libraryPager, () => renderLibrary());
}

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
let activeRowCallbacks = {};

setRowsContext({
  loadAll: () => loadAll(),
  isGrouped: () => grouped,
  getSearchValue: () => searchInput?.value || "",
  getExpandedPatients: () => expandedPatients,
  renderLibrary: () => renderLibrary(),
});
let activeUpsert = null;
let activeBlank = null;
let activeFillForm = null;
let activeShowForm = null;

function upsert(item) { return typeof activeUpsert === "function" ? activeUpsert(item) : Promise.resolve(item); }
function blank() { return typeof activeBlank === "function" ? activeBlank() : {}; }
function fillForm(data) { if (typeof activeFillForm === "function") activeFillForm(data); }
function showForm(targetStep = 0) { if (typeof activeShowForm === "function") activeShowForm(targetStep); }

export function loadAll() { return cache; }
export function setCache(items) { cache = items || []; libraryLoaded = true; }
export function resetLibrary() { cache = []; libraryLoaded = false; }

export function showLibrary() {
  switchActiveView("view-library");
  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "library" }));
  } catch {}
  renderLibrary();
}

export function visibleFichas(sessionUser = null) {
  const q = searchInput ? searchInput.value : "";
  return loadAll()
    .filter((item) => {
      if (activeFilterProf === "todos") return true;
      const prof = (item?.profesional || "").toLowerCase();
      return activeFilterProf === "indistinto" ? (prof === "indistinto" || prof === "") : prof === activeFilterProf;
    })
    .filter((item) => matchFichaSearch(item, q))
    .sort((a, b) => (b.fechaSesion || "").localeCompare(a.fechaSesion || ""));
}

export function syncMineButton() {
  if (!mineButton) return;
  mineButton.setAttribute("aria-pressed", String(onlyMine));
  mineButton.classList.toggle("is-active", onlyMine);
}

export function renderLibrary() {
  const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
  if (sessionUser && !mineDefaultApplied) {
    mineDefaultApplied = true;
    onlyMine = sessionUser.username === "norberto" || sessionUser.username === "maria";
  }
  renderLibraryList({
    listEl,
    libraryView,
    patientSelect,
    searchInput,
    filterProfSelect,
    mineButton,
    sortPatientsSelect,
    getState: () => ({
      libraryLoaded,
      allFichas: cache,
      focusedPatient,
      patientSortMode,
      activeFilterProf,
      expandedPatients,
      activeRowCallbacks,
    }),
    setState: (partial) => {
      if ("focusedPatient" in partial) focusedPatient = partial.focusedPatient;
    },
    pageWindow,
    visibleFichas: () => visibleFichas(sessionUser),
    syncMineButton,
    renderLibrary,
  });
}

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

  initLibraryToolbar({
    searchInput,
    pageSizeSelect,
    sortPatientsSelect,
    filterProfSelect,
    mineButton,
    btnGroup,
    patientSelect,
    btnNew,
    btnSeed,
    btnExport,
    getState: () => ({
      onlyMine,
      grouped,
      focusedPatient,
      callbacks: { onNewSession: activeRowCallbacks.onNewSession, onNewFichaBlank },
      sessionUser: typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null,
    }),
    setState: (partial) => {
      if ("onlyMine" in partial) onlyMine = partial.onlyMine;
      if ("grouped" in partial) grouped = partial.grouped;
      if ("focusedPatient" in partial) focusedPatient = partial.focusedPatient;
      if ("activeFilterProf" in partial) activeFilterProf = partial.activeFilterProf;
      if ("patientSortMode" in partial) patientSortMode = partial.patientSortMode;
    },
    renderLibrary,
    showLibrary,
    syncMineButton,
    visibleFichas: () => visibleFichas(typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null),
    upsert,
    blank,
    todayStr,
  });

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
        await executeBatchImport(parsed, cache, blank(), (item) => upsert(item), fileOpen, showLibrary);
        return;
      }
      const data = planImport([parsed], cache, blank())[0];
      fillForm(data);
      showForm(0);
      const missing = missingFields(data);
      if (missing.length) {
        dialogAlert(`El archivo se abrió, pero falta completar: ${missing.join(", ")}.`);
      }
    });
  }
}
