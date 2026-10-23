/**
 * Kinésica Admin - Simulador Interactivo de WhatsApp de Clara
 * ============================================================
 * Experiencia interactiva para probar el flujo de respuestas automáticas
 * a las opciones A-E, submenús y opciones personalizadas.
 */

import { renderOptCText } from "./menu-texts.js?v=2";
import { escapeHtml } from "./dom.js?v=78";
import { DEFAULT_CLARA_TEXTS } from "./configuracion.js?v=18";

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
    chatSubmenu = null;
    const optA = inputOptA?.value?.trim() || currentTexts.opt_a_text || DEFAULT_CLARA_TEXTS.opt_a_text;
    setTimeout(() => {
      appendChatMessage(optA, "bot");
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
    const optC = inputOptC?.value?.trim() || currentTexts.opt_c_text || DEFAULT_CLARA_TEXTS.opt_c_text;
    const feeMsg = renderOptCText(optC, { atm: atmVal, general: genVal, payment_methods: payVal });
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
