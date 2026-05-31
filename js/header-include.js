(function () {
  var root = document.getElementById("site-header-root");
  if (!root) {
    return;
  }

  var langAttr = root.getAttribute("data-header-lang") || "es";
  var lang =
    langAttr === "en" || langAttr === "fr" ? langAttr : "es";

  var html =
    lang === "en"
      ? window.__KINESICA_HEADER_SNIPPET_EN
      : lang === "fr"
        ? window.__KINESICA_HEADER_SNIPPET_FR
        : window.__KINESICA_HEADER_SNIPPET_ES;

  if (!html) {
    console.error(
      "[header-include] Missing snippet: load partials/header-" +
        lang +
        ".js before js/header-include.js",
    );
    return;
  }

  var hadHeader = root.querySelector(".header");
  if (!hadHeader) {
    root.innerHTML = html;
  }

  function applyFileProtocolHeaderLinks() {
    var routes = window.KINESICA_LANG_ROUTES;
    if (routes && routes.isFileProtocol && routes.isFileProtocol()) {
      routes.applyFileProtocolLinks(root);
    }
  }

  function finishHeader() {
    applyFileProtocolHeaderLinks();
    if (typeof window.kinesicaMarkCurrentLang === "function") {
      window.kinesicaMarkCurrentLang();
    }
    if (typeof window.kinesicaInitLangPicker === "function") {
      window.kinesicaInitLangPicker();
    }
    document.dispatchEvent(
      new CustomEvent("kinesica:header-ready", { bubbles: true }),
    );
  }

  finishHeader();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finishHeader);
  }
})();
