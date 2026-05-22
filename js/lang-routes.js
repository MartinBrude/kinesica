/**
 * Page stems → localized paths (/, /en/…, /fr/…).
 * Supports http(s) and local file:// preview.
 */
(function (global) {
  var SUBDIRS = ["en", "fr"];
  var STEMS = [
    "index",
    "articulos",
    "atm",
    "acupuntura",
    "cadenas",
    "cefalea",
    "cervicalgia",
    "cervicobraquialgia",
    "ciatalgia",
    "cv",
    "dolor-sacriiliaco",
    "dorso-plano",
    "dorsalgia",
    "epicondilitis-lateral",
    "epicondilitis-medial",
    "escoliosis",
    "fascitis-plantar",
    "genu-valgo",
    "genu-varo",
    "gonalgia",
    "hernia-disco",
    "hipercifosis",
    "hiperlordosis",
    "impingement-subacromial",
    "lumbalgia",
    "manguito-rotador",
    "manipulaciones",
    "meniscopatia",
    "neurodinamia",
    "osteopatia",
    "pies-planos",
    "posturologia-clinica",
    "protrusion-discal",
    "pubalgia",
    "radiculopatia",
    "rpg",
    "talalgia",
  ];

  function isFileProtocol() {
    return global.location.protocol === "file:";
  }

  function pathForLang(lang, stem) {
    if (lang === "es") {
      return stem === "index" ? "/" : "/" + stem + ".html";
    }
    return stem === "index" ? "/" + lang + "/" : "/" + lang + "/" + stem + ".html";
  }

  function relativePathFor(fromLang, toLang, stem) {
    var file = stem === "index" ? "index.html" : stem + ".html";
    if (fromLang === "es") {
      if (toLang === "es") {
        return file;
      }
      return toLang + "/" + file;
    }
    if (fromLang === toLang) {
      return file;
    }
    if (toLang === "es") {
      return "../" + file;
    }
    return "../" + toLang + "/" + file;
  }

  function parseSiteHref(href) {
    if (!href || href.charAt(0) !== "/") {
      return null;
    }
    if (href === "/" || href === "/index.html") {
      return { lang: "es", stem: "index" };
    }
    if (href === "/en/" || href === "/en/index.html") {
      return { lang: "en", stem: "index" };
    }
    if (href === "/fr/" || href === "/fr/index.html") {
      return { lang: "fr", stem: "index" };
    }
    var m = href.match(/^\/(en|fr)\/([^/?#]+)\.html$/);
    if (m) {
      return { lang: m[1], stem: m[2] };
    }
    m = href.match(/^\/([^/?#]+)\.html$/);
    if (m) {
      return { lang: "es", stem: m[1] };
    }
    return null;
  }

  function parseLocation() {
    var path = global.location.pathname;

    if (path === "/en" || path === "/en/") {
      return { lang: "en", stem: "index" };
    }
    if (path === "/fr" || path === "/fr/") {
      return { lang: "fr", stem: "index" };
    }

    var i;
    for (i = 0; i < SUBDIRS.length; i++) {
      var lang = SUBDIRS[i];
      var marker = "/" + lang + "/";
      var idx = path.indexOf(marker);
      if (idx !== -1) {
        var tail = path.slice(idx + marker.length);
        var file = tail.split("/")[0] || "index.html";
        var stem = file.replace(/\.html$/i, "") || "index";
        return { lang: lang, stem: stem };
      }
    }

    var parts = path.split("/").filter(Boolean);
    if (parts[0] === "en" || parts[0] === "fr") {
      var langPart = parts[0];
      var filePart = parts[1] || "index.html";
      var stemPart = filePart.replace(/\.html$/i, "") || "index";
      return { lang: langPart, stem: stemPart };
    }

    var file = path.substring(path.lastIndexOf("/") + 1);
    if (!file || !/\.html$/i.test(file)) {
      return { lang: "es", stem: "index" };
    }
    return { lang: "es", stem: file.replace(/\.html$/i, "") || "index" };
  }

  function isSpanishHome() {
    var loc = parseLocation();
    return loc.lang === "es" && loc.stem === "index";
  }

  function applyFileProtocolLinks(root) {
    if (!isFileProtocol()) {
      return;
    }
    var scope = root || global.document;
    var from = parseLocation();
    scope.querySelectorAll("a[href^='/']").forEach(function (link) {
      var href = link.getAttribute("href");
      var target = parseSiteHref(href);
      if (!target) {
        return;
      }
      link.setAttribute("href", relativePathFor(from.lang, target.lang, target.stem));
    });
  }

  var pages = {};
  STEMS.forEach(function (stem) {
    pages[stem] = {
      es: pathForLang("es", stem),
      en: pathForLang("en", stem),
      fr: pathForLang("fr", stem),
    };
  });

  global.KINESICA_LANG_ROUTES = {
    stems: STEMS,
    pages: pages,
    pathForLang: pathForLang,
    relativePathFor: relativePathFor,
    parseSiteHref: parseSiteHref,
    parseLocation: parseLocation,
    isFileProtocol: isFileProtocol,
    isSpanishHome: isSpanishHome,
    isSpanishLocation: function () {
      return parseLocation().lang === "es";
    },
    applyFileProtocolLinks: applyFileProtocolLinks,
    targetForLang: function (stem, lang) {
      var routes = pages[stem];
      if (!routes) {
        return null;
      }
      return routes[lang] || null;
    },
    hrefForLang: function (stem, lang) {
      if (isFileProtocol()) {
        var from = parseLocation();
        return relativePathFor(from.lang, lang, stem);
      }
      return pathForLang(lang, stem);
    },
  };
})(window);
