(function () {
  function resolveLang(attr) {
    var routes = window.KINESICA_LANG_ROUTES;
    if (routes && routes.parseLocation) {
      return routes.parseLocation().lang;
    }
    return attr || "es";
  }

  function snippet(prefix, lang) {
    if (typeof window.kinesicaSnippet === "function") {
      return window.kinesicaSnippet(prefix, lang);
    }
    var key = "__KINESICA_" + prefix + "_SNIPPET_" + lang.toUpperCase();
    return window[key] || window["__KINESICA_" + prefix + "_SNIPPET_ES"];
  }

  window.kinesicaResolveLang = resolveLang;
  window.kinesicaLoadSnippet = snippet;
})();
