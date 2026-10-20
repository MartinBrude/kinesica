/**
 * Kinésica Admin - Módulo de Configuración Unificada
 * Integra en un único centro de control:
 * 1. Mensajes de Clara en WhatsApp (Menú A-E y opciones)
 * 2. Mails y Políticas (Políticas de cancelación 24hs y notas)
 * 3. Horarios de Atención por profesional
 * 4. Honorarios y Medios de Pago
 */

import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";
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

// Opciones personalizadas del menú
const customOptionsContainer = document.querySelector("#custom-options-container");
const customOptionsEmpty = document.querySelector("#custom-options-empty");
const btnAddCustomOption = document.querySelector("#btn-add-custom-option");
let customMenuOptions = [];

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
  menu_welcome: `¡Hola! Te damos la bienvenida a *Kinésica* 🩺

Por favor, respondé con la letra de la opción que necesitás:

*A.* 📅 Turnos (agendar, consultar o cancelar)
*B.* 📍 Ubicación y horarios del consultorio
*C.* 💳 Honorarios y cobertura (obras sociales / reintegros)
*D.* 👕 ¿Cómo venir vestido/a a la sesión?
*E.* 💬 Comunicarte con un profesional (Lic. Norberto Brude / Lic. María Gulín)

_(Escribí la letra de la opción deseada, por ejemplo *A* o *C*)_`,
  opt_a_text: `📅 *Turnos y Reservas - Kinésica*

Para ver los días y horarios disponibles en tiempo real con Norberto o María y agendar tu sesión de 60 minutos, ingresá a nuestra turnera online:

👉 *https://kinesica.com.ar/agendar*`,
  opt_b_text: `📍 *Kinésica Consultorio*
• *Ubicación:* Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz, a metros de Av. Santa Fe y estación Scalabrini Ortiz del Subte D).
• *Google Maps:* https://maps.google.com/?q=Charcas+3889+Palermo+CABA`,
  opt_d_text: `👕 *Indumentaria para la sesión:*
• Ropa interior o pantalón corto para los varones.
• Ropa interior con corpiño tradicional (no deportivo), malla de 2 piezas o calza corta para las mujeres.
Si sos menor, vení acompañado/a por un mayor 🙌.`,
  cancellation_policy: `Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación para permitir que otro paciente utilice la camilla 🙌.`,
  confirmation_notes: `Por favor asistir con puntualidad exacta al horario asignado. El consultorio cuenta con una única camilla y no dispone de sala de espera 📍.`
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
  if (inputOptD) inputOptD.value = data.opt_d_text || DEFAULT_CLARA_TEXTS.opt_d_text;
  if (inputCancellation) inputCancellation.value = data.cancellation_policy || DEFAULT_CLARA_TEXTS.cancellation_policy;
  if (inputConfirmation) inputConfirmation.value = data.confirmation_notes || DEFAULT_CLARA_TEXTS.confirmation_notes;

  if (Array.isArray(data.custom_menu_options)) {
    customMenuOptions = JSON.parse(JSON.stringify(data.custom_menu_options));
  } else if (Array.isArray(data.clara_texts?.custom_menu_options)) {
    customMenuOptions = JSON.parse(JSON.stringify(data.clara_texts.custom_menu_options));
  } else {
    customMenuOptions = [];
  }
  renderCustomOptionsList();

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

  // Guardar Textos de Clara & Políticas
  btnSaveTexts?.addEventListener("click", async () => {
    btnSaveTexts.disabled = true;
    btnSaveTexts.textContent = "Guardando...";

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
        btnSaveTexts.disabled = false;
        btnSaveTexts.textContent = "Guardar textos y políticas";
        return;
      }
      if (reserved.includes(l)) {
        dialogAlert(`La letra ${l} está reservada para las opciones nativas de Clara. Por favor usá letras de la F en adelante.`);
        btnSaveTexts.disabled = false;
        btnSaveTexts.textContent = "Guardar textos y políticas";
        return;
      }
      if (!response) {
        dialogAlert(`Por favor ingresá la respuesta para la opción ${l}.`);
        btnSaveTexts.disabled = false;
        btnSaveTexts.textContent = "Guardar textos y políticas";
        return;
      }
      cleanCustom.push({ letter: l, label: label || `Opción ${l}`, response });
    }

    const payload = {
      clara_texts: {
        menu_welcome: inputMenuWelcome?.value?.trim() || DEFAULT_CLARA_TEXTS.menu_welcome,
        opt_a_text: inputOptA?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_a_text,
        opt_b_text: inputOptB?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_b_text,
        opt_d_text: inputOptD?.value?.trim() || DEFAULT_CLARA_TEXTS.opt_d_text,
        cancellation_policy: inputCancellation?.value?.trim() || DEFAULT_CLARA_TEXTS.cancellation_policy,
        confirmation_notes: inputConfirmation?.value?.trim() || DEFAULT_CLARA_TEXTS.confirmation_notes,
        custom_menu_options: cleanCustom
      },
      custom_menu_options: cleanCustom
    };

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
      }
      if (textsStatusBanner) {
        textsStatusBanner.textContent = "✓ Textos y opciones del menú guardados con éxito.";
        textsStatusBanner.className = "horarios-alert-box is-success";
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
  btnResetTexts?.addEventListener("click", async () => {
    const ok = await dialogConfirm("¿Deseas restaurar los mensajes y políticas predeterminados de Kinésica?", {
      okText: "Restaurar",
      cancelText: "Cancelar",
    });
    if (ok) {
      customMenuOptions = [];
      renderTexts(DEFAULT_CLARA_TEXTS);
      await dialogAlert("Se restauraron los textos predeterminados. Presioná 'Guardar textos y políticas' para confirmar.");
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
  let welcome = inputMenuWelcome?.value?.trim() || currentTexts.menu_welcome || DEFAULT_CLARA_TEXTS.menu_welcome;
  if (customMenuOptions && customMenuOptions.length > 0) {
    const extraLines = customMenuOptions
      .filter((o) => o.letter && o.label)
      .map((o) => `*${o.letter.toUpperCase()}.* ${o.label}`)
      .join("\n");
    if (extraLines && !welcome.toUpperCase().includes(`*${customMenuOptions[0].letter.toUpperCase()}.*`)) {
      if (welcome.includes("\n\n_(")) {
        welcome = welcome.replace("\n\n_(", `\n${extraLines}\n\n_(`);
      } else {
        welcome += `\n${extraLines}`;
      }
    }
  }
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

  // Buscar coincidencia en opciones personalizadas
  const matchedCustom = customMenuOptions.find((o) => {
    const l = String(o.letter || "").toLowerCase();
    return l && (norm === l || norm === `opcion ${l}` || norm.startsWith(`${l}.`) || norm.startsWith(`${l} -`));
  });
  if (matchedCustom) {
    chatSubmenu = null;
    const resp = matchedCustom.response || "Información no disponible.";
    setTimeout(() => {
      appendChatMessage(`${resp}\n\n_(Escribí *MENU* para volver a ver las opciones)_`, "bot");
    }, 450);
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
    appendChatMessage("Disculpame, no llegué a comprender esa opción. Por favor ingresá una de las letras del menú o escribí *MENU* 🙌.", "bot");
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
