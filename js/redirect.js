(function () {
  try {
    var routes = window.KINESICA_LANG_ROUTES;
    if (!routes || routes.isFileProtocol()) {
      return;
    }

    if (!routes.isSpanishLocation()) {
      return;
    }

    var loc = routes.parseLocation();
    var pref =
      typeof window.kinesicaGetLangPreference === "function"
        ? window.kinesicaGetLangPreference()
        : null;

    if (pref === "en" || pref === "fr") {
      var preferred = routes.targetForLang(loc.stem, pref);
      if (preferred && preferred !== routes.pathForLang("es", loc.stem)) {
        window.location.replace(preferred);
      }
    }
  } catch (e) {
    console.warn("Language redirect suppressed", e);
  }
})();
