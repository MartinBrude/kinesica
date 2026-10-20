/**
 * Kinésica Admin - Módulo de Configuración Unificada
 * Integra en un único centro de control:
 * 1. Mensajes de Clara en WhatsApp (Menú A-E y opciones)
 * 2. Mails y Políticas (Políticas de cancelación 24hs y notas)
 * 3. Horarios de Atención por profesional
 * 4. Honorarios y Medios de Pago
 */

import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert } from "./dom.js?v=78";

const viewConfiguracion = document.querySelector("#view-configuracion");

// Subpestañas
const configTabBtns = document.querySelectorAll(".config-tab-btn");
const configSections = document.querySelectorAll(".config-subpanel");

// Elementos de Textos de Clara & Mails
const inputMenuWelcome = document.querySelector("#cfg-menu-welcome");
const inputOptA = document.querySelector("#cfg-opt-a");
const inputOptB = document.querySelector("#cfg-opt-b");
const inputOptD = document.querySelector("#cfg-opt-d");
const inputCancellation = document.querySelector("#cfg-cancellation-policy");
const inputConfirmation = document.querySelector("#cfg-confirmation-notes");

const btnSaveTexts = document.querySelector("#btn-save-clara-texts");
const btnResetTexts = document.querySelector("#btn-reset-clara-texts");
const textsStatusBanner = document.querySelector("#clara-texts-status-banner");
const textsLastUpdated = document.querySelector("#clara-texts-last-updated");

// Toggles de Clara y Booking en la cabecera de Configuración
const cfgClaraDot = document.querySelector("#cfg-clara-dot");
const cfgClaraText = document.querySelector("#cfg-clara-status-text");
const cfgClaraToggleBtn = document.querySelector("#cfg-btn-toggle-clara");

const cfgBookingDot = document.querySelector("#cfg-booking-dot");
const cfgBookingText = document.querySelector("#cfg-booking-status-text");
const cfgBookingToggleBtn = document.querySelector("#cfg-btn-toggle-booking");

export const DEFAULT_CLARA_TEXTS = {
  menu_welcome: "Hola! Te damos la bienvenida a Kinésica 🌿\n\n¿En qué podemos ayudarte hoy?\nEscribí la letra de tu consulta:\n\nA) Turnos y disponibilidad\nB) Dónde queda el consultorio y cómo llegar\nC) Honorarios y formas de pago\nD) Cómo venir vestido/a a la sesión\nE) Dejar un mensaje a Norberto o María",
  opt_a_text: "Para coordinar o consultar turnos, ingresá a nuestra turnera online: https://kinesica.com.ar/agendar 📅",
  opt_b_text: "Kinésica queda en Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz). 📍",
  opt_d_text: "Indumentaria para la sesión:\n• Ropa interior o pantalón corto para los varones.\n• Ropa interior con corpiño tradicional (no deportivo), malla de 2 piezas o calza corta para las mujeres.\nSi sos menor, vení acompañado/a por un mayor 🙌.",
  cancellation_policy: "Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación para permitir que otro paciente utilice la camilla.",
  confirmation_notes: "Por favor asistir con puntualidad exacta al horario asignado. El consultorio cuenta con una única camilla y no dispone de sala de espera."
};

let currentTexts = { ...DEFAULT_CLARA_TEXTS };
let activeClara = false;
let activeBooking = false;

export function showConfiguracionView(subtab = "clara") {
  if (viewConfiguracion) {
    viewConfiguracion.hidden = false;
    mountNestedViews();
    const views = ["#view-dashboard", "#view-library", "#view-pacientes", "#view-form", "#view-compare", "#view-gate"];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });

    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "configuracion", subtab }));
    } catch {}

    switchConfigSubtab(subtab);
    loadConfigData();
  }
}

export function hideConfiguracionView() {
  if (viewConfiguracion) {
    viewConfiguracion.hidden = true;
  }
}

export function switchConfigSubtab(subtabId) {
  configTabBtns.forEach((btn) => {
    if (btn.dataset.subtab === subtabId) {
      btn.classList.add("is-active");
    } else {
      btn.classList.remove("is-active");
    }
  });

  configSections.forEach((sec) => {
    if (sec.id === `config-panel-${subtabId}`) {
      sec.hidden = false;
    } else {
      sec.hidden = true;
    }
  });

  try {
    const current = JSON.parse(sessionStorage.getItem("kinesica_admin_view") || "{}");
    current.subtab = subtabId;
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify(current));
  } catch {}
}

function renderTexts(data) {
  if (inputMenuWelcome) inputMenuWelcome.value = data.menu_welcome || DEFAULT_CLARA_TEXTS.menu_welcome;
  if (inputOptA) inputOptA.value = data.opt_a_text || DEFAULT_CLARA_TEXTS.opt_a_text;
  if (inputOptB) inputOptB.value = data.opt_b_text || DEFAULT_CLARA_TEXTS.opt_b_text;
  if (inputOptD) inputOptD.value = data.opt_d_text || DEFAULT_CLARA_TEXTS.opt_d_text;
  if (inputCancellation) inputCancellation.value = data.cancellation_policy || DEFAULT_CLARA_TEXTS.cancellation_policy;
  if (inputConfirmation) inputConfirmation.value = data.confirmation_notes || DEFAULT_CLARA_TEXTS.confirmation_notes;

  if (textsLastUpdated) {
    if (data.updated_at) {
      const date = new Date(data.updated_at);
      const str = date.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      textsLastUpdated.textContent = `Última modificación: ${str}${data.updated_by ? ` por ${data.updated_by}` : ""}`;
      textsLastUpdated.hidden = false;
    } else {
      textsLastUpdated.textContent = "Textos oficiales activos";
      textsLastUpdated.hidden = false;
    }
  }
}

function updateStatusToggles(isClaraOn, isBookingOn) {
  activeClara = isClaraOn;
  activeBooking = isBookingOn;

  if (cfgClaraDot) cfgClaraDot.className = `dash-status-dot ${isClaraOn ? "active" : "inactive"}`;
  if (cfgClaraText) cfgClaraText.textContent = isClaraOn ? "Clara WhatsApp: Activa" : "Clara WhatsApp: Pausada";
  if (cfgClaraToggleBtn) cfgClaraToggleBtn.textContent = isClaraOn ? "Pausar bot" : "Reanudar bot";

  if (cfgBookingDot) cfgBookingDot.className = `dash-status-dot ${isBookingOn ? "active" : "inactive"}`;
  if (cfgBookingText) cfgBookingText.textContent = isBookingOn ? "Reservas Web: Activas" : "Reservas Web: Pausadas";
  if (cfgBookingToggleBtn) cfgBookingToggleBtn.textContent = isBookingOn ? "Pausar turnera" : "Activar turnera";
}

async function loadConfigData() {
  try {
    const data = await api("settings.php");
    if (data) {
      if (data.clara_texts) {
        currentTexts = { ...DEFAULT_CLARA_TEXTS, ...data.clara_texts };
        renderTexts(currentTexts);
      }
      const isClaraOn = typeof data.clara_active === "boolean" ? data.clara_active : true;
      const isBookingOn = typeof data.booking_active === "boolean" ? data.booking_active : true;
      updateStatusToggles(isClaraOn, isBookingOn);
    }
  } catch (err) {
    console.warn("No se pudo cargar la configuración:", err);
  }
}

export function initConfiguracionModule(callbacks = {}) {
  // Pestañas
  configTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const subtab = btn.dataset.subtab;
      switchConfigSubtab(subtab);
    });
  });

  // Guardar Textos de Clara & Políticas
  btnSaveTexts?.addEventListener("click", async () => {
    btnSaveTexts.disabled = true;
    btnSaveTexts.textContent = "Guardando...";

    const payload = {
      clara_texts: {
        menu_welcome: inputMenuWelcome?.value?.trim() || DEFAULT_CLARA_TEXTS.menu_welcome,
        opt_a_text: inputOptA?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_a_text,
        opt_b_text: inputOptB?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_b_text,
        opt_d_text: inputOptD?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_d_text,
        cancellation_policy: inputCancellation?.value?.trim() || DEFAULT_CLARA_TEXTS.cancellation_policy,
        confirmation_notes: inputConfirmation?.value?.trim() || DEFAULT_CLARA_TEXTS.confirmation_notes,
      }
    };

    try {
      const res = await api("settings.php", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (res && res.clara_texts) {
        currentTexts = { ...DEFAULT_CLARA_TEXTS, ...res.clara_texts };
        renderTexts(currentTexts);
      }
      if (textsStatusBanner) {
        textsStatusBanner.textContent = "✓ Textos y políticas guardados con éxito.";
        textsStatusBanner.className = "horarios-alert-box success";
        textsStatusBanner.hidden = false;
        setTimeout(() => { textsStatusBanner.hidden = true; }, 4000);
      }
    } catch (err) {
      dialogAlert(err?.message || "Error al guardar los textos de Clara.");
    } finally {
      btnSaveTexts.disabled = false;
      btnSaveTexts.textContent = "Guardar textos y políticas";
    }
  });

  // Restaurar valores por defecto
  btnResetTexts?.addEventListener("click", () => {
    if (confirm("¿Deseas restaurar los mensajes y políticas predeterminados de Kinésica?")) {
      renderTexts(DEFAULT_CLARA_TEXTS);
    }
  });

  // Toggle Clara
  cfgClaraToggleBtn?.addEventListener("click", async () => {
    const nextState = !activeClara;
    cfgClaraToggleBtn.disabled = true;
    try {
      await api("settings.php", {
        method: "POST",
        body: JSON.stringify({ clara_active: nextState })
      });
      localStorage.setItem("kinesica_clara_active", nextState ? "1" : "0");
      updateStatusToggles(nextState, activeBooking);
      callbacks.onClaraToggled?.(nextState);
    } catch (err) {
      dialogAlert("No se pudo cambiar el estado de Clara.");
    } finally {
      cfgClaraToggleBtn.disabled = false;
    }
  });

  // Toggle Booking
  cfgBookingToggleBtn?.addEventListener("click", async () => {
    const nextState = !activeBooking;
    cfgBookingToggleBtn.disabled = true;
    try {
      await api("settings.php", {
        method: "POST",
        body: JSON.stringify({ booking_active: nextState })
      });
      localStorage.setItem("kinesica_booking_active", nextState ? "1" : "0");
      updateStatusToggles(activeClara, nextState);
      callbacks.onBookingToggled?.(nextState);
    } catch (err) {
      dialogAlert("No se pudo cambiar el estado de la turnera.");
    } finally {
      cfgBookingToggleBtn.disabled = false;
    }
  });
}

export function mountNestedViews() {
  const horContainer = document.querySelector("#config-horarios-placeholder");
  const honContainer = document.querySelector("#config-honorarios-placeholder");
  const viewHorarios = document.querySelector("#view-horarios");
  const viewHonorarios = document.querySelector("#view-honorarios");

  if (horContainer && viewHorarios && viewHorarios.parentElement !== horContainer) {
    horContainer.appendChild(viewHorarios);
    viewHorarios.hidden = false;
  }
  if (honContainer && viewHonorarios && viewHonorarios.parentElement !== honContainer) {
    honContainer.appendChild(viewHonorarios);
    viewHonorarios.hidden = false;
  }
}
