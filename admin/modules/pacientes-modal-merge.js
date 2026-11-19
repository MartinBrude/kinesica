/**
 * Kinésica Admin - Unificación manual de pacientes en modal de edición.
 */

import { api } from "./api.js?v=79";
import { escapeHtml, dialogAlert, dialogConfirm, toast } from "./dom.js?v=79";
import { getPacientesCache, setPacientesCache } from "./pacientes-state.js";
import { phoneMatches } from "./phone-search.js?v=3";
import { formatDisplayPhone } from "./pacientes-format.js";
import { formatPatientName } from "./pacientes-name.js?v=2";
import { patientMissingPhone, isPlaceholderPhone } from "./pacientes-identifiers.js";

/**
 * Busca pacientes candidatos para unificar excluyendo el paciente actual.
 * @param {string} query
 * @param {number|string} currentId
 * @returns {Array<object>}
 */
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
    const tokenMatch = qTokens.length > 0 && qTokens.every((tok) => normPatient.includes(tok));
    if (tokenMatch) return true;

    if ((p.telefono || "").includes(q) || phoneMatches(p.telefono, q)) return true;
    if ((p.dni || "").includes(q)) return true;
    if ((p.email || "").toLowerCase().includes(q)) return true;
    return false;
  }).slice(0, 8);
}

/**
 * Busca fichas sugeridas que coincidan por tokens de nombre con el paciente actual.
 * @param {object} paciente
 * @returns {Array<object>}
 */
export function getCandidateSuggestions(paciente) {
  if (!paciente || !paciente.id) return [];
  const rawPatientNames = `${paciente.nombre_completo || ""} ${paciente.apellido || ""} ${paciente.nombre || ""}`;
  const normPatient = rawPatientNames.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\d+/g, " ");
  const stopWords = new Set(["turno", "aca", "acá", "de", "del", "la", "el", "los", "las", "mama", "mamá", "papa", "papá", "hijo", "hija", "para", "indistinto"]);
  const tokens = normPatient.split(/\W+/).filter((tok) => tok.length >= 3 && !stopWords.has(tok));
  if (tokens.length === 0) return [];

  const cache = getPacientesCache();
  return cache.filter((p) => {
    if (Number(p.id) === Number(paciente.id)) return false;
    const pNames = `${p.nombre_completo || ""} ${p.apellido || ""} ${p.nombre || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return tokens.some((tok) => pNames.includes(tok));
  }).slice(0, 8);
}

/**
 * Enlaza los controles y flujo de unificación de fichas en el modal de edición de pacientes.
 */
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

    resultsEl.innerHTML = `
      ${headerTitle ? `<div style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; padding:6px 10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; border-radius: 6px 6px 0 0;">${escapeHtml(headerTitle)}</div>` : ""}
      ${matches.map((m) => {
        const name = formatPatientName(m).display;
        const tel = patientMissingPhone(m) ? "⚠️ Sin teléfono" : formatDisplayPhone(m.telefono);
        const dni = m.dni ? `· DNI ${escapeHtml(m.dni)}` : "";
        return `
          <div class="merge-result-item" data-id="${m.id}" role="button" tabindex="0">
            <div>
              <div class="merge-result-name">${escapeHtml(name)}</div>
              <div class="merge-result-meta">
                <span>${escapeHtml(tel)}</span>
                ${dni ? `<span>${dni}</span>` : ""}
                <span>#${m.id}</span>
              </div>
            </div>
            <button type="button" class="btn light small" style="font-size:11.5px; padding:3px 8px; pointer-events:none;">Elegir</button>
          </div>
        `;
      }).join("")}
    `;
    resultsEl.style.display = "block";

    resultsEl.querySelectorAll(".merge-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        const id = Number(item.dataset.id);
        const found = getPacientesCache().find((p) => Number(p.id) === id);
        if (found) {
          selectTarget(found);
        }
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
    setTimeout(() => {
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
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
      if (!searchInput.value.trim()) {
        showSuggestions();
      }
      setTimeout(() => searchInput.focus(), 60);
    }
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  });

  searchInput.addEventListener("focus", () => {
    ensureCache();
    if (!searchInput.value.trim()) {
      showSuggestions();
    }
  });

  searchInput.addEventListener("input", () => {
    const val = searchInput.value.trim();
    if (val.length < 2) {
      showSuggestions();
      return;
    }

    const matches = searchCandidates(val, paciente.id);
    renderCandidates(matches, "Resultados de búsqueda:");
  });

  // Cerrar dropdown si se hace click fuera
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

    const currentName = formatPatientName(paciente).display;
    const currentTel = patientMissingPhone(paciente) ? "⚠️ Sin teléfono" : formatDisplayPhone(paciente.telefono);
    const currentDni = paciente.dni ? `DNI: ${escapeHtml(paciente.dni)}` : "Sin DNI";

    const targetName = formatPatientName(selectedTarget).display;
    const targetTel = patientMissingPhone(selectedTarget) ? "⚠️ Sin teléfono" : formatDisplayPhone(selectedTarget.telefono);
    const targetDni = selectedTarget.dni ? `DNI: ${escapeHtml(selectedTarget.dni)}` : "Sin DNI";

    // Si el paciente actual no tiene teléfono y el seleccionado sí, recomendar el seleccionado como principal
    const currentHasRealPhone = !isPlaceholderPhone(paciente.telefono);
    const targetHasRealPhone = !isPlaceholderPhone(selectedTarget.telefono);
    const defaultKeepSelected = !currentHasRealPhone && targetHasRealPhone;

    selectionBox.innerHTML = `
      <div class="merge-compare-grid">
        <div class="merge-compare-card current">
          <div class="merge-compare-badge">Ficha actual (#${paciente.id})</div>
          <div class="merge-compare-name">${escapeHtml(currentName)}</div>
          <div class="merge-compare-detail">
            <div>📞 ${escapeHtml(currentTel)}</div>
            <div>🪪 ${currentDni}</div>
          </div>
        </div>
        <div class="merge-compare-card target">
          <div class="merge-compare-badge">Ficha a unificar (#${selectedTarget.id})</div>
          <div class="merge-compare-name">${escapeHtml(targetName)}</div>
          <div class="merge-compare-detail">
            <div>📞 ${escapeHtml(targetTel)}</div>
            <div>🪪 ${targetDni}</div>
          </div>
        </div>
      </div>

      <div class="merge-direction-choice">
        <div style="font-size:11.5px; font-weight:700; color:#334155; text-transform:uppercase;">
          ¿Cuál ficha querés conservar como principal?
        </div>
        <label class="merge-radio-label">
          <input type="radio" name="merge_target_pick" value="current" ${defaultKeepSelected ? "" : "checked"}>
          <div class="merge-radio-text">
            <span class="merge-radio-title">Conservar ficha actual #${paciente.id} (${escapeHtml(currentName)})</span>
            <span class="merge-radio-desc">Se transferirán aquí todos los turnos, fichas y notas de #${selectedTarget.id}.</span>
          </div>
        </label>
        <label class="merge-radio-label">
          <input type="radio" name="merge_target_pick" value="selected" ${defaultKeepSelected ? "checked" : ""}>
          <div class="merge-radio-text">
            <span class="merge-radio-title">Conservar la otra ficha #${selectedTarget.id} (${escapeHtml(targetName)})</span>
            <span class="merge-radio-desc">Se transferirán allí todos los turnos, fichas y notas de #${paciente.id}.</span>
          </div>
        </label>
      </div>

      <div class="merge-warning-alert">
        ⚠️ <strong>Atención:</strong> La ficha no conservada se eliminará definitivamente tras transferir todos sus datos (turnos, fichas clínicas, notas e historial). Esta acción no se puede deshacer.
      </div>

      <div class="merge-actions">
        <button type="button" class="btn light small" id="btn-cancel-merge-selection">Elegir otro</button>
        <button type="button" class="btn danger" id="btn-execute-merge">Unificar Fichas</button>
      </div>
    `;
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

    const pickVal = selectionBox.querySelector('input[name="merge_target_pick"]:checked')?.value || "current";
    const keepCurrent = pickVal === "current";

    const targetId = keepCurrent ? Number(paciente.id) : Number(selectedTarget.id);
    const sourceId = keepCurrent ? Number(selectedTarget.id) : Number(paciente.id);
    const targetName = keepCurrent ? formatPatientName(paciente).display : formatPatientName(selectedTarget).display;
    const sourceName = keepCurrent ? formatPatientName(selectedTarget).display : formatPatientName(paciente).display;

    const ok = await dialogConfirm(
      `¿Confirmás la unificación de estas dos fichas?\n\n` +
      `• Ficha que se CONSERVA: #${targetId} (${targetName})\n` +
      `• Ficha que se ABSORBE Y ELIMINA: #${sourceId} (${sourceName})\n\n` +
      `Todos los turnos, fichas clínicas, notas e interacciones se consolidarán en la ficha #${targetId}. Esta acción no se puede deshacer.`,
      {
        title: "Confirmar unificación de pacientes",
        danger: true,
        okText: "Sí, unificar",
        cancelText: "Cancelar",
      }
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
        body: JSON.stringify({
          action: "merge",
          source_id: sourceId,
          target_id: targetId,
        }),
      });

      if (!res || res.status !== "success") {
        throw new Error(res?.message || "Error al unificar pacientes");
      }

      backdrop.remove();
      toast("Fichas unificadas exitosamente", { type: "success" });
      if (typeof onReload === "function") {
        await onReload();
      }
    } catch (err) {
      if (btnExec) {
        btnExec.disabled = false;
        btnExec.textContent = "Unificar Fichas";
      }
      await dialogAlert(err.message || "Error al unificar fichas", { type: "danger" });
    }
  }
}
