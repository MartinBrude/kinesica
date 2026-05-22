(function () {
  var root = document.getElementById("navigation");
  if (!root || root.getAttribute("data-nav-inject") !== "true") {
    return;
  }

  var lang = document.documentElement.getAttribute("lang") || "es";
  if (lang !== "en" && lang !== "fr") {
    lang = "es";
  }

  var html =
    lang === "en"
      ? window.__KINESICA_NAV_SNIPPET_EN
      : lang === "fr"
        ? window.__KINESICA_NAV_SNIPPET_FR
        : window.__KINESICA_NAV_SNIPPET_ES;

  if (!html) {
    console.error("[nav-include] Missing nav snippet for lang:", lang);
    return;
  }

  root.innerHTML = html;
  document.dispatchEvent(
    new CustomEvent("kinesica:nav-ready", { bubbles: true }),
  );
})();
