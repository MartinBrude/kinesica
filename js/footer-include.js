(function () {
  var ref = document.currentScript;
  if (
    ref &&
    ref.src &&
    document.querySelector(".page-header") &&
    !window.__KINESICA_PAGE_HEADER_WORD_LOADED
  ) {
    window.__KINESICA_PAGE_HEADER_WORD_LOADED = true;
    var pageHeaderWord = document.createElement("script");
    pageHeaderWord.src = ref.src.replace(
      /footer-include(\.min)?\.js(\?.*)?$/,
      "page-header-word$1.js"
    );
    document.body.appendChild(pageHeaderWord);
  }

  var root = document.getElementById("site-footer-root");
  if (!root) {
    return;
  }
  var lang = window.kinesicaResolveLang
    ? window.kinesicaResolveLang(root.getAttribute("data-footer-lang") || "es")
    : root.getAttribute("data-footer-lang") || "es";
  var html = window.kinesicaLoadSnippet
    ? window.kinesicaLoadSnippet("FOOTER", lang)
    : null;
  if (!html) {
    console.error(
      "[footer-include] Missing snippet: load partials/footer-" +
        lang +
        ".js before js/footer-include.js"
    );
    return;
  }
  root.innerHTML = html;

  function applyFileProtocolFooterLinks() {
    var routes = window.KINESICA_LANG_ROUTES;
    if (routes && routes.isFileProtocol && routes.isFileProtocol()) {
      routes.applyFileProtocolLinks(root);
    }
  }

  applyFileProtocolFooterLinks();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFileProtocolFooterLinks);
  }

  if (typeof window.kinesicaApplyWhatsAppContact === "function") {
    window.kinesicaApplyWhatsAppContact();
  }

  if (ref && ref.src && !window.__KINESICA_GTM_EVENTS_LOADED) {
    window.__KINESICA_GTM_EVENTS_LOADED = true;
    var gtmEvents = document.createElement("script");
    gtmEvents.src = ref.src.replace(
      /footer-include(\.min)?\.js(\?.*)?$/,
      "gtm-events$1.js"
    );
    document.body.appendChild(gtmEvents);
  }
})();
