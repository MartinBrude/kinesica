/**
 * Kinésica Admin - Módulo de Configuración Unificada
 * Integra en un único centro de control:
 * 1. Mensajes de Clara en WhatsApp (Menú A-E y opciones)
 * 2. Mails y Políticas (Políticas de cancelación 24hs y notas)
 * 3. Horarios de Atención por profesional
 * 4. Honorarios y Medios de Pago
 */

import { DEFAULT_OPT_C_TEXT, DEFAULT_OPT_C_TEXT_EN, renderOptCText, renderOptCTextEn, REMINDER_TEMPLATE_TEXT, renderReminderPreview } from "./menu-texts.js?v=2";
import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";
import { loadHorariosFromServer } from "./horarios.js?v=3";
import { loadHonorarios } from "./honorarios.js?v=2";
import { appendChatMessage, resetChatDemo, initChatSimulator, setChatContext } from "./chat-simulator.js?v=9";

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
const inputOptE = document.querySelector("#cfg-opt-e");
const inputSubmenuTurnos = document.querySelector("#cfg-submenu-turnos");
const inputOptA2 = document.querySelector("#cfg-opt-a2");
const inputOptE1 = document.querySelector("#cfg-opt-e1");
const inputOptE2 = document.querySelector("#cfg-opt-e2");
const inputOptE3 = document.querySelector("#cfg-opt-e3");
const inputMenuWelcomeEn = document.querySelector("#cfg-menu-welcome-en");
const inputOptAEn = document.querySelector("#cfg-opt-a-en");
const inputOptBEn = document.querySelector("#cfg-opt-b-en");
const inputOptCEn = document.querySelector("#cfg-opt-c-en");
const inputOptDEn = document.querySelector("#cfg-opt-d-en");
const inputOptEEn = document.querySelector("#cfg-opt-e-en");
const inputSubmenuTurnosEn = document.querySelector("#cfg-submenu-turnos-en");
const inputOptA2En = document.querySelector("#cfg-opt-a2-en");
const inputOptE1En = document.querySelector("#cfg-opt-e1-en");
const inputOptE2En = document.querySelector("#cfg-opt-e2-en");
const inputOptE3En = document.querySelector("#cfg-opt-e3-en");
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
*F.* 🌐 English

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
  opt_e_text: `💬 *Contacto con un Profesional*

¿Con quién te gustaría comunicarte?
*1.* Lic. Norberto Brude
*2.* Lic. María Gulin
*3.* Indistinto / Primera consulta general

_(Respondé *1*, *2* o *3*, o escribí tu consulta directamente y se la transmitimos)_
_Escribí *MENU* para volver_`,
  submenu_turnos_text: `📅 *Gestión de Turnos - Kinésica*

Por favor elegí una opción respondiendo *1* o *2*:

*1.* 📅 Agendar un nuevo turno
*2.* 📋 Consultar o cancelar mis turnos

_(Respondé *1* o *2*, o escribí *MENU* para volver al menú principal)_`,
  opt_a2_text: `Con este número de WhatsApp no encontramos turnos agendados. Si agendaste con otro teléfono, respondé directamente con tu *DNI o Pasaporte* y lo buscamos.

_(Escribí *MENU* para volver)_`,
  opt_e1_text: `¡Perfecto! Ya le transmitimos tu consulta al Lic. Norberto Brude. Te estará contactando a la brevedad directamente por WhatsApp 🙌.

_(Escribí *MENU* si deseás ver otras opciones)_`,
  opt_e2_text: `¡Perfecto! Ya le transmitimos tu consulta a la Lic. María Gulin. Te estará contactando a la brevedad directamente por WhatsApp 🙌.

_(Escribí *MENU* si deseás ver otras opciones)_`,
  opt_e3_text: `¡Perfecto! Ya le transmitimos tu consulta a nuestro equipo de kinesiólogos. Te estarán contactando a la brevedad directamente por WhatsApp 🙌.

_(Escribí *MENU* si deseás ver otras opciones)_`,
  menu_welcome_en: `Hello! Welcome to *Kinésica* 🩺

Please reply with the letter of the option you need:

*A.* 📅 Appointments (book, check or cancel)
*B.* 📍 Location and office hours
*C.* 💳 Fees and coverage (health insurance / reimbursement)
*D.* 👕 Session attire and dress code
*E.* 💬 Speak with a practitioner (Lic. Norberto Brude / Lic. María Gulin)
*F.* 🇪🇸 Español

_(Reply with the option letter, for example *A* or *C*)_`,
  opt_a_text_en: `📅 *Appointments & Booking - Kinésica*

To check available days and times in real time with Norberto or María and book your 60-minute session, visit our online booking site:

👉 *https://kinesica.com.ar/agendar*`,
  opt_b_text_en: `📍 *Kinésica Clinic*
• *Location:* Charcas 3889, 5th Floor, Apt B, Palermo, Buenos Aires (between Scalabrini Ortiz and Aráoz, steps from Av. Santa Fe and Scalabrini Ortiz Subte D station).
• *Google Maps:* https://maps.google.com/?q=Charcas+3889+Palermo+CABA`,
  opt_c_text_en: DEFAULT_OPT_C_TEXT_EN,
  opt_d_text_en: `👕 *Attire for your session:*
• Underwear or shorts for men.
• Underwear with a standard (non-sports) bra, a 2-piece swimsuit, or short leggings for women.
• If you have previous medical imaging or tests (MRI, X-rays), please bring them or send us photos 🙌.

_(Type *MENU* to see the options again)_`,
  opt_e_text_en: `💬 *Contact a Practitioner*

Who would you like to speak with?
*1.* Lic. Norberto Brude
*2.* Lic. María Gulin
*3.* Either / General inquiry

_(Reply *1*, *2* or *3*, or write your question directly and we will pass it along)_
_Type *MENU* to return_`,
  submenu_turnos_text_en: `📅 *Appointments - Kinésica*

Please choose an option by replying *1* or *2*:

*1.* 📅 Book a new appointment
*2.* 📋 Check or cancel my appointments

_(Reply *1* or *2*, or type *MENU* to return to the main menu)_`,
  opt_a2_text_en: `We couldn't find any scheduled appointments for this WhatsApp number. If you booked using a different phone number, reply directly with your *ID or Passport* and we will look it up.

_(Type *MENU* to return)_`,
  opt_e1_text_en: `Great! We've forwarded your message to Lic. Norberto Brude. He will contact you shortly directly via WhatsApp 🙌.

_(Type *MENU* to see other options)_`,
  opt_e2_text_en: `Great! We've forwarded your message to Lic. María Gulin. She will contact you shortly directly via WhatsApp 🙌.

_(Type *MENU* to see other options)_`,
  opt_e3_text_en: `Great! We've forwarded your message to our physical therapy team. They will contact you shortly directly via WhatsApp 🙌.

_(Type *MENU* to see other options)_`,
  cancellation_policy: `Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación 🙌.`,
  confirmation_notes: `Por favor asistir con puntualidad exacta al horario asignado. No contamos con secretaria, si estamos atendiendo a otro paciente no podemos recibirte anticipadamente 📍.`,
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
  inputs: {
    menuWelcome: inputMenuWelcome,
    optA: inputOptA,
    optB: inputOptB,
    optC: inputOptC,
    optD: inputOptD,
    optE: inputOptE,
    submenuTurnos: inputSubmenuTurnos,
    optA2: inputOptA2,
    optE1: inputOptE1,
    optE2: inputOptE2,
    optE3: inputOptE3,
    menuWelcomeEn: inputMenuWelcomeEn,
    optAEn: inputOptAEn,
    optBEn: inputOptBEn,
    optCEn: inputOptCEn,
    optDEn: inputOptDEn,
    optEEn: inputOptEEn,
    submenuTurnosEn: inputSubmenuTurnosEn,
    optA2En: inputOptA2En,
    optE1En: inputOptE1En,
    optE2En: inputOptE2En,
    optE3En: inputOptE3En,
  },
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
  if (inputOptE) inputOptE.value = data.opt_e_text || DEFAULT_CLARA_TEXTS.opt_e_text;
  if (inputSubmenuTurnos) inputSubmenuTurnos.value = data.submenu_turnos_text || DEFAULT_CLARA_TEXTS.submenu_turnos_text;
  if (inputOptA2) inputOptA2.value = data.opt_a2_text || DEFAULT_CLARA_TEXTS.opt_a2_text;
  if (inputOptE1) inputOptE1.value = data.opt_e1_text || DEFAULT_CLARA_TEXTS.opt_e1_text;
  if (inputOptE2) inputOptE2.value = data.opt_e2_text || DEFAULT_CLARA_TEXTS.opt_e2_text;
  if (inputOptE3) inputOptE3.value = data.opt_e3_text || DEFAULT_CLARA_TEXTS.opt_e3_text;

  if (inputMenuWelcomeEn) inputMenuWelcomeEn.value = data.menu_welcome_en || DEFAULT_CLARA_TEXTS.menu_welcome_en;
  if (inputOptAEn) inputOptAEn.value = data.opt_a_text_en || DEFAULT_CLARA_TEXTS.opt_a_text_en;
  if (inputOptBEn) inputOptBEn.value = data.opt_b_text_en || DEFAULT_CLARA_TEXTS.opt_b_text_en;
  if (inputOptCEn) inputOptCEn.value = data.opt_c_text_en || DEFAULT_CLARA_TEXTS.opt_c_text_en;
  if (inputOptDEn) inputOptDEn.value = data.opt_d_text_en || DEFAULT_CLARA_TEXTS.opt_d_text_en;
  if (inputOptEEn) inputOptEEn.value = data.opt_e_text_en || DEFAULT_CLARA_TEXTS.opt_e_text_en;
  if (inputSubmenuTurnosEn) inputSubmenuTurnosEn.value = data.submenu_turnos_text_en || DEFAULT_CLARA_TEXTS.submenu_turnos_text_en;
  if (inputOptA2En) inputOptA2En.value = data.opt_a2_text_en || DEFAULT_CLARA_TEXTS.opt_a2_text_en;
  if (inputOptE1En) inputOptE1En.value = data.opt_e1_text_en || DEFAULT_CLARA_TEXTS.opt_e1_text_en;
  if (inputOptE2En) inputOptE2En.value = data.opt_e2_text_en || DEFAULT_CLARA_TEXTS.opt_e2_text_en;
  if (inputOptE3En) inputOptE3En.value = data.opt_e3_text_en || DEFAULT_CLARA_TEXTS.opt_e3_text_en;

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
  // El saludo del simulador se genera una sola vez: regenerarlo con los textos recién cargados.
  resetChatDemo();
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
  if (cfgClaraText) cfgClaraText.textContent = isClaraOn ? "Clara: Visible en web + recordatorios" : "Clara: Oculta en web (sin recordatorios)";
  if (cfgClaraToggleBtn) cfgClaraToggleBtn.textContent = isClaraOn ? "Ocultar en web" : "Mostrar en web";

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
    opt_e_text: inputOptE?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_e_text,
    submenu_turnos_text: inputSubmenuTurnos?.value?.trim() || DEFAULT_CLARA_TEXTS.submenu_turnos_text,
    opt_a2_text: inputOptA2?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_a2_text,
    opt_e1_text: inputOptE1?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_e1_text,
    opt_e2_text: inputOptE2?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_e2_text,
    opt_e3_text: inputOptE3?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_e3_text,
    menu_welcome_en: inputMenuWelcomeEn?.value?.trim() || DEFAULT_CLARA_TEXTS.menu_welcome_en,
    opt_a_text_en: inputOptAEn?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_a_text_en,
    opt_b_text_en: inputOptBEn?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_b_text_en,
    opt_c_text_en: inputOptCEn?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_c_text_en,
    opt_d_text_en: inputOptDEn?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_d_text_en,
    opt_e_text_en: inputOptEEn?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_e_text_en,
    submenu_turnos_text_en: inputSubmenuTurnosEn?.value?.trim() || DEFAULT_CLARA_TEXTS.submenu_turnos_text_en,
    opt_a2_text_en: inputOptA2En?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_a2_text_en,
    opt_e1_text_en: inputOptE1En?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_e1_text_en,
    opt_e2_text_en: inputOptE2En?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_e2_text_en,
    opt_e3_text_en: inputOptE3En?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_e3_text_en,
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
      // Tras guardar, el simulador vuelve a empezar con los valores nuevos.
      resetChatDemo();
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

  // Al editar el menú de bienvenida, refrescar el simulador (con pausa para no reiniciarlo en cada tecla).
  let welcomeTimer = null;
  inputMenuWelcome?.addEventListener("input", () => {
    clearTimeout(welcomeTimer);
    welcomeTimer = setTimeout(() => resetChatDemo(), 400);
  });
}

// ----------------------------------------------------
// Vista previa y helpers de opt_c para el simulador / tests
export function previewOptCText(optC, fees) {
  return renderOptCText(optC, fees);
}

// Simulador de Chat con Clara (delegado a chat-simulator.js)
// ----------------------------------------------------
export { appendChatMessage, resetChatDemo, initChatSimulator } from "./chat-simulator.js?v=9";
