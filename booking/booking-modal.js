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
      // Auto-open si la URL contiene #agendar o ?agendar=true
      const checkInitialHash = () => {
        if (
          window.location.hash === "#agendar" ||
          window.location.hash === "#habitual" ||
          window.location.search.indexOf("agendar=true") !== -1
        ) {
          KinesicaBookingModal.open();
        }
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", checkInitialHash);
      } else {
        checkInitialHash();
      }

      // Hashchange listener para botón atrás de Android / navegador
      window.addEventListener("hashchange", function () {
        if (window.location.hash === "#agendar" || window.location.hash === "#habitual") {
          if (!KinesicaBookingModal.isOpen()) {
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

      const warm = () => KinesicaBookingModal.prewarm();
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(warm, { timeout: 2500 });
      } else {
        setTimeout(warm, 1500);
      }
    },

    isOpen() {
      return modalEl ? modalEl.classList.contains("is-open") : false;
    },

    prewarm() {
      if (typeof window === "undefined") return;
      if (widgetInstance && widgetInstance.client && typeof widgetInstance.client.prewarm === "function") {
        widgetInstance.client.prewarm();
      } else if (!window.__kinesicaPrewarmed) {
        window.__kinesicaPrewarmed = true;
        const apiUrl = getApiUrl();
        if (apiUrl) {
          try {
            fetch(`${apiUrl}?action=ping`, { method: "GET", mode: "cors", redirect: "follow", cache: "no-store" }).catch(() => {});
          } catch (e) {}
        }
      }
    },

    open(options) {
      options = options || {};
      this.prewarm();
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
