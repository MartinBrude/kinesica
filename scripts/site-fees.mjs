/**
 * Honorarios públicos — lee `admin/api/settings.json` (valores configurados)
 * con fallback a los mismos defaults del booking/admin.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SETTINGS_PATH = join(ROOT, "admin/api/settings.json");

/** @type {{ atm: number, general: number, payment_methods: string }} */
export const DEFAULT_FEES = {
  atm: 65000,
  general: 75000,
  payment_methods: "Efectivo o transferencia bancaria",
};

/**
 * @returns {{ atm: number, general: number, payment_methods: string }}
 */
export function getSiteFees() {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
    const fees = raw?.fees && typeof raw.fees === "object" ? raw.fees : {};
    const atm = Number(fees.atm);
    const general = Number(fees.general);
    const payment =
      typeof fees.payment_methods === "string" && fees.payment_methods.trim()
        ? fees.payment_methods.trim()
        : DEFAULT_FEES.payment_methods;
    return {
      atm: Number.isFinite(atm) && atm > 0 ? atm : DEFAULT_FEES.atm,
      general: Number.isFinite(general) && general > 0 ? general : DEFAULT_FEES.general,
      payment_methods: payment,
    };
  } catch {
    return { ...DEFAULT_FEES };
  }
}

/**
 * @param {number} amount
 * @param {"es"|"en"|"fr"|"pt"} lang
 */
export function formatFeeAmount(amount, lang) {
  const n = Number(amount || 0);
  const formatted = n.toLocaleString("es-AR");
  if (lang === "en") return `ARS ${formatted}`;
  return `$${formatted}`;
}

/**
 * Localized payment methods line for FAQ / public copy.
 * @param {string} paymentMethods
 * @param {"es"|"en"|"fr"|"pt"} lang
 */
export function formatPaymentMethods(paymentMethods, lang) {
  const raw = String(paymentMethods || DEFAULT_FEES.payment_methods).toLowerCase();
  const isCashTransfer =
    raw.includes("efectivo") ||
    raw.includes("transferencia") ||
    raw.includes("cash") ||
    raw.includes("transfer");
  if (lang === "en") {
    return isCashTransfer ? "cash or bank transfer" : String(paymentMethods).toLowerCase();
  }
  if (lang === "fr") {
    return isCashTransfer ? "espèces ou virement bancaire" : String(paymentMethods).toLowerCase();
  }
  if (lang === "pt") {
    return isCashTransfer ? "dinheiro ou transferência bancária" : String(paymentMethods).toLowerCase();
  }
  return isCashTransfer
    ? "efectivo o transferencia bancaria"
    : String(paymentMethods).toLowerCase();
}
