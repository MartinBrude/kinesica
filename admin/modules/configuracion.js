/**
 * Kinésica Admin - Módulo de Configuración Unificada
 * Integra en un único centro de control:
 * 1. Mensajes de Clara en WhatsApp (Menú A-E y opciones)
 * 2. Mails y Políticas (Políticas de cancelación 24hs y notas)
 * 3. Horarios de Atención por profesional
 * 4. Honorarios y Medios de Pago
 */

import { DEFAULT_OPT_C_TEXT, renderOptCText, REMINDER_TEMPLATE_TEXT, renderReminderPreview } from "./menu-texts.js?v=2";
import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";
import { loadHorariosFromServer } from "./horarios.js?v=3";
import { loadHonorarios } from "./honorarios.js?v=2";
import { appendChatMessage, resetChatDemo, initChatSimulator, setChatContext } from "./chat-simulator.js?v=2";

const viewConsultorio = document.querySelector("#view-consultorio");
const viewClara = document.querySelector("#view-clara");
const viewConfiguracion = document.querySelector("#view-configuracion");

// Subpestañas (compatibilidad si existieran)
const configTabBtns = document.querySelectorAll(".config-tab-btn");
const configSections = document.querySelectorAll(".config-subpanel");

// Elementos de Textos de Clara & Mails
const inputMenuWelcome = document.querySelector("#cfg-menu-welcome");
const inputOptA = document.querySelector("#cfg-opt-a");
const inputOptB = document.querySelector("#cfg-opt-b");
const inputOptC = document.querySelector("#cfg-opt-c");
const inputOptD = document.querySelector("#cfg-opt-d");
const inputCancellation = document.querySelector("#cfg-cancellation-policy");
const inputConfirmation = document.querySelector("#cfg-confirmation-notes");
const inputReminderText = document.querySelector("#cfg-reminder-text");
const inputReminderNotes = document.querySelector("#cfg-reminder-notes");
const inputClaraReminderText = document.querySelector("#cfg-clara-reminder-text");
const inputClaraReminderNotes = document.querySelector("#cfg-clara-reminder-notes");
const reminderPreview = document.querySelector("#cfg-reminder-preview");
const claraReminderPreview = document.querySelector("#cfg-clara-reminder-preview");

// Opciones personalizadas del menú
const customOptionsContainer = document.querySelector("#custom-options-container");
const customOptionsEmpty = document.querySelector("#custom-options-empty");
const btnAddCustomOption = document.querySelector("#btn-add-custom-option");
let customMenuOptions = [];

const btnSaveTexts = document.querySelector("#btn-save-clara-texts");
const btnSaveMailsPolicies = document.querySelector("#btn-save-mails-policies");
const textsStatusBanner = document.querySelector("#clara-texts-status-banner");
const mailsStatusBanner = document.querySelector("#mails-texts-status-banner");

// Toggles de Clara y Booking en la cabecera de Configuración
const cfgClaraDot = document.querySelector("#cfg-clara-dot");
const cfgClaraText = document.querySelector("#cfg-clara-status-text");
const cfgClaraToggleBtn = document.querySelector("#cfg-btn-toggle-clara");

const cfgBookingDot = document.querySelector("#cfg-booking-dot");
const cfgBookingText = document.querySelector("#cfg-booking-status-text");
const cfgBookingToggleBtn = document.querySelector("#cfg-btn-toggle-booking");

export const DEFAULT_CLARA_TEXTS = {
  menu_welcome: `¡Hola! Te damos la bienvenida a *Kinésica* 🩺

Por favor, respondé con la letra de la opción que necesitás:

*A.* 📅 Turnos (agendar, consultar o cancelar)
*B.* 📍 Ubicación y horarios del consultorio
*C.* 💳 Honorarios y cobertura (obras sociales / reintegros)
*D.* 👕 ¿Cómo venir vestido/a a la sesión?
*E.* 💬 Comunicarte con un profesional (Lic. Norberto Brude / Lic. María Gulin)

_(Escribí la letra de la opción deseada, por ejemplo *A* o *C*)_`,
  opt_a_text: `📅 *Turnos y Reservas - Kinésica*

Para ver los días y horarios disponibles en tiempo real con Norberto o María y agendar tu sesión de 60 minutos, ingresá a nuestra turnera online:

👉 *https://kinesica.com.ar/agendar*`,
  opt_b_text: `📍 *Kinésica Consultorio*
• *Ubicación:* Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz, a metros de Av. Santa Fe y estación Scalabrini Ortiz del Subte D).
• *Google Maps:* https://maps.google.com/?q=Charcas+3889+Palermo+CABA`,
  opt_c_text: DEFAULT_OPT_C_TEXT,
  opt_d_text: `👕 *Indumentaria para la sesión:*
• Ropa interior o pantalón corto para los varones.
• Ropa interior con corpiño tradicional (no deportivo), malla de 2 piezas o calza corta para las mujeres.
Si sos menor, vení acompañado/a por un mayor 🙌.`,
  cancellation_policy: `Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación 🙌.`,
  confirmation_notes: `Por favor asistir con puntualidad exacta al horario asignado. El consultorio cuenta con una única camilla y no dispone de sala de espera 📍.`,
  reminder_text: `¡Hola {nombre}! 🌿 Te escribo desde Kinésica para recordarte tu {tipo_cita} programada para mañana a las {horario}.

{indicaciones}

Por favor confirmá tu asistencia seleccionando una de las opciones a continuación 🙌:`,
  reminder_notes: `📍 Te esperamos en Charcas 3889, 5º, B (Palermo).
⚠️ Te recordamos que el espacio no cuenta con sala de espera, por lo que te pedimos puntualidad estricta para evitar esperas en la entrada y no concurrir con acompañantes (salvo menores de edad o personas que requieran asistencia directa).
Si tienen estudios médicos previos, no olviden traerlos.`
};

let currentTexts = { ...DEFAULT_CLARA_TEXTS };

setChatContext({
  defaults: DEFAULT_CLARA_TEXTS,
  inputs: { menuWelcome: inputMenuWelcome, optA: inputOptA, optB: inputOptB, optC: inputOptC, optD: inputOptD },
  getTexts: () => currentTexts,
  getCustomOptions: () => customMenuOptions,
});
// Estado de carga de los textos: no se guarda nada hasta haber cargado la versión del servidor,
// y sólo se envían los campos que cambiaron respecto de lo cargado (con su revisión).
let textsLoaded = false;
let textsRevision = null;
let loadedFormValues = null;
let activeClara = false;
let activeBooking = false;

export function showConsultorioView() {
  if (viewConsultorio) {
    viewConsultorio.hidden = false;
    const views = ["#view-dashboard", "#view-library", "#view-pacientes", "#view-clara", "#view-configuracion", "#view-form", "#view-compare", "#view-gate"];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });

    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "consultorio" }));
    } catch {}

    loadHorariosFromServer();
    loadHonorarios();
  }
}

export function hideConsultorioView() {
  if (viewConsultorio) {
    viewConsultorio.hidden = true;
  }
}

export function showClaraView() {
  if (viewClara) {
    viewClara.hidden = false;
    const views = ["#view-dashboard", "#view-library", "#view-pacientes", "#view-consultorio", "#view-configuracion", "#view-form", "#view-compare", "#view-gate"];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });

    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "clara" }));
    } catch {}

    loadConfigData();
    const chatMessagesEl = document.querySelector("#chat-demo-messages");
    if (chatMessagesEl && chatMessagesEl.children.length === 0) {
      resetChatDemo();
    }
  }
}

export function hideClaraView() {
  if (viewClara) {
    viewClara.hidden = true;
  }
}

export function showConfiguracionView(subtab = "clara") {
  if (subtab === "horarios" || subtab === "honorarios") {
    showConsultorioView();
  } else {
    showClaraView();
  }
}

export function hideConfiguracionView() {
  hideConsultorioView();
  hideClaraView();
}

export function switchConfigSubtab(subtabId) {
  if (subtabId === "horarios" || subtabId === "honorarios") {
    showConsultorioView();
  } else {
    showClaraView();
  }
}

function getNextAvailableLetter() {
  const used = new Set(["A", "B", "C", "D", "E"]);
  customMenuOptions.forEach((opt) => {
    if (opt.letter) used.add(opt.letter.toUpperCase());
  });
  const alphabet = "FGHIJKLMNOPQRSTUVWXYZ".split("");
  for (const l of alphabet) {
    if (!used.has(l)) return l;
  }
  return "F";
}

function renderCustomOptionsList() {
  if (!customOptionsContainer) return;
  customOptionsContainer.replaceChildren();

  if (!customMenuOptions || customMenuOptions.length === 0) {
    if (customOptionsEmpty) customOptionsEmpty.hidden = false;
    return;
  }
  if (customOptionsEmpty) customOptionsEmpty.hidden = true;

  customMenuOptions.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "custom-option-card";
    row.style.cssText = "background:var(--bg); border:1px solid var(--line); border-radius:var(--radius); padding:14px 16px; display:flex; flex-direction:column; gap:10px;";

    const topBar = document.createElement("div");
    topBar.style.cssText = "display:flex; align-items:center; gap:10px;";

    const letterLabel = document.createElement("span");
    letterLabel.textContent = "Letra:";
    letterLabel.style.cssText = "font-weight:600; font-size:13px; color:var(--navy);";

    const letterInput = document.createElement("input");
    letterInput.type = "text";
    letterInput.maxLength = 2;
    letterInput.value = item.letter || "";
    letterInput.placeholder = "F";
    letterInput.style.cssText = "width:48px; text-transform:uppercase; text-align:center; font-weight:700; padding:6px; border:1px solid var(--line); border-radius:4px; font-size:14px; background:#fff;";
    letterInput.addEventListener("input", (e) => {
      let val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (["A", "B", "C", "D", "E"].includes(val)) {
        dialogAlert(`Las letras A, B, C, D y E están reservadas para las funciones nativas (Turnos, Ubicación, Honorarios, Ropa y Contacto). Por favor elegí desde la F en adelante.`);
        val = "";
      }
      e.target.value = val;
      item.letter = val;
    });

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = item.label || "";
    titleInput.placeholder = "Título en el menú (ej: ¿Con qué técnicas trabajan?)";
    titleInput.style.cssText = "flex:1; padding:7px 10px; border:1px solid var(--line); border-radius:4px; font-size:14px; background:#fff;";
    titleInput.addEventListener("input", (e) => {
      item.label = e.target.value;
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "✕ Eliminar";
    delBtn.style.cssText = "background:transparent; border:1px solid #ef4444; color:#ef4444; border-radius:4px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer;";
    delBtn.addEventListener("click", () => {
      customMenuOptions.splice(index, 1);
      renderCustomOptionsList();
    });

    topBar.appendChild(letterLabel);
    topBar.appendChild(letterInput);
    topBar.appendChild(titleInput);
    topBar.appendChild(delBtn);

    const respTextarea = document.createElement("textarea");
    respTextarea.rows = 2;
    respTextarea.value = item.response || "";
    respTextarea.placeholder = "Respuesta exacta que dará Clara al elegir esta opción (ej: En Kinésica nos especializamos en RPG, Kinesiología postural y traumatológica, Osteopatía...)";
    respTextarea.style.cssText = "width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:4px; font-size:13px; font-family:inherit; line-height:1.4; resize:vertical; background:#fff;";
    respTextarea.addEventListener("input", (e) => {
      item.response = e.target.value;
    });

    row.appendChild(topBar);
    row.appendChild(respTextarea);
    customOptionsContainer.appendChild(row);
  });
}

function renderTexts(data) {
  if (inputMenuWelcome) inputMenuWelcome.value = data.menu_welcome || DEFAULT_CLARA_TEXTS.menu_welcome;
  if (inputOptA) inputOptA.value = data.opt_a_text || DEFAULT_CLARA_TEXTS.opt_a_text;
  if (inputOptB) inputOptB.value = data.opt_b_text || DEFAULT_CLARA_TEXTS.opt_b_text;
  if (inputOptC) inputOptC.value = data.opt_c_text || DEFAULT_CLARA_TEXTS.opt_c_text;
  if (inputOptD) inputOptD.value = data.opt_d_text || DEFAULT_CLARA_TEXTS.opt_d_text;
  if (inputCancellation) inputCancellation.value = (typeof data.cancellation_policy === "string" && data.cancellation_policy.trim()) ? data.cancellation_policy : DEFAULT_CLARA_TEXTS.cancellation_policy;
  if (inputConfirmation) inputConfirmation.value = (typeof data.confirmation_notes === "string" && data.confirmation_notes.trim()) ? data.confirmation_notes : DEFAULT_CLARA_TEXTS.confirmation_notes;

  const rNotes = (typeof data.reminder_notes === "string" && data.reminder_notes.trim()) ? data.reminder_notes : DEFAULT_CLARA_TEXTS.reminder_notes;
  // El texto del recordatorio lo fija la plantilla de Meta: se muestra sólo lectura, nunca el reminder_text guardado.
  if (inputReminderText) inputReminderText.value = REMINDER_TEMPLATE_TEXT;
  if (inputClaraReminderText) inputClaraReminderText.value = REMINDER_TEMPLATE_TEXT;
  if (inputReminderNotes) inputReminderNotes.value = rNotes;
  if (inputClaraReminderNotes) inputClaraReminderNotes.value = rNotes;
  updateReminderPreview();

  if (Array.isArray(data.custom_menu_options)) {
    customMenuOptions = JSON.parse(JSON.stringify(data.custom_menu_options));
  } else if (Array.isArray(data.clara_texts?.custom_menu_options)) {
    customMenuOptions = JSON.parse(JSON.stringify(data.clara_texts.custom_menu_options));
  } else {
    customMenuOptions = [];
  }
  renderCustomOptionsList();
}

function updateReminderPreview() {
  const notes = inputReminderNotes?.value?.trim() || inputClaraReminderNotes?.value?.trim() || DEFAULT_CLARA_TEXTS.reminder_notes;
  const preview = renderReminderPreview(notes);
  if (reminderPreview) reminderPreview.textContent = preview;
  if (claraReminderPreview) claraReminderPreview.textContent = preview;
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

function readFormTexts() {
  return {
    menu_welcome: inputMenuWelcome?.value?.trim() || DEFAULT_CLARA_TEXTS.menu_welcome,
    opt_a_text: inputOptA?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_a_text,
    opt_b_text: inputOptB?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_b_text,
    opt_c_text: inputOptC?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_c_text,
    opt_d_text: inputOptD?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_d_text,
    cancellation_policy: inputCancellation?.value?.trim() || DEFAULT_CLARA_TEXTS.cancellation_policy,
    confirmation_notes: inputConfirmation?.value?.trim() || DEFAULT_CLARA_TEXTS.confirmation_notes,
    reminder_notes: inputReminderNotes?.value?.trim() || inputClaraReminderNotes?.value?.trim() || DEFAULT_CLARA_TEXTS.reminder_notes,
  };
}

function rememberLoadedTexts(data) {
  textsRevision = Number(data?.clara_texts_revision ?? 0) || 0;
  loadedFormValues = { texts: readFormTexts(), custom: JSON.stringify(customMenuOptions) };
  textsLoaded = true;
}

async function loadConfigData() {
  try {
    const data = await api("settings.php?_t=" + Date.now());
    if (data) {
      if (data.clara_texts) {
        currentTexts = { ...DEFAULT_CLARA_TEXTS, ...data.clara_texts };
        if (data.custom_menu_options) {
          currentTexts.custom_menu_options = data.custom_menu_options;
        }
        renderTexts(currentTexts);
      } else if (data.custom_menu_options) {
        currentTexts.custom_menu_options = data.custom_menu_options;
        renderTexts(currentTexts);
      }
      const isClaraOn = typeof data.clara_active === "boolean" ? data.clara_active : true;
      const isBookingOn = typeof data.booking_active === "boolean" ? data.booking_active : true;
      updateStatusToggles(isClaraOn, isBookingOn);
      rememberLoadedTexts(data);
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

  // Agregar opción personalizada al menú
  btnAddCustomOption?.addEventListener("click", () => {
    const nextL = getNextAvailableLetter();
    customMenuOptions.push({
      letter: nextL,
      label: "",
      response: ""
    });
    renderCustomOptionsList();
  });

  // Guardar Textos de Clara & Políticas Unificado
  const handleSaveTextsAndPolicies = async (triggerBtn) => {
    if (!textsLoaded || !loadedFormValues) {
      dialogAlert("Todavía se están cargando los textos guardados. Esperá unos segundos e intentá de nuevo.");
      loadConfigData();
      return;
    }
    const isMailsBtn = triggerBtn === btnSaveMailsPolicies;
    if (btnSaveTexts) {
      btnSaveTexts.disabled = true;
      if (!isMailsBtn) btnSaveTexts.textContent = "Guardando...";
    }
    if (btnSaveMailsPolicies) {
      btnSaveMailsPolicies.disabled = true;
      if (isMailsBtn) btnSaveMailsPolicies.textContent = "Guardando...";
    }

    const restoreButtons = () => {
      if (btnSaveTexts) {
        btnSaveTexts.disabled = false;
        btnSaveTexts.textContent = "Guardar textos y políticas";
      }
      if (btnSaveMailsPolicies) {
        btnSaveMailsPolicies.disabled = false;
        btnSaveMailsPolicies.textContent = "Guardar políticas en mails";
      }
    };

    // Validar customMenuOptions
    const cleanCustom = [];
    const reserved = ["A", "B", "C", "D", "E"];
    for (const opt of customMenuOptions) {
      const l = String(opt.letter || "").trim().toUpperCase();
      const label = String(opt.label || "").trim();
      const response = String(opt.response || "").trim();
      if (!l && !label && !response) continue;
      if (!l) {
        dialogAlert("Cada opción personalizada debe tener una letra asignada (ej: F).");
        restoreButtons();
        return;
      }
      if (reserved.includes(l)) {
        dialogAlert(`La letra ${l} está reservada para las opciones nativas de Clara. Por favor usá letras de la F en adelante.`);
        restoreButtons();
        return;
      }
      if (!response) {
        dialogAlert(`Por favor ingresá la respuesta para la opción ${l}.`);
        restoreButtons();
        return;
      }
      cleanCustom.push({ letter: l, label: label || `Opción ${l}`, response });
    }

    // Sólo los campos que cambiaron respecto de lo cargado: así un formulario viejo no pisa otros textos.
    const formTexts = readFormTexts();
    const changedTexts = {};
    for (const [key, value] of Object.entries(formTexts)) {
      if (value !== loadedFormValues.texts[key]) changedTexts[key] = value;
    }
    const customChanged = JSON.stringify(cleanCustom) !== JSON.stringify(
      JSON.parse(loadedFormValues.custom || "[]").map((o) => ({ letter: o.letter, label: o.label, response: o.response }))
    );
    if (!Object.keys(changedTexts).length && !customChanged) {
      const banner = isMailsBtn ? mailsStatusBanner : textsStatusBanner;
      if (banner) {
        banner.textContent = "No hay cambios para guardar.";
        banner.className = "horarios-alert-box is-success";
        banner.hidden = false;
        setTimeout(() => { banner.hidden = true; }, 4000);
      }
      restoreButtons();
      return;
    }
    const payload = { base_revision: textsRevision, clara_texts: changedTexts };
    if (customChanged) {
      payload.clara_texts.custom_menu_options = cleanCustom;
      payload.custom_menu_options = cleanCustom;
    }

    try {
      const res = await api("settings.php", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (res && res.clara_texts) {
        currentTexts = { ...DEFAULT_CLARA_TEXTS, ...res.clara_texts };
        if (res.custom_menu_options) {
          currentTexts.custom_menu_options = res.custom_menu_options;
        }
        renderTexts(currentTexts);
        rememberLoadedTexts(res);
      }
      const showSuccess = (banner, msg) => {
        if (!banner) return;
        banner.textContent = msg;
        banner.className = "horarios-alert-box is-success";
        banner.hidden = false;
        setTimeout(() => { banner.hidden = true; }, 4000);
      };
      showSuccess(textsStatusBanner, "✓ Textos y opciones del menú guardados con éxito.");
      showSuccess(mailsStatusBanner, "✓ Políticas y pautas de mails guardadas con éxito.");
    } catch (err) {
      if (err?.status === 409) {
        // Otro guardado ganó: no se pisa. Se avisa y se conserva lo que la persona escribió en pantalla.
        dialogAlert(err.message || "Los textos se modificaron desde otra sesión. Recargá la página antes de guardar.");
      } else {
        dialogAlert(err?.message || "Error al guardar los textos de Clara.");
      }
    } finally {
      restoreButtons();
    }
  };

  btnSaveTexts?.addEventListener("click", () => handleSaveTextsAndPolicies(btnSaveTexts));
  btnSaveMailsPolicies?.addEventListener("click", () => handleSaveTextsAndPolicies(btnSaveMailsPolicies));

  // Sincronización en vivo de campos y vista previa de recordatorios
  const syncAndPreview = (source, target) => {
    if (target && source) target.value = source.value;
    updateReminderPreview();
  };
  inputReminderNotes?.addEventListener("input", () => syncAndPreview(inputReminderNotes, inputClaraReminderNotes));
  inputClaraReminderNotes?.addEventListener("input", () => syncAndPreview(inputClaraReminderNotes, inputReminderNotes));

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

  initChatSimulator();
}

// ----------------------------------------------------
// Vista previa y helpers de opt_c para el simulador / tests
export function previewOptCText(optC, fees) {
  return renderOptCText(optC, fees);
}

// Simulador de Chat con Clara (delegado a chat-simulator.js)
// ----------------------------------------------------
export { appendChatMessage, resetChatDemo, initChatSimulator } from "./chat-simulator.js?v=2";
