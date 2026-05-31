(function () {
  var root = document.getElementById("site-header-root");
  if (!root) {
    return;
  }

  var lang = window.kinesicaResolveLang
    ? window.kinesicaResolveLang(root.getAttribute("data-header-lang") || "es")
    : root.getAttribute("data-header-lang") || "es";

  var html = window.kinesicaLoadSnippet
    ? window.kinesicaLoadSnippet("HEADER", lang)
    : null;

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
    if (
      typeof window.kinesicaMarkCurrentLang === "function" &&
      window.KINESICA_LANG_ROUTES
    ) {
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
