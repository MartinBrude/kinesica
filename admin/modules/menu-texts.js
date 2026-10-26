// Textos del menú sin IA que dependen de otros datos del admin (honorarios).
// Módulo puro (sin DOM): lo usan configuracion.js (vista previa) y scripts/verify-admin-menu-texts.mjs.

export const FEE_PLACEHOLDERS = ["{honorario_atm}", "{honorario_general}", "{medios_pago}"];

// Mismo texto por defecto que DEFAULT_OPT_C_TEXT en el nodo "Filter & Parse Message" de kinesica-bot/workflow_live.json.
export const DEFAULT_OPT_C_TEXT = `💳 *Honorarios y Cobertura*
• *Honorarios:* {honorario_atm} para ATM (bruxismo / dolor mandibular) y {honorario_general} para el resto de las consultas (kinesiología general, osteopatía, RPG, etc.). Las sesiones son individuales y de 60 minutos.
• *Medios de pago:* Se puede abonar en {medios_pago}.
• *Cobertura:* Atendemos de forma particular. Al finalizar tu sesión te entregamos la factura oficial para que puedas presentarla en tu prepaga u obra social y solicitar el reintegro correspondiente según tu plan 📄.`;

/** Reemplaza los placeholders de honorarios igual que el workflow de n8n. */
export function renderOptCText(template, fees = {}) {
  const text = typeof template === "string" && template.trim() ? template.trim() : DEFAULT_OPT_C_TEXT;
  const atm = `$${Number(fees.atm || 65000).toLocaleString("es-AR")}`;
  const general = `$${Number(fees.general || 75000).toLocaleString("es-AR")}`;
  const pay = String(fees.payment_methods || "efectivo o por transferencia").toLowerCase();
  return text
    .replace(/\{honorario_atm\}/g, atm)
    .replace(/\{honorario_general\}/g, general)
    .replace(/\{medios_pago\}/g, pay);
}

export const DEFAULT_OPT_C_TEXT_EN = `💳 *Fees and Coverage*
• *Fees:* {honorario_atm} for TMJ / ATM (bruxism / jaw pain) and {honorario_general} for all other consultations (general physiotherapy, osteopathy, postural reeducation / RPG, etc.). Sessions are 60 minutes, one-on-one.
• *Payment methods:* Payment can be made in {medios_pago}.
• *Coverage:* We operate as a private practice (out-of-network). At the end of your session, we issue an official invoice so you can submit it to your health insurance or medical plan for reimbursement 📄.`;

export function renderOptCTextEn(template, fees = {}) {
  const text = typeof template === "string" && template.trim() ? template.trim() : DEFAULT_OPT_C_TEXT_EN;
  const atm = `$${Number(fees.atm || 65000).toLocaleString("es-AR")}`;
  const general = `$${Number(fees.general || 75000).toLocaleString("es-AR")}`;
  const rawPay = String(fees.payment_methods || "").toLowerCase();
  const pay = (rawPay.includes("efectivo") || rawPay.includes("transferencia")) ? "cash or bank transfer" : (fees.payment_methods || "cash or bank transfer").toLowerCase();
  return text
    .replace(/\{honorario_atm\}/g, atm)
    .replace(/\{honorario_general\}/g, general)
    .replace(/\{medios_pago\}/g, pay);
}

// Recordatorio de 24 h: lo envía n8n ("Kinesica - Recordatorios 24h" → "Send WhatsApp Reminder") con la plantilla
// de Meta recordatorio_turno_kinesica. Variables de la plantilla: {{1}} nombre de pila, {{2}} "sesión en el
// consultorio" (fijo), {{3}} hora, {{4}} indicaciones (editables en el admin). El texto no se edita desde aquí.
export const REMINDER_TEMPLATE_NAME = "recordatorio_turno_kinesica";
export const REMINDER_TIPO_CITA = "sesión en el consultorio";
export const REMINDER_TEMPLATE_TEXT = `¡Hola {nombre}! 🌿 Te escribo desde Kinésica para recordarte tu ${REMINDER_TIPO_CITA} programada para mañana a las {horario}.

{indicaciones}

Por favor confirmá tu asistencia seleccionando una de las opciones a continuación 🙌:`;

/** Vista previa fiel a lo que se envía: sólo cambian nombre, hora e indicaciones. */
export function renderReminderPreview(indicaciones, { nombre = "Lucas", horario = "16:00 hs" } = {}) {
  return REMINDER_TEMPLATE_TEXT
    .replace("{nombre}", nombre)
    .replace("{horario}", horario)
    .replace("{indicaciones}", String(indicaciones || "").trim());
}
