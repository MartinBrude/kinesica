(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KinesicaBookingModalEvents = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function bindModalEvents(modalController, getInlineInstance) {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    window.addEventListener("hashchange", function () {
      if (window.location.hash === "#agendar" || window.location.hash === "#habitual") {
        modalController.whenBookingAllowed(function () {
          const inlineInstance = getInlineInstance();
          if (inlineInstance) {
            if (window.location.hash === "#habitual" && typeof inlineInstance.selectExistingPatient === "function") {
              inlineInstance.selectExistingPatient(true);
            }
            const mount = document.getElementById("kinesica-booking-widget");
            if (mount && typeof mount.scrollIntoView === "function") {
              mount.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          } else if (!modalController.isOpen()) {
            modalController.open({ skipHashPush: true });
          }
        });
      } else if (modalController.isOpen()) {
        modalController.close({ skipHashPush: true });
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalController.isOpen()) {
        modalController.close();
      }
    });

    document.addEventListener("click", function (e) {
      const trigger = e.target.closest && e.target.closest(
        'a[href="#agendar"], a[href$="turnos.html"], a[href$="/turnos.html"], .js-booking-open, [data-booking-open]'
      );
      if (trigger) {
        e.preventDefault();
        modalController.whenBookingAllowed(function () {
          modalController.open();
        });
      }
    });

    document.addEventListener(
      "pointerover",
      function (e) {
        const trigger = e.target.closest && e.target.closest(
          'a[href="#agendar"], a[href$="turnos.html"], a[href$="/turnos.html"], .js-booking-open, [data-booking-open]'
        );
        if (trigger) {
          modalController.prewarm();
        }
      },
      { passive: true }
    );
  }

  return {
    bindModalEvents,
  };
});
