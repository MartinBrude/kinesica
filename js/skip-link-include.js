(function () {
  var lang = window.kinesicaResolveLang
    ? window.kinesicaResolveLang(document.documentElement.getAttribute("lang"))
    : document.documentElement.getAttribute("lang") || "es";

  var html = window.kinesicaLoadSnippet
    ? window.kinesicaLoadSnippet("SKIP_LINK", lang)
    : null;

  if (!html) {
    console.error("[skip-link-include] Missing skip-link snippet for lang:", lang);
    return;
  }

  var root = document.getElementById("site-skip-link-root");
  if (!root) {
    console.error("[skip-link-include] Missing #site-skip-link-root");
    return;
  }

  root.outerHTML = html;
})();
