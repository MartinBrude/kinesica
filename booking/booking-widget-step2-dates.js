(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingWidgetStep2Dates = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  function attachStep2Dates(proto) {
    proto.collectAttendanceDays = function (limit) {
      const today = new Date();
      let checkDate = new Date(today);
      let scanned = 0;
      const days = [];
      const MAX_DAYS_AHEAD = (engine && engine.MAX_BOOKING_DAYS) || 60;
      const effectiveLimit = typeof limit === "number" && limit > 0 ? limit : MAX_DAYS_AHEAD;
      while (days.length < effectiveLimit && scanned < MAX_DAYS_AHEAD) {
        scanned += 1;
        const iso = engine.formatDateIso(checkDate);
        const current = new Date(checkDate);
        checkDate.setDate(checkDate.getDate() + 1);
        if (!this.dayHasAttendance(current)) continue;
        days.push({ iso, current });
      }
      return days;
    };

    proto.prefetchUpcomingDays = function () {
      if (this._prefetchRun) return;
      this._prefetchRun = true;
      this._prefetchedSlots = this._prefetchedSlots || {};
      const cacheGen = this._slotCacheGen || 0;
      const days = this.collectAttendanceDays(14);
      const run = async () => {
        if (this.client && typeof this.client.getSlotsRange === "function") {
          try { await this.client.getSlotsRange(days.map((d) => d.iso)); } catch (e) {}
        }
        if (cacheGen !== (this._slotCacheGen || 0)) return;

        const initialBatch = days.slice(0, 4);
        await Promise.all(
          initialBatch.map(async (day) => {
            if (cacheGen !== (this._slotCacheGen || 0) || this._prefetchedSlots[day.iso]) return;
            try {
              const slots = await this.fetchFilteredSlots(day.iso);
              if (cacheGen !== (this._slotCacheGen || 0)) return;
              this._prefetchedSlots[day.iso] = slots;
            } catch (err) {}
          })
        );

        for (let i = 4; i < days.length; i += 2) {
          if (cacheGen !== (this._slotCacheGen || 0)) return;
          const batch = days.slice(i, i + 2);
          await Promise.all(
            batch.map(async (day) => {
              if (this._prefetchedSlots[day.iso]) return;
              try {
                const slots = await this.fetchFilteredSlots(day.iso);
                if (cacheGen !== (this._slotCacheGen || 0)) return;
                this._prefetchedSlots[day.iso] = slots;
              } catch (err) {}
            })
          );
        }
      };
      run();
    };

    proto.dayHasAttendance = function (date) {
      const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(this.state.techniqueId) : null;
      const ids = this.state.practitionerId
        ? [this.state.practitionerId]
        : (technique && technique.practitioners) || Object.keys((engine && engine.PRACTITIONERS) || {});
      const works = ids.some((id) => engine.getWorkingWindows(id, date).length > 0);
      return engine.isBusinessDay(date) && works;
    };

    proto.createDateCard = function (day) {
      const card = document.createElement("div");
      card.className = "kb-date-card";
      card.dataset.date = day.iso;
      card.innerHTML = `
        <div class="kb-date-dow">${this.copy.dows[day.current.getDay()]}</div>
        <div class="kb-date-day">${day.current.getDate()}</div>
        <div class="kb-date-month">${this.copy.months[day.current.getMonth()]}</div>
      `;
      card.addEventListener("click", () => this.selectDate(day.iso));
      return card;
    };

    proto.replenishCarouselIfNeeded = async function (seq) {
      const targetDays = this._targetCarouselDays || 10;
      const carousel = this.container.querySelector("#kb-date-carousel");
      if (!carousel) return;
      while (
        seq === this._carouselSeq &&
        carousel.querySelectorAll(".kb-date-card").length < targetDays &&
        Array.isArray(this._reserveAttendanceDays) &&
        this._reserveAttendanceDays.length > 0
      ) {
        const nextDay = this._reserveAttendanceDays.shift();
        if (!nextDay || carousel.querySelector(`.kb-date-card[data-date="${nextDay.iso}"]`)) continue;
        try {
          const slots = await this.fetchFilteredSlots(nextDay.iso);
          if (seq !== this._carouselSeq) return;
          this._prefetchedSlots[nextDay.iso] = slots;
          if (slots && slots.length > 0) carousel.appendChild(this.createDateCard(nextDay));
        } catch (err) {}
      }
    };

    proto.renderDateCarousel = async function () {
      this._carouselSeq = (this._carouselSeq || 0) + 1;
      const seq = this._carouselSeq;
      const carousel = this.container.querySelector("#kb-date-carousel");
      if (carousel) carousel.innerHTML = "";

      const loading = this.container.querySelector("#kb-slots-loading");
      const empty = this.container.querySelector("#kb-slots-empty");
      const errorBox = this.container.querySelector("#kb-slots-error");
      const grid = this.container.querySelector("#kb-slots-grid");
      if (loading) loading.style.display = "flex";
      if (empty) empty.style.display = "none";
      if (errorBox) errorBox.style.display = "none";
      if (grid) grid.style.display = "none";

      try {
        const filterKey = `${this.state.techniqueId || ""}_${this.state.practitionerId || ""}_${this.state.appointmentType || ""}`;
        if (this._lastFilterKey !== filterKey) {
          this._lastFilterKey = filterKey;
          this._slotCacheGen = (this._slotCacheGen || 0) + 1;
          this._prefetchedSlots = {};
        } else {
          this._prefetchedSlots = this._prefetchedSlots || {};
        }
        const targetDays = 10;
        this._targetCarouselDays = targetDays;
        const allCandidateDays = this.collectAttendanceDays(30);
        const days = allCandidateDays.slice(0, targetDays);
        this._reserveAttendanceDays = allCandidateDays.slice(targetDays);
        if (this.client && typeof this.client.getSlotsRange === "function" && allCandidateDays.length > 0) {
          this.client.getSlotsRange(allCandidateDays.map((d) => d.iso)).catch(() => {});
        }
        let firstAvailable = null;
        days.forEach((day) => {
          carousel.appendChild(this.createDateCard(day));
          if (!firstAvailable) firstAvailable = day.iso;
        });
        if (seq !== this._carouselSeq) return;
        if (!firstAvailable) {
          this.showSlotsError(new Error(this.t("noDays")), null);
          return;
        }
        const selected = this.state.selectedDate && carousel.querySelector(`[data-date="${this.state.selectedDate}"]`)
          ? this.state.selectedDate
          : firstAvailable;
        this.selectDate(selected);
        this.pruneEmptyDays(days.filter((d) => d.iso !== selected), seq);
      } catch (err) {
        if (seq !== this._carouselSeq) return;
        this.showSlotsError(err, null);
      }
    };

    proto.pruneEmptyDays = async function (days, seq) {
      for (let i = 0; i < days.length; i += 3) {
        if (seq !== this._carouselSeq) return;
        const batch = days.slice(i, i + 3);
        await Promise.all(batch.map(async (day) => {
          try {
            const slots = await this.fetchFilteredSlots(day.iso);
            if (seq !== this._carouselSeq) return;
            this._prefetchedSlots[day.iso] = slots;
            if (!slots.length) {
              const card = this.container.querySelector(`.kb-date-card[data-date="${day.iso}"]`);
              if (card && !card.classList.contains("selected")) card.remove();
            }
          } catch (err) {}
        }));
      }
      await this.replenishCarouselIfNeeded(seq);
    };

    proto.selectDate = async function (dateIso) {
      this.state.selectedDate = dateIso;
      this.state.selectedTime = null;
      const nextBtn = this.container.querySelector("#kb-btn-next-2");
      if (nextBtn) nextBtn.disabled = true;
      this.container.querySelectorAll(".kb-date-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.date === dateIso);
      });
      if (typeof this.syncStep2PreferencePill === "function") {
        this.syncStep2PreferencePill();
      }
      await this.loadSlotsForDate(dateIso);
    };

    proto.showSlotsError = function (err, dateIso) {
      const loading = this.container.querySelector("#kb-slots-loading");
      const empty = this.container.querySelector("#kb-slots-empty");
      const errorBox = this.container.querySelector("#kb-slots-error");
      const grid = this.container.querySelector("#kb-slots-grid");
      const nextBtn = this.container.querySelector("#kb-btn-next-2");

      this.state.selectedTime = null;
      this.state.availableSlots = [];
      if (nextBtn) nextBtn.disabled = true;
      if (loading) loading.style.display = "none";
      if (empty) empty.style.display = "none";
      if (grid) { grid.style.display = "none"; grid.innerHTML = ""; }
      if (!errorBox) return;

      errorBox.style.display = "flex";
      const errorText = this.container.querySelector("#kb-slots-error-text");
      if (errorText) errorText.textContent = this.t("slotError");
      const fallbackPrac = "norberto";
      const fallbackText = this.container.querySelector("#kb-slots-error-fallback");
      if (fallbackText) fallbackText.textContent = this.t("slotFallbackText");

      const waBtn = this.container.querySelector("#kb-btn-fallback-whatsapp");
      if (waBtn) {
        waBtn.textContent = this.t("slotFallbackBtn");
        waBtn.onclick = () => this.openPractitionerWhatsApp(fallbackPrac);
      }
      const retryBtn = this.container.querySelector("#kb-btn-retry-slots");
      if (retryBtn) {
        retryBtn.textContent = this.t("retry");
        retryBtn.onclick = () => {
          const targetDate = dateIso || this.state.selectedDate;
          if (this._prefetchedSlots && targetDate) delete this._prefetchedSlots[targetDate];
          if (this.client && typeof this.client.clearCache === "function") this.client.clearCache();
          if (targetDate) this.loadSlotsForDate(targetDate, true);
          else this.renderDateCarousel();
        };
      }
    };
  }

  return {
    attachStep2Dates,
  };
});
