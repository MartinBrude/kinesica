/**
 * Kinésica Admin - Barra de Herramientas y Filtros (Biblioteca)
 * Configura los eventos de búsqueda, selector de orden, botón "Mis pacientes", agrupación y exportación.
 */

import { debounce, dialogAlert, dialogConfirm } from "./dom.js?v=78";
import { downloadJSON, SEED_PEOPLE } from "./library-io.js";
import { setLibraryPage } from "./library-pager.js";
import { exampleFicha } from "../ficha-rules.mjs?v=87";
import { getSessionUser } from "./auth.js?v=81";

export function initLibraryToolbar({
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
  getState,
  setState,
  renderLibrary,
  showLibrary,
  syncMineButton,
  visibleFichas,
  upsert,
  blank,
  todayStr,
}) {
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      setLibraryPage(0);
      renderLibrary();
    }, 150));
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      setLibraryPage(0);
      renderLibrary();
    });
  }

  if (sortPatientsSelect) {
    sortPatientsSelect.addEventListener("change", () => {
      setState({ patientSortMode: sortPatientsSelect.value });
      try {
        localStorage.setItem("kinesica_patient_sort", sortPatientsSelect.value);
      } catch {}
      setLibraryPage(0);
      renderLibrary();
    });
  }

  if (filterProfSelect) {
    filterProfSelect.addEventListener("change", (e) => {
      setState({ activeFilterProf: e.target.value, focusedPatient: null });
      setLibraryPage(0);
      renderLibrary();
    });
  }

  if (mineButton) {
    mineButton.addEventListener("click", () => {
      const { onlyMine } = getState();
      setState({ onlyMine: !onlyMine, focusedPatient: null });
      setLibraryPage(0);
      syncMineButton();
      renderLibrary();
    });
  }

  if (btnGroup) {
    btnGroup.addEventListener("click", () => {
      const { grouped } = getState();
      const nextGrouped = !grouped;
      setState({ grouped: nextGrouped, focusedPatient: null });
      setLibraryPage(0);
      btnGroup.textContent = nextGrouped ? "Ver todas las fichas" : "Agrupar por paciente";
      btnGroup.classList.toggle("green", nextGrouped);
      btnGroup.classList.toggle("light", !nextGrouped);
      renderLibrary();
    });
  }

  if (patientSelect) {
    patientSelect.addEventListener("change", () => {
      setState({ focusedPatient: patientSelect.value === "__all__" ? null : patientSelect.value });
      setLibraryPage(0);
      renderLibrary();
    });
  }

  if (btnNew) {
    if (getSessionUser()?.role === "colaborador") {
      btnNew.hidden = true;
    }
    btnNew.addEventListener("click", () => {
      if (getSessionUser()?.role === "colaborador") {
        dialogAlert("Los usuarios con rol Colaborador tienen permisos de solo lectura.");
        return;
      }
      const { focusedPatient, callbacks } = getState();
      const items = visibleFichas();
      if (focusedPatient) {
        const pSessions = items.filter((item) => item && (item.dni === focusedPatient || item.nombre === focusedPatient));
        if (pSessions.length && typeof callbacks?.onNewSession === "function") {
          callbacks.onNewSession(pSessions[0]);
          return;
        }
      }
      if (typeof callbacks?.onNewFichaBlank === "function") callbacks.onNewFichaBlank();
    });
  }

  if (btnSeed) {
    btnSeed.addEventListener("click", async () => {
      const { sessionUser } = getState();
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
      const items = visibleFichas();
      if (!items.length) {
        dialogAlert("No hay fichas para exportar.");
        return;
      }
      downloadJSON(items.length === 1 ? items[0] : items, todayStr);
    });
  }
}
