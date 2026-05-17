/**
 * Pushes conversion-friendly events to dataLayer for GTM (container GTM-NVDTCTXM).
 *
 * In GTM, create triggers: Custom Event equals each name below.
 * Suggested GA4 event names: whatsapp_click, phone_click, maps_click.
 */
(function () {
  window.dataLayer = window.dataLayer || [];

  function pushEvent(name, detail) {
    window.dataLayer.push(
      Object.assign({ event: name }, detail || {})
    );
  }

  function closestLink(el) {
    return el && el.closest ? el.closest("a[href]") : null;
  }

  function mapsProvider(href) {
    if (!href) return "unknown";
    if (href.indexOf("waze.com") !== -1) return "waze";
    if (href.indexOf("google.com/maps") !== -1) return "google_maps";
    if (href.indexOf("maps.app.goo.gl") !== -1 || href.indexOf("goo.gl/maps") !== -1) {
      return "google_maps_app";
    }
    if (href.indexOf("maps.google") !== -1) return "google_maps";
    return "maps";
  }

  document.addEventListener(
    "click",
    function (e) {
      var link = closestLink(e.target);
      if (!link) return;

      var href = link.getAttribute("href") || "";

      if (
        link.classList.contains("dynamic-whatsapp-url") ||
        link.classList.contains("dynamic-whatsapp-link") ||
        link.id === "whatsapp-link" ||
        /wa\.me/i.test(href)
      ) {
        pushEvent("kinesica_whatsapp_click", {
          link_url: href,
          link_text: (link.getAttribute("aria-label") || link.textContent || "")
            .trim()
            .slice(0, 120),
          page_path: location.pathname,
        });
        return;
      }

      if (link.classList.contains("dynamic-tel-link") || /^tel:/i.test(href)) {
        pushEvent("kinesica_phone_click", {
          link_url: href,
          page_path: location.pathname,
        });
        return;
      }

      if (/maps\.|waze\.com/i.test(href)) {
        pushEvent("kinesica_maps_click", {
          maps_provider: mapsProvider(href),
          link_url: href,
          page_path: location.pathname,
        });
      }
    },
    true
  );
})();
