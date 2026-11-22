(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-modal-availability"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-modal-availability"));
  } else {
    root.KinesicaBookingModalAgenda = factory(root.KinesicaBookingModalAvailability);
  }
})(typeof self !== "undefined" ? self : this, function (availability) {
  "use strict";

  const getApiUrl = availability ? availability.getApiUrl : function () { return ""; };

  function syncPractitionerHours(inlineWidgetInstance) {
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
    };

    const applyOverrides = (ovs) => {
      if (typeof window !== "undefined" && window.KinesicaBookingEngine?.setScheduleOverrides) {
        window.KinesicaBookingEngine.setScheduleOverrides(ovs);
      }
      if (inlineWidgetInstance && typeof inlineWidgetInstance.renderTechniqueChoices === "function") {
        inlineWidgetInstance.renderTechniqueChoices();
      }
      if (inlineWidgetInstance && typeof inlineWidgetInstance.renderExistingPractitionerChoices === "function") {
        inlineWidgetInstance.renderExistingPractitionerChoices();
      }
      if (inlineWidgetInstance && typeof inlineWidgetInstance.syncStep1Continue === "function") {
        inlineWidgetInstance.syncStep1Continue();
      }
    };

    try {
      const cached = JSON.parse(localStorage.getItem("kinesica_public_settings") || "null");
      if (cached && cached.practitioner_hours) {
        applyHours(cached.practitioner_hours);
      }
      if (cached && cached.schedule_overrides) {
        applyOverrides(cached.schedule_overrides);
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
          if (data.schedule_overrides) {
            applyOverrides(data.schedule_overrides);
          }
          if (data.fees) {
            applyFees(data.fees);
          }
        }
      })
      .catch(() => {});
  }

  function invalidateCache(inlineWidgetInstance) {
    if (inlineWidgetInstance && inlineWidgetInstance.client && typeof inlineWidgetInstance.client.clearCache === "function") {
      inlineWidgetInstance.client.clearCache();
    } else if (
      typeof window !== "undefined" &&
      window.KinesicaBookingClient &&
      typeof window.KinesicaBookingClient.clearStoredRange === "function"
    ) {
      window.KinesicaBookingClient.clearStoredRange();
    }
  }

  function ensurePreconnect() {
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
  }

  function warmAgenda(prewarmFn) {
    const ClientModule = typeof window !== "undefined" ? window.KinesicaBookingClient : null;
    const ClientConstructor =
      ClientModule && typeof ClientModule.BookingClient === "function"
        ? ClientModule.BookingClient
        : typeof ClientModule === "function"
        ? ClientModule
        : null;
    if (!ClientConstructor) {
      if (typeof prewarmFn === "function") prewarmFn();
      return;
    }
    const dates = [];
    const start = new Date();
    // 45 días corridos para cubrir el carrusel completo
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
  }

  function prewarm(inlineWidgetInstance) {
    if (typeof window === "undefined") return;
    if (window.__kinesicaSlotsRangePromise) return;
    if (inlineWidgetInstance && inlineWidgetInstance.client && typeof inlineWidgetInstance.client.prewarm === "function") {
      inlineWidgetInstance.client.prewarm();
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
  }

  return {
    syncPractitionerHours,
    invalidateCache,
    ensurePreconnect,
    warmAgenda,
    prewarm,
  };
});
