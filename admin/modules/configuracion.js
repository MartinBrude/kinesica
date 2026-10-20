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
import { loadHorariosFromServer } from "./horarios.js?v=1";
import { loadHonorarios } from "./honorarios.js?v=1";

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
  menu_welcome: "¡Hola! Te damos la bienvenida a *Kinésica* 🩺

Por favor, respondé con la letra de la opción que necesitás:

*A.* 📅 Turnos (agendar, consultar o cancelar)
*B.* 📍 Ubicación y horarios del consultorio
*C.* 💳 Honorarios y cobertura (obras sociales / reintegros)
*D.* 👕 ¿Cómo venir vestido/a a la sesión?
*E.* 💬 Comunicarte con un profesional (Lic. Norberto Brude / Lic. María Gulín)

_(Escribí la letra de la opción deseada, por ejemplo *A* o *C*)_",
  opt_a_text: "📅 *Turnos y Reservas - Kinésica*

Para ver los días y horarios disponibles en tiempo real con Norberto o María y agendar tu sesión de 60 minutos, ingresá a nuestra turnera online:

👉 *https://kinesica.com.ar/agendar*",
  opt_b_text: "📍 *Kinésica Consultorio*
• *Ubicación:* Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz, a metros de Av. Santa Fe y estación Scalabrini Ortiz del Subte D).
• *Google Maps:* https://maps.google.com/?q=Charcas+3889+Palermo+CABA",
  opt_d_text: "👕 *Indumentaria para la sesión:*
• Ropa interior o pantalón corto para los varones.
• Ropa interior con corpiño tradicional (no deportivo), malla de 2 piezas o calza corta para las mujeres.
Si sos menor, vení acompañado/a por un mayor 🙌.",
  cancellation_policy: "Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación para permitir que otro paciente utilice la camilla 🙌.",
  confirmation_notes: "Por favor asistir con puntualidad exacta al horario asignado. El consultorio cuenta con una única camilla y no dispone de sala de espera 📍."
};

let currentTexts = { ...DEFAULT_CLARA_TEXTS };
let activeClara = false;
let activeBooking = false;

export function showConfiguracionView(subtab = "clara") {
  if (viewConfiguracion) {
    viewConfiguracion.hidden = false;
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
      if (subtabId === "horarios") {
        loadHorariosFromServer();
      } else if (subtabId === "honorarios") {
        loadHonorarios();
      } else if (subtabId === "chat" && chatMessagesEl && chatMessagesEl.children.length === 0) {
        resetChatDemo();
      }
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

  initChatSimulator();
}

// ----------------------------------------------------
// Simulador de Chat con Clara (WhatsApp Experience)
// ----------------------------------------------------
const chatMessagesEl = document.querySelector("#chat-demo-messages");
const chatFormEl = document.querySelector("#chat-demo-form");
const chatInputEl = document.querySelector("#chat-demo-input");
const chatQuickBtns = document.querySelectorAll(".chat-quick-btn");

let chatSubmenu = null; // 'turnos', 'profesional', etc.

function getNowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatWhatsAppMarkdown(rawText) {
  if (!rawText) return "";
  const escaped = escapeHtml(rawText);
  // Negrita: *texto* -> <strong>texto</strong>
  let formatted = escaped.replace(/\*([^*\n\r]+)\*/g, "<strong>$1</strong>");
  // Cursiva: _texto_ -> <em>texto</em>
  formatted = formatted.replace(/_([^_\n\r]+)_/g, "<em>$1</em>");
  // Enlaces http/https automáticos
  formatted = formatted.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#027eb5; text-decoration:underline;">$1</a>'
  );
  return formatted;
}

export function appendChatMessage(text, sender = "bot") {
  if (!chatMessagesEl) return;
  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg ${sender}`;
  
  const textNode = document.createElement("div");
  if (sender === "bot") {
    textNode.innerHTML = formatWhatsAppMarkdown(text);
  } else {
    textNode.textContent = text;
  }
  msgEl.appendChild(textNode);

  const timeNode = document.createElement("span");
  timeNode.className = "chat-msg-time";
  timeNode.textContent = getNowTimeStr();
  msgEl.appendChild(timeNode);

  chatMessagesEl.appendChild(msgEl);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

export function resetChatDemo() {
  if (!chatMessagesEl) return;
  chatMessagesEl.replaceChildren();
  chatSubmenu = null;
  const welcome = inputMenuWelcome?.value?.trim() || currentTexts.menu_welcome || DEFAULT_CLARA_TEXTS.menu_welcome;
  appendChatMessage(welcome, "bot");
}

function handleChatUserInput(inputRaw) {
  const input = (inputRaw || "").trim();
  if (!input) return;

  appendChatMessage(input, "user");

  const norm = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Reset / Menu
  if (norm === "menu" || norm === "reiniciar" || norm === "hola" || norm === "buenas") {
    setTimeout(() => {
      resetChatDemo();
    }, 400);
    return;
  }

  // Si está en submenú Turnos
  if (chatSubmenu === "turnos") {
    if (norm === "1") {
      chatSubmenu = null;
      const optA = inputOptA?.value?.trim() || currentTexts.opt_a_text || DEFAULT_CLARA_TEXTS.opt_a_text;
      setTimeout(() => {
        appendChatMessage(optA, "bot");
      }, 500);
      return;
    }
    if (norm === "2") {
      chatSubmenu = null;
      setTimeout(() => {
        appendChatMessage("📋 Consultando tus turnos agendados en Google Calendar...\n\nNo tenés turnos activos registrados en este momento para este número.\n\nEscribí *MENU* para volver al inicio.", "bot");
      }, 600);
      return;
    }
  }

  // Si está en submenú Profesional
  if (chatSubmenu === "profesional") {
    let proName = "nuestro equipo de kinesiólogos";
    if (norm === "1") proName = "Lic. Norberto Brude";
    if (norm === "2") proName = "Lic. María Gulin";
    chatSubmenu = null;
    setTimeout(() => {
      appendChatMessage(`¡Perfecto! Ya le transmitimos tu consulta a ${proName}. Te estará contactando a la brevedad directamente por WhatsApp 🙌.\n\nEscribí *MENU* para volver a ver las opciones.`, "bot");
    }, 500);
    return;
  }

  // Opciones A a E
  if (norm === "a" || norm.startsWith("opcion a")) {
    chatSubmenu = "turnos";
    setTimeout(() => {
      appendChatMessage("📅 *Gestión de Turnos - Kinésica*\n\nPor favor elegí una opción respondiendo *1* o *2*:\n\n*1.* 📅 Agendar un nuevo turno (enlace web)\n*2.* 📋 Consultar o cancelar mis turnos actuales\n\n_(Respondé *1* o *2*, o escribí *MENU* para volver al menú principal)_", "bot");
    }, 450);
    return;
  }

  if (norm === "b" || norm.startsWith("opcion b") || norm.includes("donde queda") || norm.includes("ubicacion")) {
    chatSubmenu = null;
    const optB = inputOptB?.value?.trim() || currentTexts.opt_b_text || DEFAULT_CLARA_TEXTS.opt_b_text;
    setTimeout(() => {
      appendChatMessage(optB, "bot");
    }, 450);
    return;
  }

  if (norm === "c" || norm.startsWith("opcion c") || norm.includes("honorarios") || norm.includes("precio") || norm.includes("cuanto sale")) {
    chatSubmenu = null;
    const atmVal = parseInt(document.querySelector("#input-fee-atm")?.value, 10) || 65000;
    const genVal = parseInt(document.querySelector("#input-fee-general")?.value, 10) || 75000;
    const payVal = document.querySelector("#input-fee-payment-methods")?.value?.trim() || "Efectivo o transferencia bancaria";
    const atmStr = `$${atmVal.toLocaleString("es-AR")}`;
    const genStr = `$${genVal.toLocaleString("es-AR")}`;

    const feeMsg = `💳 *Honorarios y Cobertura*\n• *Consulta y Sesión ATM:* ${atmStr}\n• *Kinesiología General / RPG / Osteopatía:* ${genStr}\n• *Formas de pago:* ${payVal}\n\nAtendemos de forma particular y emitimos factura oficial para reintegro con tu obra social o prepaga.\n\nEscribí *MENU* para volver al menú principal.`;
    setTimeout(() => {
      appendChatMessage(feeMsg, "bot");
    }, 450);
    return;
  }

  if (norm === "d" || norm.startsWith("opcion d") || norm.includes("ropa") || norm.includes("vestimenta")) {
    chatSubmenu = null;
    const optD = inputOptD?.value?.trim() || currentTexts.opt_d_text || DEFAULT_CLARA_TEXTS.opt_d_text;
    setTimeout(() => {
      appendChatMessage(optD, "bot");
    }, 450);
    return;
  }

  if (norm === "e" || norm.startsWith("opcion e") || norm.includes("profesional") || norm.includes("hablar")) {
    chatSubmenu = "profesional";
    setTimeout(() => {
      appendChatMessage("💬 *Contacto con un Profesional*\n\n¿Con quién te gustaría comunicarte?\n*1.* Lic. Norberto Brude\n*2.* Lic. María Gulin\n*3.* Indistinto / Primera consulta general\n\n_(Respondé *1*, *2* o *3*, o escribí tu consulta directamente y se la transmitimos)_", "bot");
    }, 450);
    return;
  }

  // Respuesta por defecto con el menú
  setTimeout(() => {
    appendChatMessage("Disculpame, no llegué a comprender esa opción. Por favor ingresá una de las letras del menú (A, B, C, D o E) o escribí *MENU* 🙌.", "bot");
  }, 500);
}

export function initChatSimulator() {
  chatFormEl?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = chatInputEl?.value?.trim();
    if (!val) return;
    chatInputEl.value = "";
    handleChatUserInput(val);
  });

  chatQuickBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.chatAct;
      if (act) {
        handleChatUserInput(act);
      }
    });
  });
}
