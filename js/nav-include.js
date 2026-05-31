(function () {
  var root = document.getElementById("navigation");
  if (!root || root.getAttribute("data-nav-inject") !== "true") {
    return;
  }

  var lang = window.kinesicaResolveLang
    ? window.kinesicaResolveLang(document.documentElement.getAttribute("lang"))
    : document.documentElement.getAttribute("lang") || "es";

  var html = window.kinesicaLoadSnippet
    ? window.kinesicaLoadSnippet("NAV", lang)
    : null;

  if (!html) {
    console.error("[nav-include] Missing nav snippet for lang:", lang);
    return;
  }

  if (!root.querySelector("ul")) {
    root.innerHTML = html;
  }

  function normalizePath(pathname) {
    if (!pathname) {
      return "";
    }
    var parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1] || "index";
  }

  function isCurrentNavLink(anchor) {
    try {
      var target = new URL(anchor.href, window.location.href);
      return (
        target.origin === window.location.origin &&
        normalizePath(target.pathname) === normalizePath(window.location.pathname)
      );
    } catch (e) {
      return false;
    }
  }

  if (root.getAttribute("data-nav-stable") !== "true") {
    root.setAttribute("data-nav-stable", "true");

    root.addEventListener(
      "mousedown",
      function (e) {
        if (e.target.closest("#navigation > ul > li > a")) {
          e.preventDefault();
        }
      },
      true,
    );

    root.addEventListener(
      "click",
      function (e) {
        var link = e.target.closest("#navigation > ul > li > a");
        if (link && isCurrentNavLink(link)) {
          e.preventDefault();
          link.blur();
        }
      },
      true,
    );
  }

  document.dispatchEvent(
    new CustomEvent("kinesica:nav-ready", { bubbles: true }),
  );
})();
