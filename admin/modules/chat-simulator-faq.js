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
    ? "You're welcome! Have a great day 🙌.\n\n_(Type *MENU* if you need anything else)_"
    : "¡De nada! Que tengas un excelente día 🙌.\n\n_(Si necesitás algo más, escribí *MENU*)_";
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
