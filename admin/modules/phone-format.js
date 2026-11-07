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
 * True si ya trae código de país distinto de AR. Alineado con phone_is_non_ar_international().
 * @param {string} digits
 * @returns {boolean}
 */
export function isNonArInternationalPhone(digits) {
  const d = String(digits || "");
  if (!d || d.startsWith("54")) return false;
  const rules = [
    ["598", 11, 13],
    ["595", 11, 13],
    ["593", 11, 13],
    ["591", 11, 13],
    ["351", 12, 13],
    ["55", 12, 13],
    ["56", 11, 13],
    ["57", 12, 13],
    ["52", 12, 13],
    ["51", 11, 13],
    ["58", 11, 13],
    ["34", 11, 12],
    ["39", 11, 13],
    ["33", 11, 13],
    ["49", 11, 13],
    ["44", 11, 13],
    ["61", 11, 13],
    ["64", 11, 13],
    ["81", 11, 13],
    ["86", 12, 14],
    ["1", 11, 11],
  ];
  const len = d.length;
  return rules.some(([cc, min, max]) => d.startsWith(cc) && len >= min && len <= max);
}

/**
 * Normaliza a dígitos E.164-ish. Alineado con clean_phone_number() del backend.
 * AR → 549…; extranjeros con CC se preservan (nunca se antepone 549).
 * @param {string|number} raw
 * @returns {string}
 */
export function normalizePhoneForWhatsApp(raw) {
  const str = String(raw || "").trim();
  if (!str || /^sin-tel/i.test(str) || /^ficha-/i.test(str)) return "";
  const withoutPrefix = str.replace(/^(?:whatsapp|wa\.me|tel|cel|movil)[:\s/]*/i, "");
  if (/[a-zA-Z]/.test(withoutPrefix)) return "";
  let digits = cleanPhoneDigits(withoutPrefix);
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) {
    let rest = digits.slice(2);
    if (rest.startsWith("0")) rest = rest.slice(1);
    if (rest.startsWith("15")) rest = "11" + rest.slice(2);
    const m = rest.match(/^(11|2\d{2,3}|3\d{2,3})15(\d{6,8})$/);
    if (m) rest = m[1] + m[2];
    return "549" + rest;
  }

  if (isNonArInternationalPhone(digits)) return digits;
  if (digits.length === 9 && /^[6789]/.test(digits)) return "34" + digits;

  if (digits.startsWith("0")) digits = digits.slice(1);
  const m15 = digits.match(/^(11|2\d{2,3}|3\d{2,3})15(\d{6,8})$/);
  if (m15) digits = m15[1] + m15[2];
  if (digits.startsWith("15")) digits = "11" + digits.slice(2);
  if (digits.length === 8) digits = "11" + digits;
  if (digits.length === 10 && /^(?:11|[2-9]\d)\d{8}$/.test(digits)) return "549" + digits;
  return digits;
}

/**
 * Formatea un número de teléfono para lectura unificada y clara.
 * @param {string|number} raw
 * @returns {string}
 */
export function formatDisplayPhone(raw) {
  if (!raw) return "";
  const str = String(raw).trim();
  if (str.startsWith("sin-tel-") || str.startsWith("sin-telefono-") || str.startsWith("ficha-")) {
    return "";
  }
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

/**
 * Intenta extraer un número de teléfono candidato desde un texto (resumen del turno o nombre).
 * @param {string} text
 * @returns {string}
 */
function normalizeCalendarKvKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Teléfono desde segmentos clave:valor (telefono/teléfono/whatsapp/…).
 * @param {string} text
 * @returns {string}
 */
function extractPhoneFromKv(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const chunks = raw.split(/\s*(?:\||\r\n|\r|\n)\s*/);
  const phoneKeys = new Set(["telefono", "whatsapp", "wa", "tel", "celular", "movil", "phone"]);
  for (const chunk0 of chunks) {
    const chunk = String(chunk0 || "").trim().replace(/^[^\wáéíóúÁÉÍÓÚñÑüÜ]+/u, "");
    const m = chunk.match(/^([^:]{1,40})\s*:\s*(.+)$/);
    if (!m) continue;
    const key = normalizeCalendarKvKey(m[1]);
    if (!phoneKeys.has(key)) continue;
    const digits = cleanPhoneDigits(m[2]);
    if (digits.length >= 8 && digits.length <= 15) return digits;
  }
  return "";
}

export function extractPhoneCandidate(text) {
  if (!text) return "";
  const t = String(text).trim();
  if (!t) return "";

  const fromKv = extractPhoneFromKv(t);
  if (fromKv) return fromKv;

  // 1. Prefijado explícito: tel, cel, whatsapp, teléfono, etc.
  const mPref = t.match(/(?:(?:whatsapp|wa\.me|tel|cel|telefono|tel[eé]fono|celular|movil)[:\s\/]*)+([+]?[-0-9\s()]{8,22})/i);
  if (mPref) {
    const digits = cleanPhoneDigits(mPref[1]);
    if (digits.length >= 8 && digits.length <= 15) {
      return digits;
    }
  }

  // Descartar menciones explícitas de DNI para que sus dígitos no se confundan con un teléfono
  const withoutDni = t.replace(/(?:dni|doc(?:umento)?|c\.?i\.?|d\.?u\.?|pasaporte)[:\s\.]*[\d\.\-]+/gi, " ");

  // 2. Formato internacional con +
  const mIntl = withoutDni.match(/\+\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  if (mIntl) {
    return cleanPhoneDigits(mIntl[0]);
  }

  // 3. Formato argentino 10 dígitos (11..., 15...) con o sin prefijo 549/011
  const mAr10 = withoutDni.match(/(?:\+?54\s*9?\s*)?(?:0?11|15)[-.\s]?\d{4}[-.\s]?\d{4}\b/);
  if (mAr10) {
    return cleanPhoneDigits(mAr10[0]);
  }

  // 4. Bloque continuo de 10 dígitos con prefijo móvil verosímil
  const m10 = withoutDni.match(/\b(?:11|15|549)\d{8,10}\b/);
  if (m10) {
    return cleanPhoneDigits(m10[0]);
  }

  // 5. Bloque general de 10 a 13 dígitos
  const mAny = withoutDni.match(/\b\d{10,13}\b/);
  if (mAny) {
    return cleanPhoneDigits(mAny[0]);
  }

  return "";
}
