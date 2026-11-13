/**
 * Kinésica Admin - Módulo de Encuestas de Satisfacción Anónimas (facade).
 */

import { api } from "./api.js?v=79";
import { dialogAlert, dialogConfirm, switchActiveView } from "./dom.js?v=79";
import { setListControlsEnabled } from "./list-controls.js?v=1";
import {
  getCachedEncuestas,
  setCachedEncuestas,
  getEncuestasFilter,
  setEncuestasFilterState,
  getEncuestasLoading,
  setEncuestasLoading,
} from "./encuestas-state.js";
import { renderEncuestas } from "./encuestas-render.js";

export function showEncuestasView() {
  const view = switchActiveView("view-encuestas");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "encuestas" }));
    } catch { /* ignore */ }
    loadEncuestasData();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

export function hideEncuestasView() {
  const view = document.getElementById("view-encuestas");
  if (view) view.hidden = true;
}

async function handleDeleteEncuesta(item) {
  const ok = await dialogConfirm("¿Seguro que querés eliminar esta respuesta de encuesta?");
  if (!ok) return;

  try {
    await api("encuestas.php", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: item.id }),
    });
    await loadEncuestasData();
  } catch (err) {
    dialogAlert("No se pudo eliminar la encuesta: " + (err.message || "Error desconocido"));
  }
}

function paintEncuestas() {
  renderEncuestas({ onDeleteEncuesta: handleDeleteEncuesta });
}

export async function loadEncuestasData() {
  if (getEncuestasLoading()) return;
  setEncuestasLoading(true);
  const tbody = document.getElementById("encuestas-tbody");
  if (tbody && (!getCachedEncuestas() || !getCachedEncuestas().length)) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando respuestas de encuestas…</span></td></tr>`;
  }
  const filterRoot = document.querySelector("#view-encuestas .admin-errores-filters");
  setListControlsEnabled(filterRoot, false);
  try {
    const data = await api("encuestas.php");
    if (data && Array.isArray(data.encuestas)) {
      setCachedEncuestas(data.encuestas);
    }
  } catch (_) {
    // Modo offline o sin red
  } finally {
    setEncuestasLoading(false);
    setListControlsEnabled(filterRoot, true);
  }
  paintEncuestas();
}

export function setEncuestasFilter(filter) {
  if (getEncuestasLoading()) return;
  setEncuestasFilterState(filter);
  document.querySelectorAll(".encuestas-filter-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === filter);
  });
  paintEncuestas();
}

export function initEncuestasModule() {
  const btnRefresh = document.getElementById("btn-refresh-encuestas");
  btnRefresh?.addEventListener("click", () => loadEncuestasData());

  const btnCopyLink = document.getElementById("btn-copy-encuesta-link");
  btnCopyLink?.addEventListener("click", async () => {
    const url = "https://www.kinesica.com.ar/encuesta.html";
    try {
      await navigator.clipboard.writeText(url);
      const orig = btnCopyLink.textContent;
      btnCopyLink.textContent = "✓ Enlace copiado";
      setTimeout(() => {
        btnCopyLink.textContent = orig;
      }, 2000);
    } catch (_) {
      dialogAlert("Enlace público de la encuesta: " + url);
    }
  });

  document.querySelectorAll(".encuestas-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => setEncuestasFilter(btn.dataset.filter || "todas"));
  });
}
