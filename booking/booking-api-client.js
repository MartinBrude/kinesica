(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([
      "./booking-engine",
      "./booking-api-storage",
      "./booking-api-backup",
      "./booking-api-slots",
      "./booking-api-book",
    ], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-engine"),
      require("./booking-api-storage"),
      require("./booking-api-backup"),
      require("./booking-api-slots"),
      require("./booking-api-book")
    );
  } else {
    root.KinesicaBookingClient = factory(
      root.KinesicaBookingEngine,
      root.KinesicaBookingApiStorage,
      root.KinesicaBookingApiBackup,
      root.KinesicaBookingApiSlots,
      root.KinesicaBookingApiBook
    );
  }
})(typeof self !== "undefined" ? self : this, function (engine, storage, backup, slotsModule, bookModule) {
  "use strict";

  const st = storage || (typeof window !== "undefined" && window.KinesicaBookingApiStorage) || {};
  const bk = backup || (typeof window !== "undefined" && window.KinesicaBookingApiBackup) || {};
  const sl = slotsModule || (typeof window !== "undefined" && window.KinesicaBookingApiSlots) || {};
  const bm = bookModule || (typeof window !== "undefined" && window.KinesicaBookingApiBook) || {};

  class BookingClient {
    constructor(options) {
      this.options = options || {};
      this.apiUrl =
        this.options.apiUrl ||
        (typeof window !== "undefined" && window.KINESICA_SITE && window.KINESICA_SITE.bookingApiUrl) ||
        null;
      this.backupApiUrl =
        this.options.backupApiUrl !== undefined
          ? this.options.backupApiUrl
          : "/admin/api/calendar_backup.php";
      this.adminBookProxyUrl =
        this.options.adminBookProxyUrl !== undefined
          ? this.options.adminBookProxyUrl
          : null;
      this.isMock = !this.apiUrl || this.options.forceMock === true;
      this._slotsCache = {};
      this._inFlightSlots = {};
      this._rangeInFlight = null;
      this._rangeUnsupported = false;
      this._prewarmedAt = 0;
    }

    setApiUrl(url) {
      this.apiUrl = url;
      this.isMock = !url;
      this._slotsCache = {};
    }

    setForceMock(force) {
      this.isMock = force;
    }

    hasCachedSlots(dateStr) {
      if (this.isMock) return true;
      const cacheKey = `${dateStr}_session`;
      if (this._slotsCache && this._slotsCache[cacheKey]) return true;
      const stored = typeof st.readStoredRange === "function" ? st.readStoredRange() : null;
      return Boolean(stored && stored.days && stored.days[dateStr]);
    }

    prewarm() {
      if (this.isMock) return;
      const now = Date.now();
      const last = typeof window !== "undefined" ? window.__kinesicaPrewarmAt || 0 : this._prewarmedAt || 0;
      if (now - last < 90000) return;
      if (typeof window !== "undefined") window.__kinesicaPrewarmAt = now;
      this._prewarmedAt = now;
      const effectiveUrl = this.getEffectiveApiUrl();
      if (!effectiveUrl) return;
      try {
        fetch(`${effectiveUrl}?action=ping`, {
          method: "GET",
          mode: "cors",
          redirect: "follow",
          cache: "no-store",
        }).catch(() => {});
      } catch (e) {}
    }

    getEffectiveApiUrl() {
      if (
        this.options &&
        this.options.apiUrl &&
        typeof window !== "undefined" &&
        this.options.apiUrl !== (window.KINESICA_SITE && window.KINESICA_SITE.bookingApiUrl)
      ) {
        return this.apiUrl;
      }
      if (
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
        window.location.port === "3000"
      ) {
        return "/api/booking";
      }
      return this.apiUrl;
    }

    async getAvailableSlots(dateStr, appointmentType, options) {
      if (typeof sl.fetchAvailableSlots === "function") {
        return sl.fetchAvailableSlots(this, dateStr, appointmentType, options);
      }
      throw new Error("Módulo de slots no disponible");
    }

    async getSlotsRange(dateList) {
      const dates = (dateList || []).filter(Boolean);
      if (!dates.length) return false;
      if (this.isMock) {
        await Promise.all(dates.map((dateStr) => this.getAvailableSlots(dateStr, "session")));
        return true;
      }
      if (this._rangeUnsupported) return false;

      const from = dates[0];
      const to = dates[dates.length - 1];
      const stored = typeof st.readStoredRange === "function" ? st.readStoredRange() : null;
      if (typeof st.storedRangeCovers === "function" && st.storedRangeCovers(stored, from, to)) {
        st.applyStoredDays(this._slotsCache, stored.days, stored.at);
        return true;
      }
      if (typeof window !== "undefined" && window.__kinesicaSlotsRangePromise) {
        const ok = await window.__kinesicaSlotsRangePromise;
        const shared = typeof st.readStoredRange === "function" ? st.readStoredRange() : null;
        if (shared && typeof st.applyStoredDays === "function") st.applyStoredDays(this._slotsCache, shared.days, shared.at);
        return ok && st.storedRangeCovers(shared, from, to);
      }

      const effectiveUrl = this.getEffectiveApiUrl();
      const hoursParam = encodeURIComponent(typeof st.currentHoursSignature === "function" ? st.currentHoursSignature() : "");
      const url = `${effectiveUrl}?action=get_slots_range&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&hours=${hoursParam}`;

      const promise = (async () => {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 25000) : null;
        try {
          const res = await fetch(url, {
            method: "GET",
            mode: "cors",
            redirect: "follow",
            signal: controller ? controller.signal : undefined,
          });
          if (timeoutId) clearTimeout(timeoutId);
          const json = await res.json();
          if (!json || json.status === "error" || !json.days) {
            const message = json && json.message ? json.message : "";
            if (message.indexOf("no reconocida") !== -1) {
              this._rangeUnsupported = true;
              return false;
            }
            if (typeof bk.fetchSlotsRangeFromBackup === "function") {
              const backupRange = await bk.fetchSlotsRangeFromBackup(this, from, to);
              if (backupRange && backupRange.days && typeof st.applyStoredDays === "function") {
                const now = Date.now();
                st.applyStoredDays(this._slotsCache, backupRange.days, now);
                st.writeStoredRange(from, to, backupRange.days);
                return true;
              }
            }
            return false;
          }
          const now = Date.now();
          if (typeof st.applyStoredDays === "function") st.applyStoredDays(this._slotsCache, json.days, now);
          if (typeof st.writeStoredRange === "function") st.writeStoredRange(from, to, json.days);
          if (typeof bk.syncBackupSlots === "function") bk.syncBackupSlots(this, { days: json.days });
          return true;
        } catch (err) {
          if (timeoutId) clearTimeout(timeoutId);
          if (typeof bk.fetchSlotsRangeFromBackup === "function") {
            const backupRange = await bk.fetchSlotsRangeFromBackup(this, from, to);
            if (backupRange && backupRange.days && typeof st.applyStoredDays === "function") {
              const now = Date.now();
              st.applyStoredDays(this._slotsCache, backupRange.days, now);
              st.writeStoredRange(from, to, backupRange.days);
              return true;
            }
          }
          return false;
        } finally {
          if (typeof window !== "undefined") window.__kinesicaSlotsRangePromise = null;
          this._rangeInFlight = null;
        }
      })();

      if (typeof window !== "undefined") window.__kinesicaSlotsRangePromise = promise;
      this._rangeInFlight = { promise };
      return promise;
    }

    async checkPatient(phone) {
      const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
      const last8 = cleanPhone.slice(-8);

      if (this.isMock) {
        await new Promise((r) => setTimeout(r, 100));
        const list = (st && st.MOCK_HABITUAL_PATIENTS) || [];
        const match = list.find((p) => p.telefono.endsWith(last8));
        if (match) {
          return { status: "success", is_habitual: true, nombre: match.nombre, source: "mock" };
        }
        return { status: "success", is_habitual: false, nombre: null, source: "mock" };
      }

      const effectiveUrl = this.getEffectiveApiUrl();
      const query = new URLSearchParams({ action: "check_patient", telefono: phone });
      const url = `${effectiveUrl}?${query.toString()}`;
      const res = await fetch(url, { method: "POST", mode: "cors", redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      return await res.json();
    }

    async bookAppointment(data) {
      if (typeof bm.submitBooking === "function") {
        return bm.submitBooking(this, data);
      }
      throw new Error("Módulo de reserva no disponible");
    }

    clearCache() {
      this._slotsCache = {};
      if (typeof st.clearStoredRange === "function") st.clearStoredRange();
    }
  }

  return {
    BookingClient: BookingClient,
    getMockEvents: typeof st.getMockEvents === "function" ? st.getMockEvents : function () { return []; },
    saveMockEvents: typeof st.saveMockEvents === "function" ? st.saveMockEvents : function () {},
    clearStoredRange: typeof st.clearStoredRange === "function" ? st.clearStoredRange : function () {},
  };
});
