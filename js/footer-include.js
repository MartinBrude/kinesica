(function () {
  var ref = document.currentScript;

  function jsSiblingScript(filename) {
    if (!ref || !ref.src) {
      return null;
    }
    var src = ref.src;
    var q = "";
    var qIdx = src.indexOf("?");
    if (qIdx !== -1) {
      q = src.slice(qIdx);
      src = src.slice(0, qIdx);
    }
    var base = src.slice(0, src.lastIndexOf("/") + 1);
    var min = /\.min\.js$/i.test(src) ? ".min.js" : ".js";
    return base + filename.replace(/\.js$/i, "") + min + q;
  }

  function needsPageHeaderWordScript() {
    var header = document.querySelector(".page-header");
    if (!header) {
      return false;
    }
    var caption = header.querySelector(".page-caption");
    if (!caption || caption.querySelector(".page-header-word")) {
      return false;
    }
    if (caption.querySelector(".page-title")) {
      return true;
    }
    return !(caption.textContent || "").trim();
  }

  if (needsPageHeaderWordScript() && !window.__KINESICA_PAGE_HEADER_WORD_LOADED) {
    var pageHeaderSrc = jsSiblingScript("page-header-word.js");
    if (pageHeaderSrc) {
      window.__KINESICA_PAGE_HEADER_WORD_LOADED = true;
      var pageHeaderWord = document.createElement("script");
      pageHeaderWord.src = pageHeaderSrc;
      document.body.appendChild(pageHeaderWord);
    }
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

  if (!window.__KINESICA_GTM_EVENTS_LOADED) {
    var gtmEventsSrc = jsSiblingScript("gtm-events.js");
    if (gtmEventsSrc) {
      window.__KINESICA_GTM_EVENTS_LOADED = true;
      var gtmEvents = document.createElement("script");
      gtmEvents.src = gtmEventsSrc;
      document.body.appendChild(gtmEvents);
    }
  }
})();
