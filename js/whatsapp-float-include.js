(function () {
  var root = document.getElementById("site-whatsapp-root");
  if (!root) {
    return;
  }
  var lang = window.kinesicaResolveLang
    ? window.kinesicaResolveLang(root.getAttribute("data-whatsapp-lang") || "es")
    : root.getAttribute("data-whatsapp-lang") || "es";
  var html = window.kinesicaLoadSnippet
    ? window.kinesicaLoadSnippet("WHATSAPP_FLOAT", lang)
    : null;
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
