(function () {
  var root = document.getElementById("site-whatsapp-root");
  if (!root) {
    return;
  }
  var langAttr = root.getAttribute("data-whatsapp-lang") || "es";
  var lang =
    langAttr === "en" || langAttr === "fr" ? langAttr : "es";
  var html =
    lang === "en"
      ? window.__KINESICA_WHATSAPP_FLOAT_SNIPPET_EN
      : lang === "fr"
        ? window.__KINESICA_WHATSAPP_FLOAT_SNIPPET_FR
        : window.__KINESICA_WHATSAPP_FLOAT_SNIPPET_ES;
  if (!html) {
    console.error(
      "[whatsapp-float-include] Missing snippet: load partials/whatsapp-float-" +
        lang +
        ".js before js/whatsapp-float-include.js"
    );
    return;
  }
  root.outerHTML = html;
  if (typeof window.kinesicaApplyWhatsAppContact === "function") {
    window.kinesicaApplyWhatsAppContact();
  }
})();
