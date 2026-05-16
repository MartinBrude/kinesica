/**
 * Persists explicit language choice (ES / EN / FR).
 * Preference is set when the user clicks a flag or lands on a localized page.
 * Loading a Spanish page does not reset an existing preference.
 */
(function () {
  var STORAGE_KEY = "kinesica_lang";

  function langFromPath() {
    var path = window.location.pathname;
    var file = path.substring(path.lastIndexOf("/") + 1);
    if (!file || file === "/") {
      return "es";
    }
    if (/_fr\.html$/i.test(file)) {
      return "fr";
    }
    if (/_en\.html$/i.test(file)) {
      return "en";
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

  function syncLangFromUrlIfLocalized() {
    var lang = langFromPath();
    if (lang === "en" || lang === "fr") {
      saveLang(lang);
    }
  }

  syncLangFromUrlIfLocalized();

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ page_language: langFromPath() });

  function markCurrentLangFlag() {
    var current = langFromPath();
    document.querySelectorAll(".lang-switcher a[href]").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      var isFr = href.indexOf("_fr") !== -1 || href.indexOf("404_fr") !== -1;
      var isEn = href.indexOf("_en") !== -1 || href.indexOf("404_en") !== -1;
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markCurrentLangFlag);
  } else {
    markCurrentLangFlag();
  }

  document.addEventListener(
    "click",
    function (e) {
      var link = e.target.closest(".lang-switcher a[href]");
      if (!link) {
        return;
      }
      var href = link.getAttribute("href") || "";
      if (/_fr\.html/i.test(href) || href.indexOf("404_fr") !== -1) {
        saveLang("fr");
      } else if (/_en\.html/i.test(href) || href.indexOf("404_en") !== -1) {
        saveLang("en");
      } else {
        saveLang("es");
      }
    },
    true
  );

  window.kinesicaGetLangPreference = getLang;
  window.kinesicaSaveLangPreference = saveLang;
})();
