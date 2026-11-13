/**
 * Kinésica Admin - Formato Unificado de Teléfonos (fachada).
 */

export {
  cleanPhoneDigits,
  isNonArInternationalPhone,
  normalizePhoneForWhatsApp,
  formatDisplayPhone,
} from "./phone-format-core.js?v=1";

export { extractPhoneCandidate } from "./phone-format-extract.js?v=1";
