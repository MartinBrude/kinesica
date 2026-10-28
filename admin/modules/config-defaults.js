/**
 * Kinésica Admin - Textos por Defecto de Clara y Políticas
 * Plantillas predeterminadas de WhatsApp, menús bilingües y políticas de atención.
 */

import {
  DEFAULT_OPT_C_TEXT,
  DEFAULT_OPT_C_TEXT_EN,
} from "./menu-texts.js?v=2";

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

export function bindConfigInputs() {
  return {
    menuWelcome: document.querySelector("#cfg-menu-welcome"),
    optA: document.querySelector("#cfg-opt-a"),
    optB: document.querySelector("#cfg-opt-b"),
    optC: document.querySelector("#cfg-opt-c"),
    optD: document.querySelector("#cfg-opt-d"),
    optE: document.querySelector("#cfg-opt-e"),
    submenuTurnos: document.querySelector("#cfg-submenu-turnos"),
    optA2: document.querySelector("#cfg-opt-a2"),
    optE1: document.querySelector("#cfg-opt-e1"),
    optE2: document.querySelector("#cfg-opt-e2"),
    optE3: document.querySelector("#cfg-opt-e3"),
    menuWelcomeEn: document.querySelector("#cfg-menu-welcome-en"),
    optAEn: document.querySelector("#cfg-opt-a-en"),
    optBEn: document.querySelector("#cfg-opt-b-en"),
    optCEn: document.querySelector("#cfg-opt-c-en"),
    optDEn: document.querySelector("#cfg-opt-d-en"),
    optEEn: document.querySelector("#cfg-opt-e-en"),
    submenuTurnosEn: document.querySelector("#cfg-submenu-turnos-en"),
    optA2En: document.querySelector("#cfg-opt-a2-en"),
    optE1En: document.querySelector("#cfg-opt-e1-en"),
    optE2En: document.querySelector("#cfg-opt-e2-en"),
    optE3En: document.querySelector("#cfg-opt-e3-en"),
  };
}

export function populateClaraInputs(inputs, data, defaults) {
  const map = {
    menuWelcome: "menu_welcome",
    optA: "opt_a_text",
    optB: "opt_b_text",
    optC: "opt_c_text",
    optD: "opt_d_text",
    optE: "opt_e_text",
    submenuTurnos: "submenu_turnos_text",
    optA2: "opt_a2_text",
    optE1: "opt_e1_text",
    optE2: "opt_e2_text",
    optE3: "opt_e3_text",
    menuWelcomeEn: "menu_welcome_en",
    optAEn: "opt_a_text_en",
    optBEn: "opt_b_text_en",
    optCEn: "opt_c_text_en",
    optDEn: "opt_d_text_en",
    optEEn: "opt_e_text_en",
    submenuTurnosEn: "submenu_turnos_text_en",
    optA2En: "opt_a2_text_en",
    optE1En: "opt_e1_text_en",
    optE2En: "opt_e2_text_en",
    optE3En: "opt_e3_text_en",
  };
  for (const [prop, key] of Object.entries(map)) {
    if (inputs[prop]) inputs[prop].value = data[key] || defaults[key] || "";
  }
}
