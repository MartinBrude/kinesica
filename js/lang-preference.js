/**
 * Persists explicit language choice (ES / EN / FR).
 * Preference is saved only when the user clicks a language flag.
 * Visiting the Spanish home resets preference to ES (idioma por defecto Argentina).
 */
(function () {
  var STORAGE_KEY = "kinesica_lang";
  var SESSION_EXPLICIT_KEY = "kinesica_lang_explicit";

  function routes() {
    return window.KINESICA_LANG_ROUTES;
  }

  function langFromPath() {
    var r = routes();
    if (r && r.parseLocation) {
      return r.parseLocation().lang;
    }
    var path = window.location.pathname;
    if (path.indexOf("/en/") !== -1 || path === "/en") {
      return "en";
    }
    if (path.indexOf("/fr/") !== -1 || path === "/fr") {
      return "fr";
    }
    return "es";
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore */
    }
  }

  function getLang() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function isSpanishHome() {
    var r = routes();
    if (r && r.isSpanishHome) {
      return r.isSpanishHome();
    }
    var path = window.location.pathname;
    return path === "/" || path === "/index.html";
  }

  function clearExplicitSession() {
    try {
      sessionStorage.removeItem(SESSION_EXPLICIT_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function markExplicitLang(lang) {
    try {
      sessionStorage.setItem(SESSION_EXPLICIT_KEY, lang);
    } catch (e) {
      /* ignore */
    }
  }

  if (isSpanishHome()) {
    saveLang("es");
    clearExplicitSession();
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ page_language: langFromPath() });

  function markCurrentLangFlag() {
    var current = langFromPath();
    document.querySelectorAll(".lang-switcher a[href]").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      var isFr =
        href.indexOf("/fr/") !== -1 ||
        href.indexOf("fr/") === 0 ||
        href.indexOf("../fr/") !== -1;
      var isEn =
        href.indexOf("/en/") !== -1 ||
        href.indexOf("en/") === 0 ||
        href.indexOf("../en/") !== -1;
      var isEs = !isFr && !isEn;
      var match =
        (current === "fr" && isFr) ||
        (current === "en" && isEn) ||
        (current === "es" && isEs);
      if (match) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function onReady() {
    var r = routes();
    if (r && r.applyFileProtocolLinks) {
      r.applyFileProtocolLinks();
    }
    markCurrentLangFlag();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  document.addEventListener(
    "click",
    function (e) {
      var link = e.target.closest(".lang-switcher a[href]");
      if (!link) {
        return;
      }
      var href = link.getAttribute("href") || "";
      if (
        href.indexOf("/fr/") !== -1 ||
        href.indexOf("fr/") === 0 ||
        href.indexOf("../fr/") !== -1
      ) {
        saveLang("fr");
        markExplicitLang("fr");
      } else if (
        href.indexOf("/en/") !== -1 ||
        href.indexOf("en/") === 0 ||
        href.indexOf("../en/") !== -1
      ) {
        saveLang("en");
        markExplicitLang("en");
      } else {
        saveLang("es");
        clearExplicitSession();
      }
    },
    true
  );

  window.kinesicaGetLangPreference = getLang;
  window.kinesicaSaveLangPreference = saveLang;
})();
