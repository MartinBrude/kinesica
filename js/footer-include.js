(function () {
  var root = document.getElementById("site-footer-root");
  if (!root) {
    return;
  }
  var lang = root.getAttribute("data-footer-lang") === "en" ? "en" : "es";
  var html =
    lang === "en" ? window.__KINESICA_FOOTER_SNIPPET_EN : window.__KINESICA_FOOTER_SNIPPET_ES;
  if (!html) {
    console.error(
      "[footer-include] Missing snippet: load partials/footer-" + lang + ".js before js/footer-include.js"
    );
    return;
  }
  root.innerHTML = html;
  if (typeof window.kinesicaApplyWhatsAppContact === "function") {
    window.kinesicaApplyWhatsAppContact();
  }
})();
