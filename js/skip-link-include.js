(function () {
  var lang = document.documentElement.getAttribute("lang") || "es";
  if (lang !== "en" && lang !== "fr") {
    lang = "es";
  }

  var html =
    lang === "en"
      ? window.__KINESICA_SKIP_LINK_SNIPPET_EN
      : lang === "fr"
        ? window.__KINESICA_SKIP_LINK_SNIPPET_FR
        : window.__KINESICA_SKIP_LINK_SNIPPET_ES;

  if (!html) {
    console.error("[skip-link-include] Missing skip-link snippet for lang:", lang);
    return;
  }

  var root = document.getElementById("site-skip-link-root");
  if (!root) {
    console.error("[skip-link-include] Missing #site-skip-link-root");
    return;
  }

  root.outerHTML = html;
})();
