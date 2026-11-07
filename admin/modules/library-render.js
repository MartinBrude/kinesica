/**
 * Kinésica Admin - Motor de Renderizado de la Biblioteca
 * Agrupa las historias clínicas por paciente, aplica filtros/ordenamiento y renderiza los acordeones DOM.
 */

import { patientKey, capitalizePersonName } from "../ficha-rules.mjs?v=87";
import { escapeHtml } from "./dom.js?v=79";
import { patientGroupRow } from "./library-rows.js?v=3";
import { setLibraryPage } from "./library-pager.js";

export function renderLibraryList({
  listEl,
  libraryView,
  patientSelect = null,
  searchInput,
  mineButton,
  sortPatientsSelect,
  getState,
  setState,
  pageWindow,
  visibleFichas,
  syncMineButton,
  renderLibrary,
}) {
  if (!listEl) return;
  const state = getState();
  const { libraryLoaded, allFichas, focusedPatient, patientSortMode, expandedPatients, activeRowCallbacks } = state;

  syncMineButton();

  const noPatients = libraryLoaded && allFichas.length === 0;
  const toolbar = libraryView?.querySelector(".library-toolbar");
  if (toolbar) toolbar.classList.toggle("is-idle", noPatients || !libraryLoaded);
  const controlsLocked = noPatients || !libraryLoaded;
  if (patientSelect) patientSelect.disabled = controlsLocked;
  if (searchInput) searchInput.disabled = controlsLocked;
  if (mineButton) mineButton.disabled = controlsLocked;
  if (sortPatientsSelect) sortPatientsSelect.disabled = controlsLocked;

  const items = visibleFichas();

  if (patientSelect) {
    const prevPatient = focusedPatient || patientSelect.value;
    patientSelect.innerHTML = '<option value="__all__">Todos los pacientes</option>';
    const seenPatients = new Map();
    for (const item of items) {
      const key = patientKey(item);
      if (!seenPatients.has(key)) {
        const cleanName = capitalizePersonName(item.nombre) || "Sin nombre";
        seenPatients.set(key, cleanName);
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = `${cleanName} (DNI ${item.dni || "—"})`;
        patientSelect.append(opt);
      }
    }
    patientSelect.value = (focusedPatient && seenPatients.has(focusedPatient))
      ? focusedPatient
      : (seenPatients.has(prevPatient) || prevPatient === "__all__" ? prevPatient : "__all__");
  }

  const groupMap = new Map();
  for (const item of items) {
    const key = patientKey(item);
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(item);
  }

  let groups = [...groupMap.entries()];
  if (focusedPatient) {
    groups = groups.filter(([key]) => key === focusedPatient);
    expandedPatients.add(focusedPatient);
  }

  if (patientSortMode === "recent") {
    groups.sort((a, b) => (b[1][0]?.fechaSesion || "").localeCompare(a[1][0]?.fechaSesion || ""));
  } else {
    groups.sort((a, b) => (a[1][0]?.nombre || "").localeCompare(b[1][0]?.nombre || "", "es", { sensitivity: "base" }));
  }

  const fragment = document.createDocumentFragment();

  if (focusedPatient && groups.length) {
    const pName = capitalizePersonName(groups[0][1][0]?.nombre) || "Paciente";
    const filterBanner = document.createElement("div");
    filterBanner.className = "card-row";
    filterBanner.style.background = "var(--sky)";
    filterBanner.style.marginBottom = "10px";
    filterBanner.style.padding = "10px 16px";
    filterBanner.innerHTML = `<h3 style="margin:0; font-size:15px; color:var(--navy);">Filtrando por: <strong>${escapeHtml(pName)}</strong></h3>`;
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "btn light";
    backBtn.textContent = "← Ver todos los pacientes";
    backBtn.addEventListener("click", () => {
      setState({ focusedPatient: null });
      if (patientSelect) patientSelect.value = "__all__";
      setLibraryPage(0);
      renderLibrary();
    });
    filterBanner.append(backBtn);
    fragment.append(filterBanner);
  }

  if (!libraryLoaded) {
    const status = document.createElement("div");
    status.className = "admin-view-loading";
    status.setAttribute("role", "status");
    status.innerHTML = `<span class="loading-spinner" aria-hidden="true"></span><span>Cargando historias clínicas…</span>`;
    fragment.append(status);
  } else if (!groups.length) {
    const p = document.createElement("p");
    p.className = noPatients ? "empty empty-none" : "empty";
    p.textContent = searchInput?.value
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
