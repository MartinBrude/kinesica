/**
 * Kinésica — fachada i18n del widget de reservas (ES / EN / FR / PT).
 * Cada idioma vive en booking-widget-copy-{es,en,fr,pt}.js (≤250 líneas c/u).
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([
      "./booking-widget-copy-es",
      "./booking-widget-copy-en",
      "./booking-widget-copy-fr",
      "./booking-widget-copy-pt",
    ], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-widget-copy-es"),
      require("./booking-widget-copy-en"),
      require("./booking-widget-copy-fr"),
      require("./booking-widget-copy-pt")
    );
  } else {
    root.KinesicaBookingWidgetCopy = factory(
      root.KinesicaBookingWidgetCopyEs,
      root.KinesicaBookingWidgetCopyEn,
      root.KinesicaBookingWidgetCopyFr,
      root.KinesicaBookingWidgetCopyPt
    );
  }
})(typeof self !== "undefined" ? self : this, function (es, en, fr, pt) {
  "use strict";

  function pageLang(explicit) {
    const raw = String(explicit || (typeof document !== "undefined" && document.documentElement.lang) || "es").toLowerCase();
    if (raw.indexOf("en") === 0) return "en";
    if (raw.indexOf("fr") === 0) return "fr";
    if (raw.indexOf("pt") === 0) return "pt";
    return "es";
  }

  return {
    pageLang: pageLang,
    COPY: { es: es || {}, en: en || {}, fr: fr || {}, pt: pt || {} },
  };
});
