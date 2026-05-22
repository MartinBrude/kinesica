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

  var articleLinks = (html.match(/articulos\.html[\s\S]*?<\/ul>/i) || [""])[0];
  var snippetArticles = (articleLinks.match(/<li>/g) || []).length;
  var existing = root.querySelector('a[href*="articulos.html"]');
  var existingSub =
    existing && existing.parentElement
      ? existing.parentElement.querySelector("ul")
      : null;
  var existingArticles = existingSub
    ? existingSub.querySelectorAll("li").length
    : 0;

  if (snippetArticles < 5 && existingArticles > snippetArticles) {
    console.warn(
      "[nav-include] Keeping inline nav (" +
        existingArticles +
        " articles); reload without cache or run npm run assets:build",
    );
    document.dispatchEvent(
      new CustomEvent("kinesica:nav-ready", { bubbles: true }),
    );
    return;
  }

  root.innerHTML = html;
  document.dispatchEvent(
    new CustomEvent("kinesica:nav-ready", { bubbles: true }),
  );
})();
