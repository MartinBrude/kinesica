/**
 * Spanish base filenames → localized targets.
 * index uses index.html at site root; canonical ES home is also "/".
 */
(function (global) {
  var STEMS = [
    "index",
    "articulos",
    "atm",
    "cadenas",
    "cervicalgia",
    "lumbalgia",
    "manipulaciones",
    "neurodinamia",
    "osteopatia",
    "rpg",
  ];

  var pages = {};
  STEMS.forEach(function (stem) {
    var es = stem === "index" ? "index.html" : stem + ".html";
    pages[es] = {
      es: es,
      en: stem === "index" ? "index_en.html" : stem + "_en.html",
      fr: stem === "index" ? "index_fr.html" : stem + "_fr.html",
    };
  });

  function spanishFileFromPath() {
    var path = global.location.pathname;
    var file = path.substring(path.lastIndexOf("/") + 1);
    if (!file || file === "/") {
      return "index.html";
    }
    return file;
  }

  function isSpanishPage(file) {
    return file && !/_en\.html$/i.test(file) && !/_fr\.html$/i.test(file);
  }

  global.KINESICA_LANG_ROUTES = {
    pages: pages,
    spanishFileFromPath: spanishFileFromPath,
    isSpanishPage: isSpanishPage,
    targetForLang: function (spanishFile, lang) {
      var routes = pages[spanishFile];
      if (!routes) {
        return null;
      }
      return routes[lang] || null;
    },
  };
})(window);
