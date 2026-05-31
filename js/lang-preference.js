/**
 * Persists explicit language choice.
 * Preference is saved only when the user picks a language from the picker.
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
    var root = document.getElementById("site-header-root");
    var fromAttr = root && root.getAttribute("data-header-lang");
    if (fromAttr) {
      return fromAttr;
    }
    var path = window.location.pathname;
    if (path.indexOf("/en/") !== -1 || path === "/en") {
      return "en";
    }
    if (path.indexOf("/fr/") !== -1 || path === "/fr") {
      return "fr";
    }
    if (path.indexOf("/pt/") !== -1 || path === "/pt") {
      return "pt";
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

  function isDefaultLang(lang) {
    var r = routes();
    if (r && r.defaultLang) {
      return lang === r.defaultLang;
    }
    return lang === "es";
  }

  if (isSpanishHome()) {
    saveLang("es");
    clearExplicitSession();
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ page_language: langFromPath() });

  function markCurrentLang() {
    var r = routes();
    var current = langFromPath();
    var langFromHref = r && r.langFromHref;
    document
      .querySelectorAll(".lang-picker__option[href]")
      .forEach(function (link) {
        var href = link.getAttribute("href") || "";
        var targetLang = langFromHref ? langFromHref(href) : null;
        if (targetLang === current) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    document.querySelectorAll(".lang-picker__current").forEach(function (el) {
      if (r && r.nativeName) {
        el.textContent = r.nativeName(current);
      }
    });
  }

  function onReady() {
    var r = routes();
    if (r && r.applyFileProtocolLinks) {
      r.applyFileProtocolLinks();
    }
    markCurrentLang();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  document.addEventListener(
    "click",
    function (e) {
      var link = e.target.closest(".lang-picker__option[href]");
      if (!link) {
        return;
      }
      var href = link.getAttribute("href") || "";
      var r = routes();
      var targetLang = r && r.langFromHref ? r.langFromHref(href) : null;
      if (!targetLang) {
        return;
      }
      saveLang(targetLang);
      if (isDefaultLang(targetLang)) {
        clearExplicitSession();
      } else {
        markExplicitLang(targetLang);
      }
    },
    true,
  );

  document.addEventListener("kinesica:header-ready", markCurrentLang);

  window.kinesicaGetLangPreference = getLang;
  window.kinesicaSaveLangPreference = saveLang;
  window.kinesicaMarkCurrentLang = markCurrentLang;
  window.kinesicaMarkCurrentLangFlag = markCurrentLang;
})();
