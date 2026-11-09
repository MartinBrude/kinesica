/**
 * Fuente única de validación DNI/pasaporte para la turnera.
 * Usar desde booking-validation.js; espejar en:
 *   - admin/api/lib_booking_dni.php (calendar_backup)
 *   - booking/google-apps-script.js → isValidBookingDni
 * Verificar: node scripts/verify-booking-dni-rules.mjs
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KinesicaBookingDniRules = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** @type {{digitMin:number,digitMax:number,alnumMin:number,alnumMax:number}} */
  const RULES = {
    digitMin: 5,
    digitMax: 12,
    alnumMin: 5,
    alnumMax: 20,
  };

  /**
   * DNI / pasaporte usable. Rechaza vacío y "No provisto".
   * @param {unknown} raw
   * @returns {boolean}
   */
  function isValidBookingDni(raw) {
    const s = String(raw || "").trim();
    if (!s || /^no\s*provisto$/i.test(s)) return false;
    const alnum = s.replace(/[^0-9A-Za-z]/g, "");
    if (!alnum) return false;
    // Pasaporte / doc con letras: 5–20 alfanuméricos.
    if (/[A-Za-z]/.test(alnum)) {
      return alnum.length >= RULES.alnumMin && alnum.length <= RULES.alnumMax;
    }
    // Solo dígitos (DNI): 5–12 (puntos/guiones/espacios ya se ignoraron).
    return alnum.length >= RULES.digitMin && alnum.length <= RULES.digitMax;
  }

  return {
    RULES: RULES,
    isValidBookingDni: isValidBookingDni,
    // Alias histórico del widget
    isValidDni: isValidBookingDni,
  };
});
