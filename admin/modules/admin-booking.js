/**
 * Turnera profesional de ADMIN.
 * Reutiliza el motor oficial de booking, pero toma el paciente desde el
 * directorio autenticado del consultorio y permite registrar primeras visitas.
 * El selector de paciente (con búsqueda por texto) es el eje del paso 1.
 */

import { api } from "./api.js?v=78";
import { getSessionUser } from "./auth.js?v=83";

let modal = null;
let widget = null;
let patients = [];
let patientsLoaded = false;
let picker = null;
let activeIndex = -1;
let currentResults = [];

const MAX_RESULTS = 8;

const PUBLIC_BOOKING_API_URL =
  "https://script.google.com/macros/s/AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ/exec";

function isAdmin() {
  const user = getSessionUser();
  return Boolean(user && ["admin", "professional"].includes(user.role));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function patientName(patient) {
  return String(patient.nombre_completo || `${patient.nombre || ""} ${patient.apellido || ""}`).trim() || "Sin nombre";
}

function patientMeta(patient) {
  const parts = [];
  if (patient.telefono && !String(patient.telefono).startsWith("sin-")) parts.push(patient.telefono);
  if (patient.dni) parts.push(`DNI ${patient.dni}`);
  return parts.join(" · ");
}

function searchPatients(query) {
  const q = normalize(query);
  if (!q) return [];
  const digits = q.replace(/\D/g, "");
  const terms = q.split(/\s+/).filter(Boolean);
  return patients
    .filter((patient) => {
      const haystack = normalize(`${patientName(patient)} ${patient.email || ""}`);
      if (terms.every((term) => haystack.includes(term))) return true;
      if (digits.length >= 3) {
        const phone = String(patient.telefono || "").replace(/\D/g, "");
        const dni = String(patient.dni || "").replace(/\D/g, "");
        return phone.includes(digits) || dni.includes(digits);
      }
      return false;
    })
    .slice(0, MAX_RESULTS);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);
}

function buildPicker() {
  const el = document.createElement("div");
  el.className = "admin-patient-picker";
  el.innerHTML = `
    <label class="admin-patient-picker-label" for="admin-patient-search">Paciente</label>
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
      <div class="admin-patient-picker-hint" data-role="hint">Cargando directorio…</div>
    </div>
    <div class="admin-patient-selected" data-role="selected" hidden>
      <div>
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
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!currentResults.length) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      activeIndex = (activeIndex + delta + currentResults.length) % currentResults.length;
      highlight();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const pick = currentResults[activeIndex >= 0 ? activeIndex : 0];
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
    const patient = patients.find((p) => String(p.id) === item.dataset.id);
    if (patient) choosePatient(patient);
  });
  el.querySelector('[data-role="new"]').addEventListener("click", () => chooseNew());
  el.querySelector('[data-role="change"]').addEventListener("click", () => clearSelection(true));

  return el;
}

function renderResults(query) {
  const list = picker.querySelector("ul");
  const input = picker.querySelector("input");
  currentResults = searchPatients(query);
  activeIndex = currentResults.length ? 0 : -1;
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

function highlight() {
  const input = picker.querySelector("input");
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

function hideResults() {
  if (!picker) return;
  const list = picker.querySelector("ul");
  list.hidden = true;
  picker.querySelector("input").setAttribute("aria-expanded", "false");
}

function showSelected(name, meta) {
  picker.querySelector('[data-role="search"]').hidden = true;
  const box = picker.querySelector('[data-role="selected"]');
  box.hidden = false;
  picker.querySelector('[data-role="selected-name"]').textContent = name;
  picker.querySelector('[data-role="selected-meta"]').textContent = meta;
}

function choosePatient(patient) {
  hideResults();
  showSelected(patientName(patient), patientMeta(patient) || "Paciente registrado");
  widget.reset();
  widget.setAdminPatient(patient);
}

function chooseNew() {
  hideResults();
  showSelected("Paciente de primera vez", "Completá sus datos y la técnica");
  widget.reset();
  widget.setAdminNewPatient();
}

function clearSelection(focus) {
  if (!picker) return;
  picker.querySelector('[data-role="search"]').hidden = false;
  picker.querySelector('[data-role="selected"]').hidden = true;
  const input = picker.querySelector("input");
  input.value = "";
  hideResults();
  widget?.reset();
  if (focus) input.focus();
}

function updateHint(text) {
  const hint = picker?.querySelector('[data-role="hint"]');
  if (hint) hint.textContent = text;
}

function closeAdminBooking() {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("kinesica-booking-modal-open");
  clearSelection(false);
}

async function loadPatients() {
  if (patientsLoaded) return;
  const input = picker?.querySelector("input");
  if (input) input.disabled = true;
  try {
    const response = await api("pacientes.php");
    patients = Array.isArray(response?.items) ? response.items : [];
    patientsLoaded = true;
    updateHint(`${patients.length} pacientes en el directorio.`);
  } finally {
    if (input) input.disabled = false;
  }
}

async function persistFirstVisit(payload) {
  await api("pacientes.php", {
    method: "POST",
    body: {
      action: "upsert",
      telefono: payload.telefono,
      nombre_completo: payload.nombre,
      dni: payload.dni,
      email: payload.email,
      profesional_habitual: payload.practitionerId || "indistinto",
      motivo_consulta: payload.especialidad || payload.motivo || "",
      origen: "admin",
    },
  });
  patientsLoaded = false;
}

function openAdminBooking() {
  if (!isAdmin()) return;
  modal = document.getElementById("admin-booking-modal");
  if (!modal) return;

  const Widget = window.KinesicaBookingWidget;
  const mount = document.getElementById("admin-booking-widget-mount");
  if (!Widget || !mount) return;

  if (!widget) {
    widget = new Widget(mount, {
      apiUrl: window.__KINESICA_CONFIG__?.bookingApiUrl || window.KINESICA_SITE?.bookingApiUrl || PUBLIC_BOOKING_API_URL,
      forceMock: false,
      isModal: true,
      adminMode: true,
      onClose: closeAdminBooking,
      onBookingSuccess: async (payload) => {
        if (!widget.state.adminPatient) await persistFirstVisit(payload);
      },
    });
    picker = buildPicker();
    const step1 = mount.querySelector("#kb-step-1");
    if (step1) step1.prepend(picker);
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("kinesica-booking-modal-open");
  loadPatients()
    .then(() => setTimeout(() => picker.querySelector("input")?.focus(), 80))
    .catch((error) => {
      updateHint("No se pudo cargar el directorio. Podés agendar un paciente de primera vez.");
      console.error("No se pudo cargar el directorio para la turnera profesional:", error);
    });
}

export function initAdminBooking() {
  modal = document.getElementById("admin-booking-modal");
  if (!modal) return;

  document.querySelectorAll("[data-admin-booking-open]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openAdminBooking();
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAdminBooking();
      }
    });
  });

  modal.querySelector("[data-action=\"admin-booking-close\"]")?.addEventListener("click", closeAdminBooking);
  modal.querySelector("[data-action=\"admin-booking-close-backdrop\"]")?.addEventListener("click", closeAdminBooking);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) closeAdminBooking();
  });
}
