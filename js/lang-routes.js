/**
 * Page stems → localized paths (/, /en/…, /fr/…).
 * AUTO-GENERATED — edit scripts/languages.mjs + npm run build:lang-routes
 */
(function (global) {
  var DEFAULT_LANG = "es";
  var SUBDIRS = ["en","fr","pt"];
  var LANG_CODES = ["es","en","fr","pt"];
  var LANGS = [
  {
    "code": "es",
    "nativeName": "Español",
    "hreflang": "es-AR",
    "urlPrefix": "",
    "isDefault": true
  },
  {
    "code": "en",
    "nativeName": "English",
    "hreflang": "en",
    "urlPrefix": "en",
    "isDefault": false
  },
  {
    "code": "fr",
    "nativeName": "Français",
    "hreflang": "fr",
    "urlPrefix": "fr",
    "isDefault": false
  },
  {
    "code": "pt",
    "nativeName": "Português",
    "hreflang": "pt",
    "urlPrefix": "pt",
    "isDefault": false
  }
];
  var STEMS = ["index","articulos","atm","acupuntura","cadenas","cv","404","manipulaciones","neurodinamia","osteopatia","kinesiologia","posturologia-clinica","rpg","cefalea","dorsalgia","lumbalgia","ciatalgia","cervicobraquialgia","pubalgia","gonalgia","talalgia","dolor-sacriiliaco","hernia-disco","protrusion-discal","hipercifosis","hiperlordosis","dorso-plano","genu-valgo","genu-varo","pies-planos","escoliosis","epicondilitis-lateral","epicondilitis-medial","impingement-subacromial","manguito-rotador","radiculopatia","meniscopatia","fascitis-plantar","cervicalgia"];

  function langEntry(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i].code === code) {
        return LANGS[i];
      }
    }
    return null;
  }

  function isDefaultLang(code) {
    var entry = langEntry(code);
    return entry ? entry.isDefault : code === DEFAULT_LANG;
  }

  function isFileProtocol() {
    return global.location.protocol === "file:";
  }

  function pathForLang(lang, stem) {
    var entry = langEntry(lang);
    if (!entry || entry.isDefault) {
      return stem === "index" ? "/" : "/" + stem + ".html";
    }
    return stem === "index"
      ? "/" + entry.urlPrefix + "/"
      : "/" + entry.urlPrefix + "/" + stem + ".html";
  }

  function relativePathFor(fromLang, toLang, stem) {
    var file = stem === "index" ? "index.html" : stem + ".html";
    if (isDefaultLang(fromLang)) {
      if (isDefaultLang(toLang)) {
        return file;
      }
      var toEntry = langEntry(toLang);
      return (toEntry && toEntry.urlPrefix ? toEntry.urlPrefix : toLang) + "/" + file;
    }
    if (fromLang === toLang) {
      return file;
    }
    if (isDefaultLang(toLang)) {
      return "../" + file;
    }
    var toPrefix = langEntry(toLang);
    return "../" + (toPrefix && toPrefix.urlPrefix ? toPrefix.urlPrefix : toLang) + "/" + file;
  }

  function parseSiteHref(href) {
    if (!href || href.charAt(0) !== "/") {
      return null;
    }
    if (href === "/" || href === "/index.html") {
      return { lang: DEFAULT_LANG, stem: "index" };
    }
    var i;
    for (i = 0; i < SUBDIRS.length; i++) {
      var sub = SUBDIRS[i];
      var indexPath = "/" + sub + "/";
      var indexFile = "/" + sub + "/index.html";
      if (href === indexPath || href === indexFile) {
        return { lang: sub, stem: "index" };
      }
      var re = new RegExp("^/" + sub + "/([^/?#]+)\\.html$");
      var m = href.match(re);
      if (m) {
        return { lang: sub, stem: m[1] };
      }
    }
    var rootMatch = href.match(/^\/([^/?#]+)\.html$/);
    if (rootMatch) {
      return { lang: DEFAULT_LANG, stem: rootMatch[1] };
    }
    return null;
  }

  /** Infer target language from a lang-picker href (absolute or file:// relative). */
  function langFromHref(href) {
    if (!href) {
      return null;
    }
    var parsed = parseSiteHref(href);
    if (parsed) {
      return parsed.lang;
    }
    if (href === "index.html") {
      return parseLocation().lang;
    }
    if (/^(?:\.\.\/)+index\.html$/.test(href)) {
      return DEFAULT_LANG;
    }
    var j;
    for (j = 0; j < SUBDIRS.length; j++) {
      var sub = SUBDIRS[j];
      if (
        new RegExp("^(?:\\.\\./)+" + sub + "/").test(href) ||
        new RegExp("^" + sub + "/").test(href)
      ) {
        return sub;
      }
    }
    if (/^(?:\.\.\/)+/.test(href)) {
      return DEFAULT_LANG;
    }
    var from = parseLocation().lang;
    if (SUBDIRS.indexOf(from) !== -1 && href.indexOf("..") === -1) {
      return from;
    }
    return DEFAULT_LANG;
  }

  function parseLocation() {
    var path = global.location.pathname;

    var k;
    for (k = 0; k < SUBDIRS.length; k++) {
      var lang = SUBDIRS[k];
      if (path === "/" + lang || path === "/" + lang + "/") {
        return { lang: lang, stem: "index" };
      }
    }

    for (k = 0; k < SUBDIRS.length; k++) {
      lang = SUBDIRS[k];
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
    if (parts.length && SUBDIRS.indexOf(parts[0]) !== -1) {
      var langPart = parts[0];
      var filePart = parts[1] || "index.html";
      var stemPart = filePart.replace(/\.html$/i, "") || "index";
      return { lang: langPart, stem: stemPart };
    }

    var baseFile = path.substring(path.lastIndexOf("/") + 1);
    if (!baseFile || !/\.html$/i.test(baseFile)) {
      return { lang: DEFAULT_LANG, stem: "index" };
    }
    return {
      lang: DEFAULT_LANG,
      stem: baseFile.replace(/\.html$/i, "") || "index",
    };
  }

  function isSpanishHome() {
    var loc = parseLocation();
    return isDefaultLang(loc.lang) && loc.stem === "index";
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
      link.setAttribute(
        "href",
        relativePathFor(from.lang, target.lang, target.stem),
      );
    });
  }

  var pages = {};
  STEMS.forEach(function (stem) {
    pages[stem] = {};
    LANG_CODES.forEach(function (lang) {
      pages[stem][lang] = pathForLang(lang, stem);
    });
  });

  global.KINESICA_LANG_ROUTES = {
    defaultLang: DEFAULT_LANG,
    subdirs: SUBDIRS,
    langCodes: LANG_CODES,
    langs: LANGS,
    stems: STEMS,
    pages: pages,
    pathForLang: pathForLang,
    relativePathFor: relativePathFor,
    parseSiteHref: parseSiteHref,
    langFromHref: langFromHref,
    parseLocation: parseLocation,
    isFileProtocol: isFileProtocol,
    isSpanishHome: isSpanishHome,
    isSpanishLocation: function () {
      return isDefaultLang(parseLocation().lang);
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
    nativeName: function (code) {
      var entry = langEntry(code);
      return entry ? entry.nativeName : code;
    },
  };
})(window);
