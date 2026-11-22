(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([
      "./booking-widget",
      "./booking-modal-availability",
      "./booking-modal-agenda",
      "./booking-modal-events",
    ], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-widget"),
      require("./booking-modal-availability"),
      require("./booking-modal-agenda"),
      require("./booking-modal-events")
    );
  } else {
    root.KinesicaBookingModal = factory(
      root.KinesicaBookingWidget,
      root.KinesicaBookingModalAvailability,
      root.KinesicaBookingModalAgenda,
      root.KinesicaBookingModalEvents
    );
  }
})(typeof self !== "undefined" ? self : this, function (WidgetClass, availability, agenda, eventsModule) {
  "use strict";

  const avail = availability || (typeof window !== "undefined" && window.KinesicaBookingModalAvailability) || {};
  const ag = agenda || (typeof window !== "undefined" && window.KinesicaBookingModalAgenda) || {};
  const ev = eventsModule || (typeof window !== "undefined" && window.KinesicaBookingModalEvents) || {};

  let modalEl = null;
  let inlineWidgetInstance = null;

  const state = {
    bookingAvailable: null,
    availabilityPromise: null,
    pendingOpenAction: null,
  };

  const KinesicaBookingModal = {
    init() {
      const cachedActive = avail.readCachedBookingActive ? avail.readCachedBookingActive() : null;
      if (cachedActive !== null) {
        state.bookingAvailable = cachedActive;
      }

      const onReady = () => {
        KinesicaBookingModal.mountInlineWidget();
        if (
          window.location.hash === "#agendar" ||
          window.location.hash === "#habitual" ||
          window.location.search.indexOf("agendar=true") !== -1
        ) {
          KinesicaBookingModal.whenBookingAllowed(function () {
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

      if (typeof ev.bindModalEvents === "function") {
        ev.bindModalEvents(KinesicaBookingModal, () => inlineWidgetInstance);
      }

      KinesicaBookingModal.ensurePreconnect();
      KinesicaBookingModal.syncPractitionerHours().finally(() => {
        KinesicaBookingModal.warmAgenda();
      });
    },

    whenBookingAllowed(action) {
      if (typeof avail.whenBookingAllowed === "function") {
        avail.whenBookingAllowed(state, action, (active) => {
          KinesicaBookingModal.applyBookingAvailability(active);
        });
      } else {
        action();
      }
    },

    applyBookingAvailability(active) {
      state.bookingAvailable = Boolean(active);
      const mount = typeof document !== "undefined" ? document.getElementById("kinesica-booking-widget") : null;
      if (!mount) return;
      if (!state.bookingAvailable) {
        if (KinesicaBookingModal.isOpen()) {
          KinesicaBookingModal.close({ skipHashPush: true });
        }
        if (typeof avail.renderOfflineFallback === "function") {
          avail.renderOfflineFallback(mount);
        }
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
      if (state.bookingAvailable === null) {
        if (typeof avail.renderAvailabilityLoading === "function") {
          avail.renderAvailabilityLoading(mount);
        }
        if (typeof avail.resolveBookingAvailability === "function") {
          avail.resolveBookingAvailability(state, (active) => {
            KinesicaBookingModal.applyBookingAvailability(active);
          }).then(function () {
            KinesicaBookingModal.mountInlineWidget();
          });
        }
        return null;
      }
      if (state.bookingAvailable === false) {
        if (typeof avail.renderOfflineFallback === "function") {
          avail.renderOfflineFallback(mount);
        }
        return null;
      }
      if (inlineWidgetInstance && inlineWidgetInstance.container === mount) {
        return inlineWidgetInstance;
      }
      const Widget = WidgetClass || (typeof window !== "undefined" && window.KinesicaBookingWidget);
      if (!Widget) return null;
      mount.innerHTML = "";
      inlineWidgetInstance = new Widget(mount, {
        apiUrl: typeof avail.getApiUrl === "function" ? avail.getApiUrl() : "",
        forceMock: false,
        isModal: false,
        lang: document.documentElement.lang,
      });
      return inlineWidgetInstance;
    },

    syncPractitionerHours() {
      if (typeof ag.syncPractitionerHours === "function") {
        return ag.syncPractitionerHours(inlineWidgetInstance);
      }
      return Promise.resolve();
    },

    invalidateCache() {
      if (typeof ag.invalidateCache === "function") {
        ag.invalidateCache(inlineWidgetInstance);
      }
    },

    ensurePreconnect() {
      if (typeof ag.ensurePreconnect === "function") {
        ag.ensurePreconnect();
      }
    },

    warmAgenda() {
      if (typeof ag.warmAgenda === "function") {
        ag.warmAgenda(() => KinesicaBookingModal.prewarm());
      }
    },

    isOpen() {
      return modalEl ? modalEl.classList.contains("is-open") : false;
    },

    prewarm() {
      if (typeof ag.prewarm === "function") {
        ag.prewarm(inlineWidgetInstance);
      }
    },

    open(options) {
      options = options || {};
      if (state.bookingAvailable === null) {
        KinesicaBookingModal.whenBookingAllowed(function () {
          KinesicaBookingModal.open(options);
        });
        return;
      }
      if (state.bookingAvailable === false) {
        if (typeof avail.openWhatsAppFallback === "function") {
          avail.openWhatsAppFallback();
        }
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

      const hash =
        typeof window !== "undefined" && window.location.hash === "#habitual"
          ? "#habitual"
          : "";
      if (typeof window !== "undefined") {
        const target = typeof avail.getAgendarPageHref === "function"
          ? avail.getAgendarPageHref(hash)
          : "agendar.html" + hash;
        window.location.href = target;
      }
    },

    close(options) {
      if (!modalEl || !modalEl.classList.contains("is-open")) return;
      options = options || {};
      modalEl.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("kinesica-booking-modal-open");
      const dialog = modalEl.querySelector(".kinesica-booking-modal-dialog");
      if (dialog) dialog.scrollTop = 0;
      const body = modalEl.querySelector(".kinesica-booking-modal-body");
      if (body) body.scrollTop = 0;
      if (!options.skipHashPush && (window.location.hash === "#agendar" || window.location.hash === "#habitual")) {
        try {
          history.replaceState(null, "", window.location.pathname + window.location.search);
        } catch (e) {
          window.location.hash = "";
        }
      }
    },
  };

  KinesicaBookingModal.init();

  return KinesicaBookingModal;
});
