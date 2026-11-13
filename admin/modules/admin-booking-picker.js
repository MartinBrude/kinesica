import {
  getPicker,
  getPatients,
  getActiveIndex,
  setActiveIndex,
  setCurrentResults,
  getCurrentResults,
  getWidget,
} from "./admin-booking-state.js";
import {
  patientName,
  patientMeta,
  searchPatients,
  escapeHtml,
  normalize,
} from "./admin-booking-utils.js";

export function hideResults() {
  const picker = getPicker();
  if (!picker) return;
  const list = picker.querySelector("ul");
  list.hidden = true;
  picker.querySelector("input").setAttribute("aria-expanded", "false");
}

export function showSelected(name, meta) {
  const picker = getPicker();
  picker.querySelector('[data-role="search"]').hidden = true;
  const box = picker.querySelector('[data-role="selected"]');
  box.hidden = false;
  picker.querySelector('[data-role="selected-name"]').textContent = name;
  picker.querySelector('[data-role="selected-meta"]').textContent = meta;
}

export function choosePatient(patient) {
  const widget = getWidget();
  hideResults();
  showSelected(patientName(patient), patientMeta(patient) || "Paciente registrado");
  widget.reset();
  widget.setAdminPatient(patient);
}

export function chooseNew() {
  const widget = getWidget();
  hideResults();
  showSelected("Paciente de primera vez", "Completá sus datos y la técnica");
  widget.reset();
  widget.setAdminNewPatient();
}

export function clearSelection(focus) {
  const picker = getPicker();
  const widget = getWidget();
  if (!picker) return;
  picker.querySelector('[data-role="search"]').hidden = false;
  picker.querySelector('[data-role="selected"]').hidden = true;
  const input = picker.querySelector("input");
  input.value = "";
  hideResults();
  widget?.reset();
  if (focus) input.focus();
}

export function updateHint(text) {
  const hint = getPicker()?.querySelector('[data-role="hint"]');
  if (hint) hint.textContent = text;
}

export function highlight() {
  const picker = getPicker();
  const input = picker.querySelector("input");
  const activeIndex = getActiveIndex();
  picker.querySelectorAll(".admin-patient-result").forEach((item, idx) => {
    const active = idx === activeIndex;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", active ? "true" : "false");
    if (active) {
      input.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    }
  });
}

export function renderResults(query) {
  const picker = getPicker();
  const list = picker.querySelector("ul");
  const input = picker.querySelector("input");
  const currentResults = searchPatients(query);
  setCurrentResults(currentResults);
  setActiveIndex(currentResults.length ? 0 : -1);
  if (!normalize(query)) {
    hideResults();
    return;
  }
  list.innerHTML = currentResults.length
    ? currentResults
      .map((patient, idx) => `
        <li role="option" id="admin-patient-opt-${idx}" data-id="${escapeHtml(patient.id)}" class="admin-patient-result">
          <strong>${escapeHtml(patientName(patient))}</strong>
          <span>${escapeHtml(patientMeta(patient))}</span>
        </li>`)
      .join("")
    : `<li class="admin-patient-empty">Sin resultados. ¿Es un paciente de primera vez?</li>`;
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  highlight();
}

export function buildPicker() {
  const el = document.createElement("div");
  el.className = "admin-patient-picker";
  el.innerHTML = `
    <div class="admin-patient-picker-heading">
      <div>
        <label class="admin-patient-picker-label" for="admin-patient-search">¿A quién le agendamos?</label>
        <p class="admin-patient-picker-help">Buscá un paciente registrado o cargá una primera visita.</p>
      </div>
      <span class="admin-patient-picker-step">Paso 1 de 2</span>
    </div>
    <div class="admin-patient-picker-search" data-role="search">
      <div class="admin-patient-picker-row">
        <div class="admin-patient-picker-combo">
          <input type="search" id="admin-patient-search" autocomplete="off" spellcheck="false"
            placeholder="Buscar por nombre, teléfono o DNI…"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="admin-patient-results">
          <ul id="admin-patient-results" class="admin-patient-results" role="listbox" hidden></ul>
        </div>
        <button type="button" class="admin-patient-new" data-role="new">+ Paciente de primera vez</button>
      </div>
      <div class="admin-patient-picker-hint" data-role="hint"><span class="loading-spinner-sm" aria-hidden="true"></span> Cargando directorio…</div>
    </div>
    <div class="admin-patient-selected" data-role="selected" hidden>
      <div>
        <span class="admin-patient-selected-badge">Paciente encontrado</span>
        <strong data-role="selected-name"></strong>
        <span data-role="selected-meta"></span>
      </div>
      <button type="button" class="admin-patient-change" data-role="change">Cambiar</button>
    </div>
  `;

  const input = el.querySelector("input");
  const list = el.querySelector("ul");

  input.addEventListener("input", () => renderResults(input.value));
  input.addEventListener("focus", () => {
    if (input.value) renderResults(input.value);
  });
  input.addEventListener("blur", () => setTimeout(() => hideResults(), 150));
  input.addEventListener("keydown", (event) => {
    const currentResults = getCurrentResults();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!currentResults.length) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (getActiveIndex() + delta + currentResults.length) % currentResults.length;
      setActiveIndex(next);
      highlight();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const pick = currentResults[getActiveIndex() >= 0 ? getActiveIndex() : 0];
      if (pick) choosePatient(pick);
    } else if (event.key === "Escape" && !list.hidden) {
      event.stopPropagation();
      hideResults();
    }
  });
  list.addEventListener("mousedown", (event) => {
    const item = event.target.closest("[data-id]");
    if (!item) return;
    event.preventDefault();
    const patient = getPatients().find((p) => String(p.id) === item.dataset.id);
    if (patient) choosePatient(patient);
  });
  el.querySelector('[data-role="new"]').addEventListener("click", () => chooseNew());
  el.querySelector('[data-role="change"]').addEventListener("click", () => clearSelection(true));

  return el;
}
