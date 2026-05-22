(function () {
  var root = document.getElementById("site-cta-strip-root");
  if (!root) {
    return;
  }
  var langAttr = root.getAttribute("data-cta-lang") || "es";
  var lang =
    langAttr === "en" || langAttr === "fr" ? langAttr : "es";
  var html =
    lang === "en"
      ? window.__KINESICA_CTA_STRIP_SNIPPET_EN
      : lang === "fr"
        ? window.__KINESICA_CTA_STRIP_SNIPPET_FR
        : window.__KINESICA_CTA_STRIP_SNIPPET_ES;
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
