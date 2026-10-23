/**
 * Kinésica - Validación Pura y Sanitización de Formulario de Reservas
 * ==================================================================
 * Funciones puras e independientes del DOM:
 * - Sanitización en vivo de campos (sanitizeFieldInput)
 * - Validación estricta de Email y detección de typos en dominio (isValidEmail, suggestEmailDomain)
 * - Inspección de teléfonos AR / internacionales (inspectPhone)
 * - Validación integral del formulario de datos (validateContactForm)
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KinesicaBookingValidation = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const Validation = {};

/** Campos del formulario "Completa tus datos" con mensaje de error propio. */
  Validation.FORM_FIELDS = ["contacto-nombre", "contacto-telefono", "nombre", "email", "telefono", "dni"];

  /**
   * Restringe en vivo lo que se puede tipear en cada campo antes de validar.
   */
  Validation.sanitizeFieldInput = function (field, rawValue) {
    const val = String(rawValue == null ? "" : rawValue).replace(/[\u0000-\u001F\u007F]/g, "");
    if (field === "telefono" || field === "contacto-telefono") {
      // Solo dígitos, +, espacios, guiones, paréntesis y puntos; + solo al inicio
      const cleaned = val.replace(/[^0-9+\-().\s]/g, "");
      const hasLeadingPlus = cleaned.trimStart().startsWith("+");
      const withoutPlus = cleaned.replace(/\+/g, "");
      return (hasLeadingPlus ? "+" + withoutPlus : withoutPlus).slice(0, 24);
    }
    if (field === "email") {
      // Sin espacios ni caracteres prohibidos en direcciones de correo
      return val.replace(/[\s<>(),;:"[\]\\]/g, "").slice(0, 120);
    }
    if (field === "nombre" || field === "contacto-nombre") {
      // Letras (incluyendo acentos/diacríticos), espacios, apóstrofes, guiones y puntos
      return val.replace(/[^\p{L}\p{M}\s'.\-]/gu, "").replace(/\s{2,}/g, " ").slice(0, 100);
    }
    if (field === "dni") {
      return val.replace(/[^0-9A-Za-z.\-\s]/g, "").slice(0, 20);
    }
    if (field === "contacto-notas") {
      return val.replace(/[<>]/g, "").slice(0, 80);
    }
    return val;
  };

  /**
   * Valida estrictamente el formato de una dirección de correo electrónico.
   */
  Validation.isValidEmail = function (raw) {
    const s = String(raw || "").trim();
    if (!s || s.length > 120 || /\s/.test(s)) return false;
    const parts = s.split("@");
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!local || !domain || local.length > 64 || domain.length > 253) return false;
    if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
    if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
    const labels = domain.split(".");
    if (labels.length < 2) return false;
    const tld = labels[labels.length - 1];
    if (!/^[A-Za-z]{2,24}$/.test(tld)) return false;
    return labels.every((lbl) => lbl.length > 0 && lbl.length <= 63 && /^[A-Za-z0-9-]+$/.test(lbl) && !lbl.startsWith("-") && !lbl.endsWith("-"));
  };

  /**
   * Detecta si un dominio de email parece un error tipográfico común de proveedores masivos.
   * Si detecta sospecha, devuelve la sugerencia (ej: "gmail.com"), de lo contrario null.
   */
  Validation.suggestEmailDomain = function (raw) {
    const s = String(raw || "").trim().toLowerCase();
    const at = s.lastIndexOf("@");
    if (at === -1) return null;
    const domain = s.slice(at + 1);
    if (!domain) return null;

    const typoMap = {
      "gmai.com": "gmail.com",
      "gmial.com": "gmail.com",
      "gamil.com": "gmail.com",
      "gmaill.com": "gmail.com",
      "gmail.con": "gmail.com",
      "gemail.com": "gmail.com",
      "gmail.co": "gmail.com",
      "hotmial.com": "hotmail.com",
      "hotmai.com": "hotmail.com",
      "hotamail.com": "hotmail.com",
      "hotmaill.com": "hotmail.com",
      "hotmail.con": "hotmail.com",
      "outloo.com": "outlook.com",
      "outlok.com": "outlook.com",
      "outlock.com": "outlook.com",
      "outlook.con": "outlook.com",
      "yaho.com": "yahoo.com",
      "yahooo.com": "yahoo.com",
      "yahoo.con": "yahoo.com",
      "iclud.com": "icloud.com",
      "icoud.com": "icloud.com",
      "icloud.con": "icloud.com",
    };
    if (typoMap[domain]) return typoMap[domain];
    // TLDs con typo evidente (.con en lugar de .com)
    if (domain.endsWith(".con") && domain.length > 5) {
      return domain.slice(0, -4) + ".com";
    }
    return null;
  };

  /**
   * Analiza un teléfono argentino o internacional.
   * - valid=false: no llega al mínimo de dígitos o son todos iguales -> error bloqueante.
   * - standard=true: formato argentino (AMBA/interior, con o sin +54/0/15) o internacional estándar (+ / 00 / código país).
   * - standard=false (pero valid=true): formato inusual (ej. 6-7 dígitos o largo atípico sin prefijo) -> se repregunta 1 vez y luego se deja pasar.
   */
  Validation.inspectPhone = function (raw) {
    const trimmed = String(raw || "").trim();
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 16 || /^(\d)\1+$/.test(digits)) {
      return { valid: false, standard: false, digits };
    }
    const hasIntlPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
    // Formato argentino estándar
    const isStandardAr =
      (/^549?\d{10}$/.test(digits)) ||
      (/^0?(?:11|[23]\d{2,3})\d{6,8}$/.test(digits) && digits.length >= 10 && digits.length <= 11) ||
      (/^0?1115\d{8}$/.test(digits)) ||
      (/^15\d{8}$/.test(digits)) ||
      (/^\d{8}$/.test(digits) && !hasIntlPrefix); // fijo/celular local CABA de 8 dígitos
    // Formato internacional estándar (E.164 con + o 00, o prefijos de países frecuentes como UY 598, CL 56, BR 55, PY 595, BO 591, ES 34, US/CA 1, etc.)
    const isStandardIntl =
      (hasIntlPrefix && digits.length >= 8 && digits.length <= 15) ||
      (/^(?:34\d{9}|598\d{8,9}|56\d{9}|55\d{10,11}|595\d{9}|591\d{8}|51\d{9}|57\d{10}|52\d{10}|1\d{10}|44\d{10}|33\d{9}|39\d{9,10}|49\d{10,11})$/.test(digits));
    return {
      valid: true,
      standard: Boolean(isStandardAr || isStandardIntl),
      digits,
    };
  };

  /**
   * Validación pura del formulario de datos (sin DOM). Devuelve TODOS los errores, en el orden visual.
   * Si un teléfono tiene dígitos pero formato no estándar, repregunta una vez (isSoftPhoneConfirm)
   * y en el segundo intento (confirmedPhones) lo deja pasar.
   */
  Validation.validateContactForm = function (v, t) {
    const errors = [];
    const confirmed = v && v.confirmedPhones;
    const isConfirmed = (digits) => Boolean(
      confirmed && (typeof confirmed.has === "function" ? confirmed.has(digits) : Array.isArray(confirmed) && confirmed.indexOf(digits) !== -1)
    );
    const checkPhoneField = (rawPhone, fieldName, errKey) => {
      const info = Validation.inspectPhone(rawPhone);
      if (!info.valid) {
        errors.push({ field: fieldName, message: t(errKey) });
      } else if (!info.standard && !isConfirmed(info.digits)) {
        errors.push({
          field: fieldName,
          message: t("phoneConfirm"),
          isSoftPhoneConfirm: true,
          phoneDigits: info.digits,
        });
      }
    };
    const cleanName = (x) => String(x || "").replace(/[^\p{L}\p{M}]/gu, "");

    if (v.isOther) {
      if (!v.contactoNombre || cleanName(v.contactoNombre).length < 2) {
        errors.push({ field: "contacto-nombre", message: t("errContactName") });
      }
      checkPhoneField(v.contactoTelefono, "contacto-telefono", "errContactPhone");
    }
    if (!v.nombre || cleanName(v.nombre).length < 2) {
      errors.push({ field: "nombre", message: t("errPatientName") });
    }
    if (!Validation.isValidEmail(v.email)) {
      errors.push({ field: "email", message: t("emailInvalid") });
    } else {
      const emailLower = String(v.email || "").trim().toLowerCase();
      const confirmedEmails = v && v.confirmedEmails;
      const isEmailConfirmed = Boolean(
        confirmedEmails && (typeof confirmedEmails.has === "function" ? confirmedEmails.has(emailLower) : Array.isArray(confirmedEmails) && confirmedEmails.indexOf(emailLower) !== -1)
      );
      const suggested = Validation.suggestEmailDomain(emailLower);
      if (suggested && !isEmailConfirmed) {
        errors.push({
          field: "email",
          message: t("emailConfirm"),
          isSoftEmailConfirm: true,
          emailValue: emailLower,
        });
      }
    }
    // Si el teléfono del paciente sale del de quien agenda, el error ya está marcado en ese campo.
    if (!v.usesContactPhone) {
      checkPhoneField(v.telefono, "telefono", "errPhone");
    }
    return errors;
  };

  return Validation;
});
