(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KinesicaBookingModalAvailability = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const OFFLINE_COPY = {
    es: {
      title: "Agendá tu turno por WhatsApp",
      desc: "Comunicate directamente con nosotros para coordinar tu día y horario.",
      btn: "Escribir por WhatsApp",
    },
    en: {
      title: "Book your appointment via WhatsApp",
      desc: "Reach out to us directly to schedule your day and time.",
      btn: "Message on WhatsApp",
    },
    fr: {
      title: "Prenez rendez-vous via WhatsApp",
      desc: "Contactez-nous directement pour convenir du jour et de l'heure.",
      btn: "Écrire sur WhatsApp",
    },
    pt: {
      title: "Agende sua consulta pelo WhatsApp",
      desc: "Fale diretamente conosco para combinar o dia e horário.",
      btn: "Mensagem no WhatsApp",
    },
  };

  function resolveLang() {
    if (typeof document === "undefined") return "es";
    const lang = (document.documentElement.lang || "es").toLowerCase();
    if (lang.indexOf("en") === 0) return "en";
    if (lang.indexOf("fr") === 0) return "fr";
    if (lang.indexOf("pt") === 0) return "pt";
    return "es";
  }

  function getApiUrl() {
    if (typeof window !== "undefined") {
      if (window.__KINESICA_CONFIG__ && window.__KINESICA_CONFIG__.bookingApiUrl) {
        return window.__KINESICA_CONFIG__.bookingApiUrl;
      }
      if (window.KINESICA_SITE && window.KINESICA_SITE.bookingApiUrl) {
        return window.KINESICA_SITE.bookingApiUrl;
      }
    }
    return "";
  }

  function readCachedBookingActive() {
    try {
      const cached = JSON.parse(localStorage.getItem("kinesica_public_settings") || "null");
      if (cached && typeof cached.booking_active === "boolean") {
        return cached.booking_active;
      }
    } catch (_) {}
    return null;
  }

  function renderAvailabilityLoading(mount) {
    if (!mount) return;
    const lang = resolveLang();
    const copy = {
      es: "Consultando disponibilidad del consultorio...",
      en: "Checking appointment availability...",
      fr: "Vérification des disponibilités...",
      pt: "Consultando disponibilidade...",
    }[lang] || "Consultando disponibilidad...";

    mount.innerHTML = `
      <div class="kb-booking-loading" role="status" aria-live="polite">
        <div class="kb-spinner" aria-hidden="true"></div>
        <p class="kb-loading-text">${copy}</p>
      </div>
    `;
  }

  function resolveBookingAvailability(state, onResolved) {
    if (state.availabilityPromise) return state.availabilityPromise;
    if (typeof fetch !== "function") {
      state.bookingAvailable = true;
      return Promise.resolve(true);
    }
    state.availabilityPromise = fetch("/admin/api/settings.php", { cache: "no-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          try {
            localStorage.setItem("kinesica_public_settings", JSON.stringify(data));
          } catch (_) {}
          if (typeof data.booking_active === "boolean") {
            state.bookingAvailable = data.booking_active;
            if (typeof onResolved === "function") {
              onResolved(state.bookingAvailable);
            }
            return data.booking_active;
          }
        }
        state.bookingAvailable = true;
        return true;
      })
      .catch(() => {
        state.bookingAvailable = true;
        return true;
      });
    return state.availabilityPromise;
  }

  function whenBookingAllowed(state, action, onResolved) {
    if (state.bookingAvailable === true) {
      action();
      return;
    }
    if (state.bookingAvailable === false) {
      openWhatsAppFallback();
      return;
    }
    state.pendingOpenAction = action;
    resolveBookingAvailability(state, onResolved).then(function (active) {
      if (active && typeof state.pendingOpenAction === "function") {
        const run = state.pendingOpenAction;
        state.pendingOpenAction = null;
        run();
      } else if (!active) {
        state.pendingOpenAction = null;
        openWhatsAppFallback();
      }
    });
  }

  function getNorbertoWhatsAppHref() {
    if (typeof window !== "undefined" && typeof window.kinesicaNorbertoWhatsAppHref === "function") {
      return window.kinesicaNorbertoWhatsAppHref();
    }
    return "https://wa.me/5491124976722";
  }

  function openWhatsAppFallback() {
    if (typeof window === "undefined") return;
    const url = getNorbertoWhatsAppHref();
    window.location.href = url;
  }

  function renderOfflineFallback(mount) {
    if (!mount) return;
    const lang = resolveLang();
    const copy = OFFLINE_COPY[lang] || OFFLINE_COPY.es;
    const waHref = getNorbertoWhatsAppHref();

    mount.innerHTML = `
      <div class="kb-booking-offline" role="region" aria-label="${copy.title}">
        <div class="kb-offline-card">
          <div class="kb-offline-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3 class="kb-offline-title">${copy.title}</h3>
          <p class="kb-offline-desc">${copy.desc}</p>
          <a class="kb-offline-btn" href="${waHref}" target="_blank" rel="noopener noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            ${copy.btn}
          </a>
        </div>
      </div>
    `;
    if (typeof window !== "undefined" && typeof window.kinesicaApplyWhatsAppContact === "function") {
      window.kinesicaApplyWhatsAppContact();
    }
  }

  function getAgendarPageHref(hash) {
    hash = hash || "";
    if (typeof window !== "undefined" && window.KINESICA_LANG_ROUTES) {
      if (typeof window.KINESICA_LANG_ROUTES.isFileProtocol === "function" && window.KINESICA_LANG_ROUTES.isFileProtocol()) {
        return "agendar.html" + hash;
      }
      const lang = resolveLang();
      if (typeof window.KINESICA_LANG_ROUTES.pathForLang === "function") {
        return window.KINESICA_LANG_ROUTES.pathForLang(lang, "agendar") + hash;
      }
    }
    const lang = resolveLang();
    const prefix = lang === "es" ? "" : lang + "/";
    return prefix + "agendar.html" + hash;
  }

  return {
    OFFLINE_COPY,
    resolveLang,
    getApiUrl,
    readCachedBookingActive,
    renderAvailabilityLoading,
    resolveBookingAvailability,
    whenBookingAllowed,
    getNorbertoWhatsAppHref,
    openWhatsAppFallback,
    renderOfflineFallback,
    getAgendarPageHref,
  };
});
