/**
 * Conversion events → dataLayer (GTM Preview) + GA4 via gtag.
 *
 * Events: whatsapp_click, phone_click, maps_click.
 * Also pushes kinesica_* to dataLayer for optional GTM Custom Event tags.
 *
 * GTM: pause the legacy Link Click → "clic whatsapp" (wa.me) tag to avoid
 * counting WhatsApp twice (legacy name + whatsapp_click).
 *
 * IDs: scripts/site-analytics.mjs → js/site-config.js (KINESICA_SITE).
 */
(function () {
  window.dataLayer = window.dataLayer || [];

  var GA4_EVENTS = {
    kinesica_whatsapp_click: "whatsapp_click",
    kinesica_phone_click: "phone_click",
    kinesica_maps_click: "maps_click",
  };

  function ga4Id() {
    var site = window.KINESICA_SITE;
    return (site && site.ga4MeasurementId) || "G-T5WJMBPGJ3";
  }

  function ensureGtagFn() {
    if (typeof window.gtag === "function") return;
    window.__KINESICA_GTAG_STUB = true;
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }

  function hasRealGtag() {
    return typeof window.gtag === "function" && !window.__KINESICA_GTAG_STUB;
  }

  function sendGa4(name, params) {
    if (hasRealGtag() || window.__KINESICA_GA4_CONFIGURED) {
      window.gtag("event", name, params);
      return;
    }

    ensureGtagFn();

    function fire() {
      window.gtag("event", name, params);
    }

    if (window.__KINESICA_GTAG_LOADING) {
      var tries = 0;
      var wait = setInterval(function () {
        tries += 1;
        if (window.__KINESICA_GA4_CONFIGURED || hasRealGtag()) {
          clearInterval(wait);
          fire();
        } else if (tries > 40) {
          clearInterval(wait);
        }
      }, 50);
      return;
    }

    window.__KINESICA_GTAG_LOADING = true;
    var id = ga4Id();
    var s = document.createElement("script");
    s.async = true;
    s.src =
      "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    s.onload = function () {
      window.__KINESICA_GTAG_STUB = false;
      window.gtag("js", new Date());
      // Page views already come from GTM's Google Tag.
      window.gtag("config", id, { send_page_view: false });
      window.__KINESICA_GA4_CONFIGURED = true;
      fire();
    };
    s.onerror = function () {
      window.__KINESICA_GTAG_LOADING = false;
    };
    document.head.appendChild(s);
  }

  function pageLanguage() {
    var path = location.pathname || "";
    if (path === "/en" || path.indexOf("/en/") === 0) return "en";
    if (path === "/fr" || path.indexOf("/fr/") === 0) return "fr";
    if (path === "/pt" || path.indexOf("/pt/") === 0) return "pt";
    return "es";
  }

  function pushEvent(name, detail) {
    var params = Object.assign(
      {
        page_path: location.pathname,
        page_language: pageLanguage(),
      },
      detail || {}
    );

    window.dataLayer.push(Object.assign({ event: name }, params));

    var ga4Name = GA4_EVENTS[name];
    if (ga4Name) sendGa4(ga4Name, params);
  }

  function closestLink(el) {
    return el && el.closest ? el.closest("a[href]") : null;
  }

  function mapsProvider(href) {
    if (!href) return "unknown";
    if (href.indexOf("waze.com") !== -1) return "waze";
    if (href.indexOf("google.com/maps") !== -1) return "google_maps";
    if (
      href.indexOf("maps.app.goo.gl") !== -1 ||
      href.indexOf("goo.gl/maps") !== -1
    ) {
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
        });
        return;
      }

      if (link.classList.contains("dynamic-tel-link") || /^tel:/i.test(href)) {
        pushEvent("kinesica_phone_click", {
          link_url: href,
        });
        return;
      }

      if (/maps\.|waze\.com/i.test(href)) {
        pushEvent("kinesica_maps_click", {
          maps_provider: mapsProvider(href),
          link_url: href,
        });
      }
    },
    true
  );
})();
