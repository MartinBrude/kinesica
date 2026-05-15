(function () {
  var root = document.getElementById("site-whatsapp-root");
  if (!root) {
    return;
  }
  var lang = root.getAttribute("data-whatsapp-lang") === "en" ? "en" : "es";
  var html =
    lang === "en"
      ? window.__KINESICA_WHATSAPP_FLOAT_SNIPPET_EN
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
