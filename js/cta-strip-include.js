(function () {
  var root = document.getElementById("site-cta-strip-root");
  if (!root) {
    return;
  }
  var lang = window.kinesicaResolveLang
    ? window.kinesicaResolveLang(root.getAttribute("data-cta-lang") || "es")
    : root.getAttribute("data-cta-lang") || "es";
  var html = window.kinesicaLoadSnippet
    ? window.kinesicaLoadSnippet("CTA_STRIP", lang)
    : null;
  if (!html) {
    console.error(
      "[cta-strip-include] Missing snippet: load partials/cta-strip-" +
        lang +
        ".js before js/cta-strip-include.js"
    );
    return;
  }
  root.outerHTML = html;
  if (typeof window.kinesicaApplyWhatsAppContact === "function") {
    window.kinesicaApplyWhatsAppContact();
  }
})();
