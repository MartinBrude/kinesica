/**
 * Compact language picker (globe + dropdown). Enhances static HTML from build.
 */
(function () {
  var GLOBE_SVG =
    '<svg class="lang-picker__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  var CHEVRON_SVG =
    '<svg class="lang-picker__chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  var TRIGGER_LABELS = { es: "Idioma", en: "Language", fr: "Langue", pt: "Idioma" };
  var openPicker = null;

  document.documentElement.classList.add("js");

  function routes() {
    return window.KINESICA_LANG_ROUTES;
  }

  function triggerLabel(pageLang) {
    return TRIGGER_LABELS[pageLang] || "Language";
  }

  function buildPickerMarkup(stem, pageLang, compact) {
    var r = routes();
    if (!r || !r.langs) {
      return "";
    }
    var currentName = r.nativeName ? r.nativeName(pageLang) : pageLang;
    var label = triggerLabel(pageLang);
    var items = r.langs
      .map(function (entry) {
        var href = r.hrefForLang(stem, entry.code);
        var current =
          entry.code === pageLang ? ' aria-current="true"' : "";
        return (
          '<li class="lang-picker__item" role="none">' +
          '<a class="lang-picker__option" href="' +
          href +
          '" role="option"' +
          current +
          ' hreflang="' +
          entry.hreflang +
          '">' +
          entry.nativeName +
          "</a></li>"
        );
      })
      .join("");

    var triggerBody = compact
      ? GLOBE_SVG
      : GLOBE_SVG +
        '<span class="lang-picker__current">' +
        currentName +
        "</span>" +
        CHEVRON_SVG;

    return (
      '<button type="button" class="lang-picker__trigger" aria-expanded="false" aria-haspopup="listbox" aria-label="' +
      label +
      '">' +
      triggerBody +
      '</button><ul class="lang-picker__menu" role="listbox" aria-label="' +
      label +
      '">' +
      items +
      "</ul>"
    );
  }

  function closePicker(picker) {
    if (!picker) {
      return;
    }
    picker.classList.remove("is-open");
    var trigger = picker.querySelector(".lang-picker__trigger");
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
    if (openPicker === picker) {
      openPicker = null;
    }
  }

  function closeAllPickers() {
    document.querySelectorAll(".lang-picker.is-open").forEach(closePicker);
  }

  function bindPicker(picker) {
    if (!picker || picker.dataset.langPickerBound === "true") {
      return;
    }
    picker.dataset.langPickerBound = "true";

    var trigger = picker.querySelector(".lang-picker__trigger");
    if (!trigger) {
      return;
    }

    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var isOpen = picker.classList.contains("is-open");
      closeAllPickers();
      if (!isOpen) {
        picker.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        openPicker = picker;
      }
    });

    trigger.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        closeAllPickers();
        picker.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        openPicker = picker;
        var first = picker.querySelector(".lang-picker__option:not([aria-current])");
        if (first) {
          first.focus();
        }
      }
      if (e.key === "Escape") {
        closePicker(picker);
        trigger.focus();
      }
    });

    picker.querySelectorAll(".lang-picker__option").forEach(function (link) {
      link.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          closePicker(picker);
          trigger.focus();
        }
      });
    });
  }

  function initPickerEl(picker) {
    if (!picker) {
      return;
    }
    var root = document.getElementById("site-header-root");
    var pageLang =
      (root && root.getAttribute("data-header-lang")) || "es";
    var r = routes();
    if (!r) {
      return;
    }
    if (!picker.querySelector(".lang-picker__menu")) {
      var stem = r.parseLocation().stem;
      var compact = picker.classList.contains("lang-picker--compact");
      picker.innerHTML = buildPickerMarkup(stem, pageLang, compact);
    }
    bindPicker(picker);
  }

  function initAllPickers() {
    document.querySelectorAll("[data-lang-picker]").forEach(initPickerEl);
  }

  document.addEventListener("click", function (e) {
    if (!openPicker) {
      return;
    }
    if (!openPicker.contains(e.target)) {
      closePicker(openPicker);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeAllPickers();
    }
  });

  document.addEventListener("kinesica:header-ready", initAllPickers);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllPickers);
  } else {
    initAllPickers();
  }

  window.kinesicaInitLangPicker = initAllPickers;
})();
