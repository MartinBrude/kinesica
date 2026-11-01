/**
 * Kinésica Admin - Formato Unificado de Teléfonos (Opción B: Estándar con código de país entre paréntesis)
 *
 * Ejemplos:
 *   5491161164311      -> (+54) 9 11 6116 4311
 *   5493511234567      -> (+54) 9 351 123 4567
 *   34658444935        -> (+34) 658 44 49 35
 *   +54 9 11 6116-4311 -> (+54) 9 11 6116 4311
 */

/**
 * Limpia cualquier caracter no numérico de un string.
 * @param {string|number} raw
 * @returns {string}
 */
export function cleanPhoneDigits(raw) {
  return String(raw || "").replace(/\D/g, "");
}

/**
 * Formatea un número de teléfono para lectura unificada y clara.
 * @param {string|number} raw
 * @returns {string}
 */
export function formatDisplayPhone(raw) {
  if (!raw) return "";
  const str = String(raw).trim();
  const digits = cleanPhoneDigits(str);
  if (!digits) return str;

  // Argentina: 549... (móvil estándar internacional)
  if (digits.startsWith("549")) {
    const rest = digits.slice(3);
    if (rest.startsWith("11") && rest.length === 10) {
      return `(+54) 9 11 ${rest.slice(2, 6)} ${rest.slice(6)}`;
    }
    if (rest.length === 10) {
      return `(+54) 9 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
    if (rest.length >= 8) {
      const p1 = rest.slice(rest.length - 8, rest.length - 4);
      const p2 = rest.slice(rest.length - 4);
      const area = rest.slice(0, rest.length - 8);
      return `(+54) 9 ${area} ${p1} ${p2}`;
    }
    return `(+54) 9 ${rest}`;
  }

  // Argentina: 54... sin el 9
  if (digits.startsWith("54") && digits.length >= 10) {
    const rest = digits.slice(2);
    if (rest.startsWith("11") && rest.length === 10) {
      return `(+54) 11 ${rest.slice(2, 6)} ${rest.slice(6)}`;
    }
    return `(+54) ${rest}`;
  }

  // Argentina: Local CABA / AMBA (011..., 11..., 15...)
  if (digits.startsWith("011") && digits.length === 11) {
    return `(+54) 9 11 ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  if ((digits.startsWith("11") || digits.startsWith("15")) && digits.length === 10) {
    return `(+54) 9 11 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }

  // España: 34... (11 dígitos)
  if (digits.startsWith("34") && digits.length === 11) {
    const rest = digits.slice(2);
    return `(+34) ${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7)}`;
  }
  // España local (9 dígitos empezando en 6, 7, 8 o 9)
  if (digits.length === 9 && /^[6789]/.test(digits)) {
    return `(+34) ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }

  // Uruguay: 598...
  if (digits.startsWith("598") && digits.length >= 11) {
    const rest = digits.slice(3);
    return `(+598) ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
  }

  // Chile: 56...
  if (digits.startsWith("56") && digits.length >= 11) {
    const rest = digits.slice(2);
    return `(+56) ${rest.slice(0, 1)} ${rest.slice(1, 5)} ${rest.slice(5)}`;
  }

  // Estados Unidos / Canadá: 1... (11 dígitos)
  if (digits.startsWith("1") && digits.length === 11) {
    return `(+1) ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return `+${digits}`;
}
