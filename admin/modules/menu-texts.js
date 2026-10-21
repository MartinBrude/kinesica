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
