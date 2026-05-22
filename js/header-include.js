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

  var routes = window.KINESICA_LANG_ROUTES;
  var switcher = root.querySelector(".lang-switcher");
  if (switcher && routes && !switcher.querySelector("a")) {
    var stem = routes.parseLocation().stem;
    var imgPrefix = lang === "es" ? "images/" : "../images/";
    var flagFile = { es: "es.svg", en: "gb.svg", fr: "fr.svg" };
    var labels =
      lang === "en"
        ? {
            es: ["Spanish Flag", "spanish flag"],
            en: ["British Flag", "british flag"],
            fr: ["French flag", "french flag"],
          }
        : lang === "fr"
          ? {
              es: ["Drapeau espagnol", "drapeau espagnol"],
              en: ["Drapeau britannique", "drapeau britannique"],
              fr: ["Drapeau français", "drapeau français"],
            }
          : {
              es: ["bandera española", "bandera española"],
              en: ["bandera inglesa", "bandera inglesa"],
              fr: ["bandera francesa", "bandera francesa"],
            };

    var currentLang = routes.parseLocation().lang;
    switcher.innerHTML = ["es", "en", "fr"]
      .map(function (toLang) {
        var href = routes.hrefForLang(stem, toLang);
        var meta = labels[toLang];
        var titleAttr = meta[0] ? ' title="' + meta[0] + '"' : "";
        var currentAttr =
          toLang === currentLang ? ' aria-current="true"' : "";
        return (
          '<li><a href="' +
          href +
          '"' +
          currentAttr +
          '><img src="' +
          imgPrefix +
          flagFile[toLang] +
          '"' +
          titleAttr +
          ' alt="' +
          meta[1] +
          '" width="24" height="16" /></a></li>'
        );
      })
      .join("");
  }

  function applyFileProtocolHeaderLinks() {
    if (routes && routes.isFileProtocol && routes.isFileProtocol()) {
      routes.applyFileProtocolLinks(root);
    }
  }

  function finishHeader() {
    applyFileProtocolHeaderLinks();
    if (typeof window.kinesicaMarkCurrentLangFlag === "function") {
      window.kinesicaMarkCurrentLangFlag();
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
