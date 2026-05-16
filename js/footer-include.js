(function () {
  var root = document.getElementById("site-footer-root");
  if (!root) {
    return;
  }
  var langAttr = root.getAttribute("data-footer-lang") || "es";
  var lang =
    langAttr === "en" || langAttr === "fr" ? langAttr : "es";
  var html =
    lang === "en"
      ? window.__KINESICA_FOOTER_SNIPPET_EN
      : lang === "fr"
        ? window.__KINESICA_FOOTER_SNIPPET_FR
        : window.__KINESICA_FOOTER_SNIPPET_ES;
  if (!html) {
    console.error(
      "[footer-include] Missing snippet: load partials/footer-" +
        lang +
        ".js before js/footer-include.js"
    );
    return;
  }
  root.innerHTML = html;
  if (typeof window.kinesicaApplyWhatsAppContact === "function") {
    window.kinesicaApplyWhatsAppContact();
  }
})();
