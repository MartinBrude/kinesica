/**
 * FAQs zero-friction del simulador — alineadas a kinesica-bot `04_menu_router.js`.
 */

const COVERAGE_RE = /\b(?:obras?\s+social(?:es)?|prepagas?|mutuales?|seguro\s+m[eé]dico|cartilla|reintegros?|facturas?|coberturas?|osde(?:\s*\d+)?|swiss(?:\s*medical)?|smg(?:\d+)?|galeno|medif[eé]|omint|sancor(?:\s*salud)?|accord(?:\s*salud)?|uni[oó]n\s+personal|prevenci[oó]n\s+salud|ioma|pami|osecac|ospe|osdepym|luis\s+pasteur|ospoce|dosuba|hospital\s+italiano|hospital\s+brit[aá]nico|hospital\s+alem[aá]n|health\s+insurance|insurance|coverage|reimbursement|out[-\s]of[-\s]network|invoice|receipt)\b/iu;

const THANKS_RE = /^(?:ok(?:a)?|dale|listo|joya|barbaro|de\s+diez|impecable|👍|🙏|❤|♥️)$/iu;
const THANKS_LONG_RE = /^(?:ok(?:a)?|dale|listo|bueno|joya|barbaro|de\s+diez|impecable|genial|perfecto|excelente|buen[ií]simo)?\s*(?:(?:muchas|mil|much[ií]simas)\s+)?(?:gra(?:ci|c|vi|v|xi|x)as+|thank\s*you|thanks)(?:\s+(?:a\s+vos|a\s+ustedes|igual|saludos|un\s+saludo|chicos|chicas|hasta\s+luego|nos\s+vemos|buenas?\s+tardes?|buen\s+d[ií]a|que\s+tengas?\s+buen\s+d[ií]a))?$/iu;

export function isCoverageQuery(norm) {
  return COVERAGE_RE.test(String(norm || ""));
}

export function isThanksMessage(norm) {
  const n = String(norm || "").trim();
  if (!n) return false;
  return THANKS_RE.test(n) || THANKS_LONG_RE.test(n);
}

export function getThanksText(lang = "es") {
  return lang === "en"
    ? "You're welcome! 🙌"
    : (Math.random() < 0.5 ? "A vos! 🙏" : "De nada!");
}

export function isClaraBotQuery(msg) {
  const normClean = String(msg || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:()«»""'']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /\b(?:(?:clara\s*,?\s*)?(?:es|sos|eres)\s+(?:un[ao]?\s+)?bot|sos\s+(?:un[ao]?\s+)?(?:bot|robot|ia|inteligencia\s+artificial)|es\s+(?:un[ao]?\s+)?(?:bot|robot|ia|inteligencia\s+artificial)|hablo\s+con\s+(?:un[ao]?\s+)?(?:bot|robot|ia|inteligencia\s+artificial)|are\s+you\s+(?:a\s+)?(?:bot|robot|ai)|is\s+clara\s+(?:a\s+)?(?:bot|robot|ai)|am\s+i\s+talking\s+to\s+a\s+(?:bot|robot|human|real\s+person)|quien\s+sos|quien\s+es\s+clara|que\s+es\s+clara)\b/iu.test(normClean);
}

export function getClaraBotText(lang = "es") {
  return lang === "en"
    ? "Hello! Yes, I'm Clara, Kinésica's virtual assistant 🤖🩺, and we're improving it little by little so you have the best experience with us.\n\nIf you prefer to speak directly with Norberto or María, reply *E* and we will connect you with a practitioner 🙌.\n\n_(Type *MENU* to see all options)_"
    : "¡Hola! Sí, soy Clara, el asistente virtual de Kinésica 🤖🩺, y la vamos mejorando poco a poco para que tengas la mejor experiencia con nosotros.\n\nSi preferís comunicarte directamente con Norberto o María, respondé con la letra *E* y te ponemos en contacto con un profesional 🙌.\n\n_(Escribí *MENU* para ver todas las opciones)_";
}

export function isMediosPagoQuery(msg) {
  const normMsg = String(msg || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (/\b(?:cuanto\s+(?:sale|cuesta|vale)|precios?|arancel(?:es)?|honorarios?|costos?|tarifas?|valor(?:es)?|how\s+much|prices?|fees?|costs?|rates?)\b/iu.test(normMsg)) {
    return false;
  }
  if (/\b(?:alias|cbu|cvu|cuenta\s+bancaria|datos\s+bancarios|a\s+qu[eé]\s+cuenta|para\s+transferir)\b/iu.test(normMsg)) {
    return false;
  }
  if (/\b(?:ya\s+(?:hice|pagu[eé]|transfer[ií]|abon[eé])|comprobante|constancia)\b/iu.test(normMsg)) {
    return false;
  }
  return /\b(?:medios?\s+de\s+pago|formas?\s+de\s+pago|como\s+(?:se\s+puede\s+|se\s+|puedo\s+)?(?:pagar\w*|paga\w*|abon\w*)|se\s+puede\s+(?:pagar|abonar)\s+(?:con|en)|con\s+qu[eé]\s+se\s+(?:paga|abona)|payment\s+methods?|how\s+to\s+pay|how\s+can\s+i\s+pay|do\s+you\s+accept\s+(?:cash|card|credit\s+card|transfer))\b/iu.test(normMsg);
}

export function getMediosPagoText(lang = "es", paymentMethods = "") {
  const payEs = String(paymentMethods || "efectivo o transferencia bancaria").toLowerCase();
  const payEn = (payEs.includes("efectivo") || payEs.includes("transferencia"))
    ? "cash or bank transfer"
    : (paymentMethods || "cash or bank transfer").toLowerCase();
  if (lang === "en") {
    return `💳 *Payment Methods at Kinésica*\n\nPayment can be made in ${payEn}.\n\nAt the end of your session, we issue an official invoice so you can submit it to your health insurance or medical plan for reimbursement 📄.\n\n_(Type *MENU* for more options)_`;
  }
  return `💳 *Medios de Pago en Kinésica*\n\nSe puede abonar en ${payEs}.\n\nAl finalizar tu sesión te entregamos la factura oficial para que puedas presentarla en tu obra social o prepaga y solicitar el reintegro correspondiente según tu plan 📄.\n\n_(Escribí *MENU* para más opciones)_`;
}

export function getSaludoBreveText(lang = "es") {
  return lang === "en"
    ? "Hello! How can we help you today? Type *MENU* to see all options again 🌿."
    : "¡Hola! ¿En qué te podemos ayudar? Escribí *MENU* si querés volver a ver las opciones 🌿.";
}

export function getMenuAntiSpamText(lang = "es") {
  return lang === "en"
    ? "We already sent you the options right above 👆. Please reply with the option letter (*A* for Appointments, *B* for Location, *C* for Fees, *D* for Attire, or *E* to speak with a practitioner) 🌿."
    : "Ya te enviamos el menú recién arriba 👆. Por favor respondé con la letra de tu consulta (*A* para Turnos, *B* para Ubicación, *C* para Honorarios, *D* para Indumentaria o *E* para hablar con un profesional) 🌿.";
}

/** Variantes de MENU / Menú / ver menú / start / reiniciar (alineado a kinesica-bot). */
const MENU_COMMAND_RE = /^(?:(?:\*|_)?menu(?:\*|_)?|el\s+menu|ver\s+menu|mostrar\s+menu|abrir\s+menu|volver\s+(?:al\s+)?menu|menu\s+principal|show\s+menu|main\s+menu|back\s+to\s+menu|start|reiniciar|inicio)$/i;

export function isMenuCommand(norm) {
  const cleaned = String(norm || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return MENU_COMMAND_RE.test(cleaned);
}

/**
 * Intentaron llamar / el número "no existe" → aclarar que es solo WhatsApp.
 * Requiere señal de intento telefónico + problema, o mención explícita de "solo WhatsApp".
 */
export function isWhatsAppOnlyLineFaq(msg) {
  const normClean = String(msg || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:()«»""'']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const phoneAttemptCue = /\b(?:telefon\w*|llamar\w*|llame|llamo|llamando|trate\s+de\s+comunicarme|comunicarme\s+por\s+telefono|trate\s+de\s+llamar|marque|marcar|marcando|called|calling|call\s+you|phone(?:\s+number)?|dial(?:ed|ling)?)\b/iu.test(normClean);
  const phoneProblemCue = /\b(?:no\s+existe|no\s+atienden|no\s+contesta(?:n)?|no\s+funciona|fuera\s+de\s+servicio|dice(?:n)?\s+que\s+no\s+existe|doesn'?t\s+exist|does\s+not\s+exist|not\s+in\s+service|out\s+of\s+service|no\s+answer|doesn'?t\s+answer|isn'?t\s+working|not\s+working)\b/iu.test(normClean);
  const notPhoneLineCue = /\b(?:no\s+es\s+(?:un\s+)?(?:telefono|linea(?:\s+telefonica)?)|not\s+(?:a\s+)?(?:phone|telephone)(?:\s+line)?|whatsapp\s+only|solo\s+(?:de\s+)?whatsapp)\b/iu.test(normClean);
  return (phoneAttemptCue && phoneProblemCue) || notPhoneLineCue;
}

export function getWhatsAppOnlyLineText(lang = "es") {
  return lang === "en"
    ? "This number is *WhatsApp only* (it is not a voice phone line). That is why dialing it may show that it does not exist. Just write here and I will help you 🙌."
    : "Este número es solo de *WhatsApp* (no es una línea telefónica para llamadas). Por eso al marcar puede figurar que no existe. Escribime por acá y te ayudo 🙌.";
}

/**
 * Parsea secuencias tipo ABC / A B C / A\\nB\\nC (2+ letras del menú, sin dígitos/DNI).
 * @param {string} raw
 * @param {Set<string>|string[]} validLetters
 * @returns {string[]|null}
 */
export function parseMenuLetterSequence(raw, validLetters) {
  const valid = validLetters instanceof Set
    ? validLetters
    : new Set(Array.from(validLetters || []).map((l) => String(l).toLowerCase()));
  const text = String(raw || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const cleaned = text.replace(/^[*_~"`'«»()\[\]{}]+|[*_~"`'«»()\[\]{}]+$/g, "").trim();
  if (!cleaned) return null;
  const digitsCompact = cleaned.replace(/[.\s-]/g, "");
  if (/^\d{6,9}$/.test(digitsCompact)) return null;
  if (/\d/.test(cleaned)) return null;

  let parts = null;
  if (/^[a-z]{2,5}$/i.test(cleaned)) {
    parts = cleaned.split("");
  } else if (/^[a-z](?:[\s,/|;]+[a-z]){1,4}$/i.test(cleaned)) {
    parts = cleaned.split(/[\s,/|;]+/).filter(Boolean);
    if (!parts.every((p) => /^[a-z]$/i.test(p))) return null;
  } else {
    return null;
  }

  const seen = new Set();
  const letters = [];
  for (const p of parts) {
    const L = p.toLowerCase();
    if (!valid.has(L) || seen.has(L)) continue;
    seen.add(L);
    letters.push(L);
    if (letters.length >= 5) break;
  }
  return letters.length >= 2 ? letters : null;
}

/** Primer texto libre no reconocido (menú reciente) vs 2º strike → derivación. */
export function resolveUnrecognizedReply(lang, { unrecCount, menuShownRecently }) {
  if (unrecCount >= 2) {
    return {
      kind: "second",
      text: lang === "en"
        ? "We've forwarded your message to Lic. Norberto Brude and Lic. María Gulin so they can assist you personally shortly 🙌.\n\n_(Type *MENU* to see options again)_"
        : "Disculpá la confusión. Ya le transmití tu consulta al Lic. Norberto Brude y a la Lic. María Gulin para que revisen tu mensaje y te respondan por acá a la brevedad 🙌.\n\n_(Escribí *MENU* si querés volver a ver las opciones)_",
      alert: true,
    };
  }
  if (menuShownRecently) {
    return {
      kind: "clarify",
      text: lang === "en"
        ? "Sorry, I didn't quite catch that. Please reply with the option letter (*A* for Appointments, *B* for Location, *C* for Fees, *D* for Attire, or *E* to speak with a practitioner) 🌿."
        : "Disculpá, no llegué a comprender tu mensaje. Por favor respondé con la letra de tu consulta (*A* para Turnos, *B* para Ubicación, *C* para Honorarios, *D* para Indumentaria o *E* para hablar con un profesional) 🌿.",
      alert: false,
    };
  }
  return { kind: "menu", text: null, alert: false };
}
