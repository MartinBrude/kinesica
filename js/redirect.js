/**
 * Redirige al idioma preferido solo si el usuario lo eligió en esta sesión.
 * El tráfico argentino (URLs en español, sin elección explícita) permanece en español.
 */
(function () {
  try {
    var routes = window.KINESICA_LANG_ROUTES;
    if (!routes || routes.isFileProtocol()) {
      return;
    }

    if (!routes.isSpanishLocation()) {
      return;
    }

    var explicit = null;
    try {
      explicit = sessionStorage.getItem("kinesica_lang_explicit");
    } catch (e) {
      return;
    }

    if (!explicit || explicit === routes.defaultLang) {
      return;
    }

    if (routes.langCodes && routes.langCodes.indexOf(explicit) === -1) {
      return;
    }

    var loc = routes.parseLocation();
    var preferred = routes.targetForLang(loc.stem, explicit);
    if (
      preferred &&
      preferred !== routes.pathForLang(routes.defaultLang, loc.stem)
    ) {
      window.location.replace(preferred);
    }
  } catch (e) {
    console.warn("Language redirect suppressed", e);
  }
})();
