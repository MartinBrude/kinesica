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

  function getApiUrl() {
    return (
      (typeof window !== "undefined" && window.__KINESICA_CONFIG__ && window.__KINESICA_CONFIG__.bookingApiUrl) ||
      (typeof window !== "undefined" && window.KINESICA_SITE && window.KINESICA_SITE.bookingApiUrl) ||
      "https://script.google.com/macros/s/AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ/exec"
    );
  }

  function createModalDOM() {
    if (modalEl) return modalEl;

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
      const onReady = () => {
        KinesicaBookingModal.mountInlineWidget();
        if (
          window.location.hash === "#agendar" ||
          window.location.hash === "#habitual" ||
          window.location.search.indexOf("agendar=true") !== -1
        ) {
          if (inlineWidgetInstance) {
            if (window.location.hash === "#habitual" && typeof inlineWidgetInstance.selectExistingPatient === "function") {
              inlineWidgetInstance.selectExistingPatient(true);
            }
          } else {
            KinesicaBookingModal.open();
          }
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
          KinesicaBookingModal.open();
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

    mountInlineWidget() {
      if (typeof document === "undefined") return null;
      const mount = document.getElementById("kinesica-booking-widget");
      if (!mount) return null;
      if (inlineWidgetInstance && inlineWidgetInstance.container === mount) {
        return inlineWidgetInstance;
      }
      const Widget = WidgetClass || (typeof window !== "undefined" && window.KinesicaBookingWidget);
      if (!Widget) return null;
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

      try {
        const cached = JSON.parse(localStorage.getItem("kinesica_public_settings") || "null");
        if (cached && cached.practitioner_hours) {
          applyHours(cached.practitioner_hours);
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
      // 2 semanas (14 días corridos) es suficiente para cubrir la agenda inmediata
      for (let i = 0; i < 14; i += 1) {
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

      previousActiveElement = document.activeElement;

      createModalDOM();

      if (!widgetInstance) {
        const mount = document.getElementById("kinesica-modal-widget-mount");
        const Widget = WidgetClass || (typeof window !== "undefined" && window.KinesicaBookingWidget);
        if (Widget && mount) {
          widgetInstance = new Widget(mount, {
            apiUrl: getApiUrl(),
            forceMock: false,
            isModal: true,
            lang: document.documentElement.lang,
            onClose: () => KinesicaBookingModal.close(),
          });
        }
      }

      if (window.location.hash === "#habitual" && widgetInstance && typeof widgetInstance.selectExistingPatient === "function") {
        widgetInstance.selectExistingPatient(true);
      }

      modalEl.classList.add("is-open");
      modalEl.setAttribute("aria-hidden", "false");
      document.body.classList.add("kinesica-booking-modal-open");

      if (!options.skipHashPush) {
        try {
          if (window.location.hash !== "#agendar" && window.location.hash !== "#habitual") {
            history.pushState(null, "", "#agendar");
          }
        } catch (e) {
          window.location.hash = "agendar";
        }
      }

      // Enfocar el modal o el primer elemento interactivo
      const closeBtn = modalEl.querySelector('[data-action="close-modal"]');
      if (closeBtn && typeof closeBtn.focus === "function") {
        closeBtn.focus();
      }
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
