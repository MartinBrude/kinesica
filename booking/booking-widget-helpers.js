(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine", "./booking-widget-copy", "./booking-widget-helpers-fees"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-engine"),
      require("./booking-widget-copy"),
      require("./booking-widget-helpers-fees")
    );
  } else {
    root.KinesicaBookingWidgetHelpers = factory(
      root.KinesicaBookingEngine,
      root.KinesicaBookingWidgetCopy,
      root.KinesicaBookingWidgetHelpersFees
    );
  }
})(typeof self !== "undefined" ? self : this, function (engine, copyModule, feesModule) {
  "use strict";

  const COPY = (copyModule && copyModule.COPY) || {};

  function attachHelpers(proto) {
    if (feesModule && typeof feesModule.attachFeeHelpers === "function") {
      feesModule.attachFeeHelpers(proto);
    }

    proto.t = function (key) {
      const value = this.copy[key];
      if (value != null) return value;
      return (COPY.es && COPY.es[key] != null) ? COPY.es[key] : key;
    };

    proto.practitionerGenderLabel = function (id) {
      if (typeof id !== "string") return "";
      const normalized = id.trim().toLowerCase();
      if (normalized === "norberto") return this.t("proMale");
      if (normalized === "maria") return this.t("proFemale");
      return "";
    };

    proto.practitionerFullName = function (id) {
      if (typeof id !== "string") return "";
      const normalized = id.trim().toLowerCase();
      if (normalized === "norberto") return "Norberto Brude";
      if (normalized === "maria") return "María Gulin";
      return this.practitionerGenderLabel(normalized);
    };

    proto.formatIsoDateDisplay = function (iso) {
      const parts = String(iso || "").split("-");
      if (parts.length !== 3) return String(iso || "");
      return `${parts[2]}/${parts[1]}`;
    };

    /** Fin de baja activa de un profesional (ISO), o null. */
    proto.getActiveLeaveEndIso = function (practitionerId) {
      if (!practitionerId || !engine || typeof engine.getActiveLeaveEndIso !== "function") return null;
      return engine.getActiveLeaveEndIso(practitionerId);
    };

    proto.getMariaLeaveNoticeText = function () {
      const endIso = this.getActiveLeaveEndIso("maria");
      if (!endIso) return null;
      const tpl = this.t("mariaLeaveNotice") || "";
      return String(tpl).replace("{date}", this.formatIsoDateDisplay(endIso));
    };

    /** Leyenda corta para técnicas exclusivas grises durante la baja. */
    proto.getMariaReturnNoticeText = function () {
      const endIso = this.getActiveLeaveEndIso("maria");
      if (!endIso) return null;
      const tpl = this.t("mariaReturnNotice") || "";
      return String(tpl).replace("{date}", this.formatIsoDateDisplay(endIso));
    };

    /** true si hay ≥2 profesionales elegibles (horizonte o día concreto). */
    proto.hasGenderPreferenceChoice = function (dateIso) {
      if (!this.state || this.state.existingPatient === true) return false;
      const techniqueId = this.state.techniqueId;
      if (!techniqueId || !engine) return false;
      const technique = typeof engine.getTechnique === "function" ? engine.getTechnique(techniqueId) : null;
      if (technique && typeof this.bookablePractitionersForTechnique === "function") {
        if (this.bookablePractitionersForTechnique(technique).length < 2) return false;
      }
      if (dateIso && typeof engine.practitionersAvailableOnDate === "function") {
        return engine.practitionersAvailableOnDate(techniqueId, dateIso).length > 1;
      }
      if (technique && typeof this.bookablePractitionersForTechnique === "function") {
        return this.bookablePractitionersForTechnique(technique).length > 1;
      }
      return Boolean(technique && Array.isArray(technique.practitioners) && technique.practitioners.length > 1);
    };

    proto.getPractitionerPreferenceDisplay = function () {
      if (!this.state || this.state.existingPatient === true) return null;
      const dateIso = this.state.selectedDate || null;
      if (!this.hasGenderPreferenceChoice(dateIso)) return null;
      const pref = typeof this.state.practitionerPreference === "string" ? this.state.practitionerPreference.trim().toLowerCase() : null;
      if (pref === "norberto") return this.t("proMale");
      if (pref === "maria") return this.t("proFemale");
      if (pref === "any" || this.hasGenderPreferenceChoice(null)) return this.t("proAny");
      return null;
    };

    proto.syncStep2PreferencePill = function () {
      const prefContainer = this.container && this.container.querySelector("#kb-step2-pref-container");
      const prefVal = this.container && this.container.querySelector("#kb-step2-pref-val");
      if (!prefContainer || !prefVal) return;
      const onStep2 = this.state && Number(this.state.step) === 2;
      const prefText = this.getPractitionerPreferenceDisplay();
      if (prefText && onStep2) {
        prefVal.textContent = prefText;
        prefContainer.style.display = "block";
      } else {
        prefContainer.style.display = "none";
      }
    };

    proto.practitionerWhatsappUrl = function (id) {
      const prac = engine && engine.PRACTITIONERS && engine.PRACTITIONERS[id];
      const digits = (prac && prac.whatsapp) || (id === "maria" ? "5491128531224" : "5491161564311");
      return `https://wa.me/${digits}`;
    };

    proto.openPractitionerWhatsApp = function (id) {
      const url = this.practitionerWhatsappUrl(id);
      if (typeof window !== "undefined" && typeof window.open === "function") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else if (typeof window !== "undefined") {
        window.location.href = url;
      }
    };

    proto.fallbackPractitionerId = function () {
      const techniqueId = this.state && this.state.techniqueId;
      if (techniqueId === "paciente" && this.state && this.state.practitionerId === "maria") {
        return "maria";
      }
      const technique =
        engine && typeof engine.getTechnique === "function"
          ? engine.getTechnique(techniqueId)
          : null;
      if (
        technique &&
        Array.isArray(technique.practitioners) &&
        technique.practitioners.length === 1 &&
        technique.practitioners[0] === "maria"
      ) {
        return "maria";
      }
      return "norberto";
    };

    proto.escapeHtml = function (value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    };

    proto.friendlySubmitError = function (err) {
      const raw = String((err && err.message) || "").trim();
      const fallback = this.t("bookError");
      if (!raw) return fallback;
      if (raw.length > 180 || /HTTP Error|Failed to fetch|NetworkError|TypeError|ECONN|SQLSTATE|stack|at \w+\s*\(/i.test(raw)) {
        return fallback;
      }
      return raw;
    };

    proto.defaultManageUrl = function () {
      const lang = this.lang || "es";
      if (lang === "en") return "/en/mi-turno.html";
      if (lang === "fr") return "/fr/mi-turno.html";
      if (lang === "pt") return "/pt/mi-turno.html";
      return "/mi-turno.html";
    };

    proto.safeManageUrl = function (raw) {
      const fallback = this.defaultManageUrl();
      const url = String(raw || fallback).trim();
      if (/^\/(?:[a-z]{2}\/)?mi-turno\.html(?:[?#].*)?$/i.test(url)) return url;
      return fallback;
    };
  }

  return { attachHelpers };
});
