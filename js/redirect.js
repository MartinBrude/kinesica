(function () {
  try {
    var routes = window.KINESICA_LANG_ROUTES;
    if (!routes) {
      return;
    }

    var file = routes.spanishFileFromPath();
    if (!routes.isSpanishPage(file)) {
      return;
    }

    var pref =
      typeof window.kinesicaGetLangPreference === "function"
        ? window.kinesicaGetLangPreference()
        : null;

    if (pref === "en" || pref === "fr") {
      var preferred = routes.targetForLang(file, pref);
      if (preferred && preferred !== file) {
        window.location.replace(preferred);
      }
    }
  } catch (e) {
    console.warn("Language redirect suppressed", e);
  }
})();
