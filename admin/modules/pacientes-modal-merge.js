/**
 * Kinésica Admin - Unificación manual de pacientes en modal de edición.
 */

import { api } from "./api.js?v=79";
import { escapeHtml, dialogAlert, dialogConfirm, toast } from "./dom.js?v=79";
import { getPacientesCache, setPacientesCache } from "./pacientes-state.js";
import { phoneMatches } from "./phone-search.js?v=3";
import { formatPatientName } from "./pacientes-name.js?v=2";
import {
  renderMergeCandidatesHtml,
  renderMergeSelectionHtml,
} from "./pacientes-modal-merge-view.js";

function searchCandidates(query, currentId) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return [];
  const normQuery = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, " ").trim();
  const qTokens = normQuery.split(/\s+/).filter(Boolean);
  const cache = getPacientesCache();

  return cache.filter((p) => {
    if (Number(p.id) === Number(currentId)) return false;

    const rawPatientNames = `${p.nombre_completo || ""} ${p.apellido || ""} ${p.nombre || ""}`;
    const normPatient = rawPatientNames.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, " ");
    if (qTokens.length > 0 && qTokens.every((tok) => normPatient.includes(tok))) return true;
    if ((p.telefono || "").includes(q) || phoneMatches(p.telefono, q)) return true;
    if ((p.dni || "").includes(q)) return true;
    if ((p.email || "").toLowerCase().includes(q)) return true;
    return false;
  }).slice(0, 8);
}

export function getCandidateSuggestions(paciente) {
  if (!paciente || !paciente.id) return [];
  const rawPatientNames = `${paciente.nombre_completo || ""} ${paciente.apellido || ""} ${paciente.nombre || ""}`;
  const normPatient = rawPatientNames.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\d+/g, " ");
  const stopWords = new Set(["turno", "aca", "acá", "de", "del", "la", "el", "los", "las", "mama", "mamá", "papa", "papá", "hijo", "hija", "para", "indistinto"]);
  const tokens = normPatient.split(/\W+/).filter((tok) => tok.length >= 3 && !stopWords.has(tok));
  if (tokens.length === 0) return [];

  return getPacientesCache().filter((p) => {
    if (Number(p.id) === Number(paciente.id)) return false;
    const pNames = `${p.nombre_completo || ""} ${p.apellido || ""} ${p.nombre || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return tokens.some((tok) => pNames.includes(tok));
  }).slice(0, 8);
}

export function bindPacienteModalMerge({ backdrop, paciente, onReload, startInMerge = false }) {
  if (!paciente || !paciente.id) return;

  const btnToggle = backdrop.querySelector("#btn-toggle-merge");
  const panel = backdrop.querySelector("#paciente-merge-panel");
  const searchInput = backdrop.querySelector("#merge-search-input");
  const resultsEl = backdrop.querySelector("#merge-results");
  const selectionBox = backdrop.querySelector("#merge-selection-box");

  if (!btnToggle || !panel || !searchInput || !resultsEl || !selectionBox) return;

  let isOpen = false;
  let selectedTarget = null;

  async function ensureCache() {
    const current = getPacientesCache();
    if (Array.isArray(current) && current.length > 0) return current;
    try {
      const res = await api("pacientes.php");
      const raw = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setPacientesCache(raw);
      return raw;
    } catch {
      return [];
    }
  }

  function renderCandidates(matches, headerTitle = "") {
    if (matches.length === 0) {
      const q = searchInput.value.trim();
      resultsEl.innerHTML = q
        ? `<div class="merge-no-results">No se encontraron pacientes para "${escapeHtml(q)}"</div>`
        : "";
      resultsEl.style.display = q ? "block" : "none";
      return;
    }

    resultsEl.innerHTML = renderMergeCandidatesHtml(matches, headerTitle);
    resultsEl.style.display = "block";

    resultsEl.querySelectorAll(".merge-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        const id = Number(item.dataset.id);
        const found = getPacientesCache().find((p) => Number(p.id) === id);
        if (found) selectTarget(found);
      });
    });
  }

  function showSuggestions() {
    const suggestions = getCandidateSuggestions(paciente);
    if (suggestions.length > 0) {
      renderCandidates(suggestions, "Candidatos sugeridos para unificar:");
    } else {
      resultsEl.style.display = "none";
      resultsEl.innerHTML = "";
    }
  }

  if (startInMerge) {
    isOpen = true;
    panel.style.display = "flex";
    btnToggle.textContent = "Cerrar";
    setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    ensureCache().then(() => {
      showSuggestions();
      searchInput.focus();
    });
  }

  btnToggle.addEventListener("click", async () => {
    isOpen = !isOpen;
    panel.style.display = isOpen ? "flex" : "none";
    btnToggle.textContent = isOpen ? "Cerrar" : "Abrir";
    if (isOpen) {
      await ensureCache();
      if (!searchInput.value.trim()) showSuggestions();
      setTimeout(() => searchInput.focus(), 60);
    }
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault();
  });

  searchInput.addEventListener("focus", () => {
    ensureCache();
    if (!searchInput.value.trim()) showSuggestions();
  });

  searchInput.addEventListener("input", () => {
    const val = searchInput.value.trim();
    if (val.length < 2) {
      showSuggestions();
      return;
    }
    renderCandidates(searchCandidates(val, paciente.id), "Resultados de búsqueda:");
  });

  backdrop.addEventListener("click", (e) => {
    if (!resultsEl.contains(e.target) && e.target !== searchInput) {
      resultsEl.style.display = "none";
    }
  });

  function selectTarget(target) {
    selectedTarget = target;
    resultsEl.style.display = "none";
    searchInput.value = "";
    renderSelection();
  }

  function renderSelection() {
    if (!selectedTarget) {
      selectionBox.style.display = "none";
      selectionBox.innerHTML = "";
      return;
    }
    selectionBox.innerHTML = renderMergeSelectionHtml(paciente, selectedTarget);
    selectionBox.style.display = "block";

    selectionBox.querySelector("#btn-cancel-merge-selection")?.addEventListener("click", () => {
      selectedTarget = null;
      renderSelection();
      searchInput.focus();
    });
    selectionBox.querySelector("#btn-execute-merge")?.addEventListener("click", handleExecuteMerge);
  }

  async function handleExecuteMerge() {
    if (!selectedTarget) return;
    const keepCurrent = (selectionBox.querySelector('input[name="merge_target_pick"]:checked')?.value || "current") === "current";
    const targetId = keepCurrent ? Number(paciente.id) : Number(selectedTarget.id);
    const sourceId = keepCurrent ? Number(selectedTarget.id) : Number(paciente.id);
    const targetName = keepCurrent ? formatPatientName(paciente).display : formatPatientName(selectedTarget).display;
    const sourceName = keepCurrent ? formatPatientName(selectedTarget).display : formatPatientName(paciente).display;

    const ok = await dialogConfirm(
      `¿Confirmás la unificación de estas dos fichas?\n\n` +
      `• Ficha que se CONSERVA: #${targetId} (${targetName})\n` +
      `• Ficha que se ABSORBE Y ELIMINA: #${sourceId} (${sourceName})\n\n` +
      `Todos los turnos, fichas clínicas, notas e interacciones se consolidarán en la ficha #${targetId}. Esta acción no se puede deshacer.`,
      { title: "Confirmar unificación de pacientes", danger: true, okText: "Sí, unificar", cancelText: "Cancelar" }
    );
    if (!ok) return;

    const btnExec = selectionBox.querySelector("#btn-execute-merge");
    if (btnExec) {
      btnExec.disabled = true;
      btnExec.textContent = "Unificando…";
    }

    try {
      const res = await api("pacientes.php", {
        method: "POST",
        body: JSON.stringify({ action: "merge", source_id: sourceId, target_id: targetId }),
      });
      if (!res || res.status !== "success") throw new Error(res?.message || "Error al unificar pacientes");
      backdrop.remove();
      toast("Fichas unificadas exitosamente", { type: "success" });
      if (typeof onReload === "function") await onReload();
    } catch (err) {
      if (btnExec) {
        btnExec.disabled = false;
        btnExec.textContent = "Unificar Fichas";
      }
      await dialogAlert(err.message || "Error al unificar fichas", { type: "danger" });
    }
  }
}
