(function () {
  var rawLang = document.documentElement.getAttribute("lang") || "es";
  var lang = window.kinesicaResolveLang
    ? window.kinesicaResolveLang(rawLang)
    : rawLang;
  lang = String(lang || "es").split("-")[0].toLowerCase();

  var html = window.kinesicaLoadSnippet
    ? window.kinesicaLoadSnippet("SKIP_LINK", lang)
    : null;

  if (!html) {
    var key = "__KINESICA_SKIP_LINK_SNIPPET_" + lang.toUpperCase();
    html = window[key] || window.__KINESICA_SKIP_LINK_SNIPPET_ES;
  }

  if (!html) {
    console.error("[skip-link-include] Missing skip-link snippet for lang:", lang);
    return;
  }

  var root = document.getElementById("site-skip-link-root");
  if (!root) {
    return;
  }

  root.outerHTML = html;
})();
