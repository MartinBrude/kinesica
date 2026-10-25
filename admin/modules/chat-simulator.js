/**
 * Kinésica Admin - Simulador Interactivo de WhatsApp de Clara
 * ============================================================
 * Experiencia interactiva para probar el flujo de respuestas automáticas
 * a las opciones A-E, submenús y opciones personalizadas.
 */

import { renderOptCText } from "./menu-texts.js?v=2";
import { escapeHtml } from "./dom.js?v=78";

/**
 * Contexto inyectado por configuracion.js (evita import circular y estado duplicado).
 * getTexts / getCustomOptions se evalúan en cada uso para leer siempre el estado vigente.
 */
let ctx = {
  defaults: {},
  inputs: {},
  getTexts: () => ({}),
  getCustomOptions: () => [],
};

export function setChatContext(next) {
  ctx = { ...ctx, ...next };
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

// Pie "volver al menú": solo se agrega si el texto no menciona ya MENU/menú (igual que el bot real).
function withMenuFooter(text) {
  const body = String(text || "").trim();
  if (!body) return body;
  const plain = body.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/menu/i.test(plain)) return body;
  return `${body}\n\n_(Escribí *MENU* para volver a ver las opciones)_`;
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
  let welcome = ctx.inputs.menuWelcome?.value?.trim() || ctx.getTexts().menu_welcome || ctx.defaults.menu_welcome;
  if (ctx.getCustomOptions() && ctx.getCustomOptions().length > 0) {
    const extraLines = ctx.getCustomOptions()
      .filter((o) => o.letter && o.label)
      .map((o) => `*${o.letter.toUpperCase()}.* ${o.label}`)
      .join("\n");
    if (extraLines && !welcome.toUpperCase().includes(`*${ctx.getCustomOptions()[0].letter.toUpperCase()}.*`)) {
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
  const matchedCustom = ctx.getCustomOptions().find((o) => {
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
      const optA = ctx.inputs.optA?.value?.trim() || ctx.getTexts().opt_a_text || ctx.defaults.opt_a_text;
      setTimeout(() => {
        appendChatMessage(optA, "bot");
      }, 500);
      return;
    }
    if (norm === "2") {
      chatSubmenu = "buscar_dni";
      const optA2 = ctx.inputs.optA2?.value?.trim() || ctx.getTexts().opt_a2_text || ctx.defaults.opt_a2_text ||
        "Con este número de WhatsApp no encontramos turnos agendados. Si agendaste con otro teléfono, respondé directamente con tu *DNI o Pasaporte* y lo buscamos.\n\n_(Escribí *MENU* para volver)_";
      setTimeout(() => {
        appendChatMessage(optA2, "bot");
      }, 600);
      return;
    }
  }

  // Si está en espera de búsqueda por DNI o Documento
  if (chatSubmenu === "buscar_dni") {
    const docMatch = norm.match(/^(?:dni|documento|pasaporte|doc)?\s*([0-9a-zA-Z.\s-]{6,15})$/i);
    const cleanDoc = docMatch ? docMatch[1].replace(/[.\s-]/g, "").toUpperCase() : "";
    chatSubmenu = null;
    setTimeout(() => {
      // Al ser un simulador offline/estático sin acceso directo a la agenda de Google Calendar,
      // no inventamos turnos para cualquier DNI que ingrese el usuario.
      appendChatMessage(`No encontramos turnos agendados asociados al documento *${cleanDoc || input}*.\n\n_(Escribí *MENU* para volver al inicio)_`, "bot");
    }, 600);
    return;
  }

  // Si está en submenú Profesional (mismas respuestas que el bot real)
  if (chatSubmenu === "profesional") {
    let proMsg = ctx.inputs.optE3?.value?.trim() || ctx.getTexts().opt_e3_text || ctx.defaults.opt_e3_text ||
      "¡Perfecto! Ya le transmitimos tu consulta a nuestro equipo. Te estarán contactando a la brevedad directamente por WhatsApp 🙌.\n\n_(Escribí *MENU* si deseás ver otras opciones)_";
    if (norm === "1" || norm === "norberto") {
      proMsg = ctx.inputs.optE1?.value?.trim() || ctx.getTexts().opt_e1_text || ctx.defaults.opt_e1_text ||
        "¡Perfecto! Ya le transmitimos tu consulta al Lic. Norberto Brude. Te estará contactando a la brevedad directamente por WhatsApp 🙌.\n\n_(Escribí *MENU* si deseás ver otras opciones)_";
    } else if (norm === "2" || /^mar[ií]a$/.test(norm)) {
      proMsg = ctx.inputs.optE2?.value?.trim() || ctx.getTexts().opt_e2_text || ctx.defaults.opt_e2_text ||
        "¡Perfecto! Ya le transmitimos tu consulta a la Lic. María Gulin. Te estará contactando a la brevedad directamente por WhatsApp 🙌.\n\n_(Escribí *MENU* si deseás ver otras opciones)_";
    } else if (norm === "3" || norm === "indistinto" || norm === "primera consulta") {
      proMsg = ctx.inputs.optE3?.value?.trim() || ctx.getTexts().opt_e3_text || ctx.defaults.opt_e3_text ||
        "¡Perfecto! Ya le transmitimos tu consulta a nuestro equipo de kinesiólogos. Te estarán contactando a la brevedad directamente por WhatsApp 🙌.\n\n_(Escribí *MENU* si deseás ver otras opciones)_";
    }
    chatSubmenu = null;
    setTimeout(() => {
      appendChatMessage(proMsg, "bot");
    }, 500);
    return;
  }

  // Opciones A a E
  if (norm === "a" || norm.startsWith("opcion a")) {
    chatSubmenu = "turnos";
    const subTurnosMsg = ctx.inputs.submenuTurnos?.value?.trim() || ctx.getTexts().submenu_turnos_text || ctx.defaults.submenu_turnos_text ||
      "📅 *Gestión de Turnos - Kinésica*\n\nPor favor elegí una opción respondiendo *1* o *2*:\n\n*1.* 📅 Agendar un nuevo turno\n*2.* 📋 Consultar o cancelar mis turnos\n\n_(Respondé *1* o *2*, o escribí *MENU* para volver al menú principal)_";
    setTimeout(() => {
      appendChatMessage(subTurnosMsg, "bot");
    }, 450);
    return;
  }

  if (norm === "b" || norm.startsWith("opcion b") || norm.includes("donde queda") || norm.includes("ubicacion")) {
    chatSubmenu = null;
    const optB = ctx.inputs.optB?.value?.trim() || ctx.getTexts().opt_b_text || ctx.defaults.opt_b_text;
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
    const optC = ctx.inputs.optC?.value?.trim() || ctx.getTexts().opt_c_text || ctx.defaults.opt_c_text;
    const feeMsg = renderOptCText(optC, { atm: atmVal, general: genVal, payment_methods: payVal });
    setTimeout(() => {
      appendChatMessage(feeMsg, "bot");
    }, 450);
    return;
  }

  if (norm === "d" || norm.startsWith("opcion d") || norm.includes("ropa") || norm.includes("vestimenta")) {
    chatSubmenu = null;
    const optD = ctx.inputs.optD?.value?.trim() || ctx.getTexts().opt_d_text || ctx.defaults.opt_d_text;
    setTimeout(() => {
      appendChatMessage(withMenuFooter(optD), "bot");
    }, 450);
    return;
  }

  if (norm === "e" || norm.startsWith("opcion e") || norm.includes("profesional") || norm.includes("hablar")) {
    chatSubmenu = "profesional";
    const optE = ctx.inputs.optE?.value?.trim() || ctx.getTexts().opt_e_text || ctx.defaults.opt_e_text ||
      "💬 *Contacto con un Profesional*\n\n¿Con quién te gustaría comunicarte?\n*1.* Lic. Norberto Brude\n*2.* Lic. María Gulin\n*3.* Indistinto / Primera consulta general\n\n_(Respondé *1*, *2* o *3*, o escribí tu consulta directamente y se la transmitimos)_\n_Escribí *MENU* para volver_";
    setTimeout(() => {
      appendChatMessage(optE, "bot");
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
