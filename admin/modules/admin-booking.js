/**
 * Turnera profesional de ADMIN.
 * Reutiliza el motor oficial de booking, pero toma el paciente desde el
 * directorio autenticado del consultorio y permite registrar primeras visitas.
 */

import { api } from "./api.js?v=78";
import { getSessionUser } from "./auth.js?v=83";

let modal = null;
let widget = null;
let patients = [];
let patientsLoaded = false;

const PUBLIC_BOOKING_API_URL =
  "https://script.google.com/macros/s/AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ/exec";

function isAdmin() {
  const user = getSessionUser();
  return Boolean(user && ["admin", "professional"].includes(user.role));
}

function closeAdminBooking() {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("kinesica-booking-modal-open");
  widget?.reset();
  const select = document.getElementById("admin-booking-patient");
  if (select) select.value = "";
}

function patientLabel(patient) {
  const name = String(patient.nombre_completo || `${patient.nombre || ""} ${patient.apellido || ""}`).trim();
  const phone = patient.telefono && !String(patient.telefono).startsWith("sin-") ? ` · ${patient.telefono}` : "";
  return `${name || "Sin nombre"}${phone}`;
}

function renderPatientOptions() {
  const select = document.getElementById("admin-booking-patient");
  if (!select) return;
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "— Seleccionar paciente —";
  select.append(empty);

  const firstVisit = document.createElement("option");
  firstVisit.value = "__new__";
  firstVisit.textContent = "+ Paciente de primera vez";
  select.append(firstVisit);

  const group = document.createElement("optgroup");
  group.label = "Pacientes registrados";
  patients.forEach((patient) => {
    const option = document.createElement("option");
    option.value = String(patient.id);
    option.textContent = patientLabel(patient);
    group.append(option);
  });
  select.append(group);
}

async function loadPatients() {
  if (patientsLoaded) return;
  const select = document.getElementById("admin-booking-patient");
  if (select) select.disabled = true;
  try {
    const response = await api("pacientes.php");
    patients = Array.isArray(response?.items) ? response.items : [];
    patientsLoaded = true;
    renderPatientOptions();
  } finally {
    if (select) select.disabled = false;
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

function selectPatient(value) {
  if (!widget) return;
  widget.reset();
  if (value === "__new__") {
    widget.setAdminNewPatient();
    return;
  }
  const patient = patients.find((item) => String(item.id) === String(value));
  if (patient) widget.setAdminPatient(patient);
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
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("kinesica-booking-modal-open");
  loadPatients().catch((error) => {
    const select = document.getElementById("admin-booking-patient");
    if (select) {
      select.innerHTML = "<option value=\"\">No se pudo cargar el directorio</option>";
      select.disabled = true;
    }
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

  document.getElementById("admin-booking-patient")?.addEventListener("change", (event) => {
    selectPatient(event.target.value);
  });
  modal.querySelector("[data-action=\"admin-booking-close\"]")?.addEventListener("click", closeAdminBooking);
  modal.querySelector("[data-action=\"admin-booking-close-backdrop\"]")?.addEventListener("click", closeAdminBooking);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) closeAdminBooking();
  });
}

