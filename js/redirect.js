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
      return;
    }

    if (sessionStorage.getItem("kinesica_auto_redirected") === "1") {
      return;
    }

    var userLang = (navigator.language || navigator.userLanguage || "").toLowerCase();
    var detected = null;
    if (userLang.indexOf("fr") === 0) {
      detected = "fr";
    } else if (userLang.indexOf("en") === 0) {
      detected = "en";
    }

    if (!detected) {
      return;
    }

    var target = routes.targetForLang(file, detected);
    if (!target || target === file) {
      return;
    }

    sessionStorage.setItem("kinesica_auto_redirected", "1");
    window.location.replace(target);
  } catch (e) {
    console.warn("Language redirect suppressed", e);
  }
})();
