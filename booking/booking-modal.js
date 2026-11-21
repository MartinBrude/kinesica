/**
 * Kinésica - Modal de Reservas Online
 * =====================================
 * Controlador del diálogo modal accesible para agendar turnos in-page.
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-widget"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-widget"));
  } else {
    root.KinesicaBookingModal = factory(root.KinesicaBookingWidget);
  }
})(typeof self !== "undefined" ? self : this, function (WidgetClass) {
  "use strict";

  let modalEl = null;
  let widgetInstance = null;
  let inlineWidgetInstance = null;
  let previousActiveElement = null;
  let bookingAvailable = null;
  let availabilityPromise = null;
  let pendingOpenAction = null;

  const OFFLINE_COPY = {
    es: {
      title: "La reserva online no está disponible ahora",
      text: "Escribile por WhatsApp al Lic. Norberto Brude y te ayuda a sacar turno.",
      btn: "WhatsApp a Norberto",
    },
    en: {
      title: "Online booking is unavailable right now",
      text: "Message Lic. Norberto Brude on WhatsApp and he will help you book.",
      btn: "WhatsApp Norberto",
    },
    fr: {
      title: "La réservation en ligne n'est pas disponible pour le moment",
      text: "Écrivez au Lic. Norberto Brude sur WhatsApp pour prendre rendez-vous.",
      btn: "WhatsApp Norberto",
    },
    pt: {
      title: "O agendamento online não está disponível agora",
      text: "Fale no WhatsApp com o Lic. Norberto Brude para agendar.",
      btn: "WhatsApp Norberto",
    },
  };

  function resolveLang() {
    const lang = String(
      (typeof document !== "undefined" && document.documentElement.lang) || "es"
    ).toLowerCase();
    if (lang.indexOf("en") === 0) return "en";
    if (lang.indexOf("fr") === 0) return "fr";
    if (lang.indexOf("pt") === 0) return "pt";
    return "es";
  }

  function getApiUrl() {
    return (
      (typeof window !== "undefined" && window.__KINESICA_CONFIG__ && window.__KINESICA_CONFIG__.bookingApiUrl) ||
      (typeof window !== "undefined" && window.KINESICA_SITE && window.KINESICA_SITE.bookingApiUrl) ||
      "https://script.google.com/macros/s/AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ/exec"
    );
  }

  function readCachedBookingActive() {
    try {
      const cached = JSON.parse(localStorage.getItem("kinesica_public_settings") || "null");
      if (cached && typeof cached.booking_active !== "undefined") {
        return Boolean(cached.booking_active);
      }
    } catch (_) {}
    return null;
  }

  function renderAvailabilityLoading(mount) {
    if (!mount) return;
    const lang = resolveLang();
    const label =
      lang === "en"
        ? "Checking online booking…"
        : lang === "fr"
          ? "Vérification de la réservation en ligne…"
          : lang === "pt"
            ? "Verificando agendamento online…"
            : "Comprobando reserva online…";
    mount.innerHTML = `<div class="kb-booking-loading" role="status" aria-live="polite">${label}</div>`;
    inlineWidgetInstance = null;
  }

  /**
   * Resuelve booking_active antes de montar/abrir.
   * Evita flash del widget cuando booking está off y aún no llegó settings.php.
   */
  function resolveBookingAvailability() {
    if (bookingAvailable !== null) {
      return Promise.resolve(bookingAvailable);
    }
    const cached = readCachedBookingActive();
    if (cached !== null) {
      bookingAvailable = cached;
      return Promise.resolve(bookingAvailable);
    }
    if (availabilityPromise) return availabilityPromise;
    availabilityPromise = (typeof fetch === "function"
      ? fetch("/admin/api/settings.php", { cache: "no-cache" })
          .then(function (res) {
            return res.ok ? res.json() : null;
          })
          .catch(function () {
            return null;
          })
      : Promise.resolve(null)
    )
      .then(function (data) {
        if (data && typeof data.booking_active !== "undefined") {
          bookingAvailable = Boolean(data.booking_active);
        } else {
          // Si settings no responde, no bloquear la turnera.
          bookingAvailable = true;
        }
        return bookingAvailable;
      })
      .finally(function () {
        availabilityPromise = null;
      });
    return availabilityPromise;
  }

  function whenBookingAllowed(action) {
    if (bookingAvailable === false) {
      openWhatsAppFallback();
      return;
    }
    if (bookingAvailable === true) {
      if (typeof action === "function") action();
      return;
    }
    pendingOpenAction = action;
    resolveBookingAvailability().then(function (active) {
      const cb = pendingOpenAction;
      pendingOpenAction = null;
      if (!active) {
        openWhatsAppFallback();
        return;
      }
      if (typeof cb === "function") cb();
    });
  }

  /** Always Norberto — never Clara (activeWhatsappDigits). Clara redirects back to the site. */
  function getNorbertoWhatsAppHref() {
    const site = (typeof window !== "undefined" && window.KINESICA_SITE) || {};
    const cfg = site.contact || {};
    const digits = String(cfg.whatsappDigits || "5491161564311").replace(/\D/g, "");
    return "https://wa.me/" + digits;
  }

  function openWhatsAppFallback() {
    const href = getNorbertoWhatsAppHref();
    try {
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (_) {
      window.location.href = href;
    }
  }

  function renderOfflineFallback(mount) {
    if (!mount) return;
    const copy = OFFLINE_COPY[resolveLang()] || OFFLINE_COPY.es;
    mount.innerHTML = `
      <div class="kb-booking-offline" role="status">
        <h2 class="kb-booking-offline-title">${copy.title}</h2>
        <p class="kb-booking-offline-text">${copy.text}</p>
        <a class="kb-btn kb-btn-whatsapp kb-btn-whatsapp-primary js-norberto-whatsapp" href="${getNorbertoWhatsAppHref()}" target="_blank" rel="noopener noreferrer">${copy.btn}</a>
      </div>
    `;
    inlineWidgetInstance = null;
    if (typeof window.kinesicaApplyWhatsAppContact === "function") {
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

  function ensureBookingWidgetCssLoaded() {
    if (typeof document === "undefined") return;
    if (document.querySelector('link[href*="booking-widget"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    const lang = resolveLang();
    const prefix = lang === "es" ? "" : "../";
    link.href = prefix + "booking/booking-widget.min.css";
    document.head.appendChild(link);
  }

  function createModalDOM() {
    if (modalEl) return modalEl;

    ensureBookingWidgetCssLoaded();

    modalEl = document.createElement("div");
    modalEl.id = "kinesica-booking-modal";
    modalEl.className = "kinesica-booking-modal-overlay";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    const lang = (document.documentElement.lang || "es").toLowerCase();
    const aria = lang.indexOf("en") === 0 ? "Book" : lang.indexOf("fr") === 0 ? "Réserver" : lang.indexOf("pt") === 0 ? "Agendar" : "Agendar";
    modalEl.setAttribute("aria-label", aria);
    modalEl.setAttribute("aria-hidden", "true");

    modalEl.innerHTML = `
      <div class="kinesica-booking-modal-backdrop" data-action="close-modal"></div>
      <div class="kinesica-booking-modal-dialog">
        <div class="kinesica-booking-modal-body">
          <div id="kinesica-modal-widget-mount"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Click en backdrop para cerrar
    modalEl.addEventListener("click", function (e) {
      if (
        e.target === modalEl ||
        (e.target.dataset && e.target.dataset.action === "close-modal") ||
        (e.target.closest && e.target.closest('[data-action="close-modal"]'))
      ) {
        e.preventDefault();
        KinesicaBookingModal.close();
      }
    });

    return modalEl;
  }

  const KinesicaBookingModal = {
    init() {
      const cachedActive = readCachedBookingActive();
      if (cachedActive !== null) {
        bookingAvailable = cachedActive;
      }

      const onReady = () => {
        KinesicaBookingModal.mountInlineWidget();
        if (
          window.location.hash === "#agendar" ||
          window.location.hash === "#habitual" ||
          window.location.search.indexOf("agendar=true") !== -1
        ) {
          whenBookingAllowed(function () {
            if (inlineWidgetInstance) {
              if (window.location.hash === "#habitual" && typeof inlineWidgetInstance.selectExistingPatient === "function") {
                inlineWidgetInstance.selectExistingPatient(true);
              }
            } else {
              KinesicaBookingModal.open();
            }
          });
        }
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", onReady);
      } else {
        onReady();
      }

      // Hashchange listener para botón atrás de Android / navegador
      window.addEventListener("hashchange", function () {
        if (window.location.hash === "#agendar" || window.location.hash === "#habitual") {
          whenBookingAllowed(function () {
            if (inlineWidgetInstance) {
              if (window.location.hash === "#habitual" && typeof inlineWidgetInstance.selectExistingPatient === "function") {
                inlineWidgetInstance.selectExistingPatient(true);
              }
              const mount = document.getElementById("kinesica-booking-widget");
              if (mount && typeof mount.scrollIntoView === "function") {
                mount.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            } else if (!KinesicaBookingModal.isOpen()) {
              KinesicaBookingModal.open({ skipHashPush: true });
            }
          });
        } else if (KinesicaBookingModal.isOpen()) {
          KinesicaBookingModal.close({ skipHashPush: true });
        }
      });

      // Escape key
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && KinesicaBookingModal.isOpen()) {
          KinesicaBookingModal.close();
        }
      });

      // Delegación de clics en toda la página para abrir el modal
      document.addEventListener("click", function (e) {
        const trigger = e.target.closest && e.target.closest(
          'a[href="#agendar"], a[href$="turnos.html"], a[href$="/turnos.html"], .js-booking-open, [data-booking-open]'
        );
        if (trigger) {
          e.preventDefault();
          whenBookingAllowed(function () {
            KinesicaBookingModal.open();
          });
        }
      });

      // Precalentamiento al pasar el cursor o posar el dedo sobre el botón de reserva
      document.addEventListener(
        "pointerover",
        function (e) {
          const trigger = e.target.closest && e.target.closest(
            'a[href="#agendar"], a[href$="turnos.html"], a[href$="/turnos.html"], .js-booking-open, [data-booking-open]'
          );
          if (trigger) {
            KinesicaBookingModal.prewarm();
          }
        },
        { passive: true }
      );

      KinesicaBookingModal.ensurePreconnect();
      KinesicaBookingModal.syncPractitionerHours().finally(() => {
        KinesicaBookingModal.warmAgenda();
      });
    },

    applyBookingAvailability(active) {
      bookingAvailable = Boolean(active);
      const mount = typeof document !== "undefined" ? document.getElementById("kinesica-booking-widget") : null;
      if (!mount) return;
      if (!bookingAvailable) {
        if (KinesicaBookingModal.isOpen()) {
          KinesicaBookingModal.close({ skipHashPush: true });
        }
        renderOfflineFallback(mount);
        return;
      }
      if (!inlineWidgetInstance || mount.querySelector(".kb-booking-offline")) {
        mount.innerHTML = "";
        inlineWidgetInstance = null;
        KinesicaBookingModal.mountInlineWidget();
      }
    },

    mountInlineWidget() {
      if (typeof document === "undefined") return null;
      const mount = document.getElementById("kinesica-booking-widget");
      if (!mount) return null;
      if (bookingAvailable === null) {
        renderAvailabilityLoading(mount);
        resolveBookingAvailability().then(function () {
          KinesicaBookingModal.mountInlineWidget();
        });
        return null;
      }
      if (bookingAvailable === false) {
        renderOfflineFallback(mount);
        return null;
      }
      if (inlineWidgetInstance && inlineWidgetInstance.container === mount) {
        return inlineWidgetInstance;
      }
      const Widget = WidgetClass || (typeof window !== "undefined" && window.KinesicaBookingWidget);
      if (!Widget) return null;
      mount.innerHTML = "";
      inlineWidgetInstance = new Widget(mount, {
        apiUrl: getApiUrl(),
        forceMock: false,
        isModal: false,
        lang: document.documentElement.lang,
      });
      return inlineWidgetInstance;
    },

    syncPractitionerHours() {
      if (typeof window === "undefined") return Promise.resolve();
      const applyHours = (hours) => {
        if (
          hours &&
          window.KinesicaBookingEngine &&
          typeof window.KinesicaBookingEngine.setPractitionerHours === "function"
        ) {
          window.KinesicaBookingEngine.setPractitionerHours(hours);
        }
      };
      const applyFees = (fees) => {
        if (
          fees &&
          window.KinesicaBookingEngine &&
          typeof window.KinesicaBookingEngine.setRuntimeFees === "function"
        ) {
          window.KinesicaBookingEngine.setRuntimeFees(fees);
        }
        if (inlineWidgetInstance && typeof inlineWidgetInstance.updateFees === "function") {
          inlineWidgetInstance.updateFees(fees);
        }
        if (widgetInstance && typeof widgetInstance.updateFees === "function") {
          widgetInstance.updateFees(fees);
        }
      };

      try {
        const cached = JSON.parse(localStorage.getItem("kinesica_public_settings") || "null");
        if (cached && cached.practitioner_hours) {
          applyHours(cached.practitioner_hours);
        }
        if (cached && cached.fees) {
          applyFees(cached.fees);
        }
      } catch (_) {}

      if (typeof fetch !== "function") return Promise.resolve();
      return fetch("/admin/api/settings.php", { cache: "no-cache" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data === "object") {
            try {
              localStorage.setItem("kinesica_public_settings", JSON.stringify(data));
            } catch (_) {}
            if (data.practitioner_hours) {
              applyHours(data.practitioner_hours);
            }
            if (data.fees) {
              applyFees(data.fees);
            }
          }
        })
        .catch(() => {});
    },

    invalidateCache() {
      if (inlineWidgetInstance && inlineWidgetInstance.client && typeof inlineWidgetInstance.client.clearCache === "function") {
        inlineWidgetInstance.client.clearCache();
      }
      if (widgetInstance && widgetInstance.client && typeof widgetInstance.client.clearCache === "function") {
        widgetInstance.client.clearCache();
      } else if (
        typeof window !== "undefined" &&
        window.KinesicaBookingClient &&
        typeof window.KinesicaBookingClient.clearStoredRange === "function"
      ) {
        window.KinesicaBookingClient.clearStoredRange();
      }
    },

    ensurePreconnect() {
      if (typeof document === "undefined") return;
      const origins = ["https://script.google.com", "https://script.googleusercontent.com"];
      origins.forEach((href) => {
        if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
          const link = document.createElement("link");
          link.rel = "preconnect";
          link.href = href;
          if (href.includes("googleusercontent")) link.crossOrigin = "anonymous";
          document.head.appendChild(link);
        }
      });
    },

    warmAgenda() {
      const ClientModule = typeof window !== "undefined" ? window.KinesicaBookingClient : null;
      const ClientConstructor =
        ClientModule && typeof ClientModule.BookingClient === "function"
          ? ClientModule.BookingClient
          : typeof ClientModule === "function"
          ? ClientModule
          : null;
      if (!ClientConstructor) {
        this.prewarm();
        return;
      }
      const dates = [];
      const start = new Date();
      // 45 días corridos para cubrir el carrusel completo incluso cuando el profesional atiende menos días por semana
      for (let i = 0; i < 45; i += 1) {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const y = day.getFullYear();
        const m = String(day.getMonth() + 1).padStart(2, "0");
        const d = String(day.getDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${d}`);
      }
      const client = new ClientConstructor({ apiUrl: getApiUrl() });
      if (client && typeof client.getSlotsRange === "function") {
        client.getSlotsRange(dates);
      }
    },

    isOpen() {
      return modalEl ? modalEl.classList.contains("is-open") : false;
    },

    prewarm() {
      if (typeof window === "undefined") return;
      if (window.__kinesicaSlotsRangePromise) return;
      if (inlineWidgetInstance && inlineWidgetInstance.client && typeof inlineWidgetInstance.client.prewarm === "function") {
        inlineWidgetInstance.client.prewarm();
        return;
      }
      if (widgetInstance && widgetInstance.client && typeof widgetInstance.client.prewarm === "function") {
        widgetInstance.client.prewarm();
        return;
      }
      const now = Date.now();
      if (window.__kinesicaPrewarmAt && now - window.__kinesicaPrewarmAt < 90000) return;
      window.__kinesicaPrewarmAt = now;
      const apiUrl = getApiUrl();
      if (!apiUrl) return;
      try {
        fetch(`${apiUrl}?action=ping`, { method: "GET", mode: "cors", redirect: "follow", cache: "no-store" }).catch(() => {});
      } catch (e) {}
    },

    open(options) {
      options = options || {};
      if (bookingAvailable === null) {
        whenBookingAllowed(function () {
          KinesicaBookingModal.open(options);
        });
        return;
      }
      if (bookingAvailable === false) {
        openWhatsAppFallback();
        return;
      }
      this.syncPractitionerHours();
      this.prewarm();

      const inlineMount = typeof document !== "undefined" ? document.getElementById("kinesica-booking-widget") : null;
      if (inlineMount) {
        this.mountInlineWidget();
        if (window.location.hash === "#habitual" && inlineWidgetInstance && typeof inlineWidgetInstance.selectExistingPatient === "function") {
          inlineWidgetInstance.selectExistingPatient(true);
        }
        if (typeof inlineMount.scrollIntoView === "function") {
          inlineMount.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }

      // Si no hay widget inline en la página actual, redirigir a la página dedicada de agendar
      const hash =
        typeof window !== "undefined" && window.location.hash === "#habitual"
          ? "#habitual"
          : "";
      if (typeof window !== "undefined") {
        window.location.href = getAgendarPageHref(hash);
      }
      return;
    },

    close(options) {
      if (!modalEl || !modalEl.classList.contains("is-open")) return;
      options = options || {};

      modalEl.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("kinesica-booking-modal-open");

      if (widgetInstance && typeof widgetInstance.reset === "function") {
        widgetInstance.reset();
      }
      const dialog = modalEl.querySelector(".kinesica-booking-modal-dialog");
      if (dialog) dialog.scrollTop = 0;
      const body = modalEl.querySelector(".kinesica-booking-modal-body");
      if (body) body.scrollTop = 0;

      if (!options.skipHashPush) {
        if (window.location.hash === "#agendar" || window.location.hash === "#habitual") {
          try {
            history.replaceState(null, "", window.location.pathname + window.location.search);
          } catch (e) {
            window.location.hash = "";
          }
        }
      }

      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        try {
          previousActiveElement.focus();
        } catch (e) {}
      }
    },
  };

  KinesicaBookingModal.init();

  return KinesicaBookingModal;
});
