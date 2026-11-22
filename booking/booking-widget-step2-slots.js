(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingWidgetStep2Slots = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  function attachStep2Slots(proto) {
    proto.practitionersForSlot = function (dateIso, timeHm) {
      const onDuty = engine.practitionersAt(dateIso, timeHm);
      const chosen = engine.getTechnique(this.state.techniqueId);
      if (chosen && Array.isArray(chosen.practitioners) && !chosen.bySchedule) {
        return onDuty.filter((id) => chosen.practitioners.indexOf(id) !== -1);
      }
      return onDuty;
    };

    proto.fetchFilteredSlots = async function (dateIso, forceRefresh = false) {
      const res = await this.client.getAvailableSlots(dateIso, "session", {
        forceRefresh,
        practitionerId: this.state.practitionerId,
        techniqueId: this.state.techniqueId,
      });
      if (!res || res.status === "error" || !Array.isArray(res.availableSlots)) {
        throw new Error((res && res.message) || "Error al procesar los horarios disponibles");
      }
      const validSlots = [];
      for (let i = 0; i < res.availableSlots.length; i += 1) {
        const slot = res.availableSlots[i];
        if (!slot || typeof slot.time !== "string" || !/^\d{2}:\d{2}$/.test(slot.time.trim())) {
          throw new Error("Formato de horario inválido al procesar la disponibilidad");
        }
        validSlots.push(Object.assign({}, slot, { time: slot.time.trim() }));
      }
      let slots = this.filterSlotsWithBuffer(validSlots, dateIso, this.state.appointmentType);
      const chosen = engine.getTechnique(this.state.techniqueId);
      slots = this.restrictToPractitioner(slots, dateIso);
      if (!this.state.practitionerId && chosen && chosen.bySchedule) {
        slots = slots.filter((slot) => engine.practitionersAt(dateIso, slot.time).length > 0);
      } else if (chosen && Array.isArray(chosen.practitioners)) {
        slots = slots.filter((slot) => {
          const atSlot = engine.practitionersAt(dateIso, slot.time);
          return chosen.practitioners.some((pid) => atSlot.indexOf(pid) !== -1);
        });
      }
      return slots;
    };

    proto.restrictToPractitioner = function (slots, dateIso) {
      const id = this.state.practitionerId;
      if (!id || !Array.isArray(slots)) return slots || [];
      const windows = engine.getWorkingWindows(id, dateIso);
      return slots.filter((slot) => {
        const parts = String(slot.time || "").split(":");
        const tMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
        return windows.some((w) => tMin >= w.startMin && tMin + engine.SESSION_DURATION_MINUTES <= w.endMin);
      });
    };

    proto.filterSlotsWithBuffer = function (slots, dateIso, appointmentType) {
      if (!Array.isArray(slots) || slots.length === 0) return [];
      let todayArg = "";
      try {
        todayArg = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Argentina/Buenos_Aires",
          year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
      } catch (e) {
        const d = new Date(Date.now() - 3 * 3600 * 1000);
        todayArg = d.toISOString().slice(0, 10);
      }
      if (dateIso !== todayArg) return slots;
      const bufferHours = engine.SESSION_BUFFER_HOURS || 2;
      const minAllowedTimestamp = Date.now() + bufferHours * 3600 * 1000;
      return slots.filter((slot) => {
        let slotTimestamp = 0;
        if (slot.startIso) {
          slotTimestamp = new Date(slot.startIso).getTime();
        } else if (slot.time) {
          slotTimestamp = new Date(`${dateIso}T${slot.time}:00-03:00`).getTime();
        }
        return slotTimestamp >= minAllowedTimestamp;
      });
    };

    proto.loadSlotsForDate = async function (dateIso, forceRefresh = false) {
      this._slotReqSeq = (this._slotReqSeq || 0) + 1;
      const currentReq = this._slotReqSeq;

      const loading = this.container.querySelector("#kb-slots-loading");
      const empty = this.container.querySelector("#kb-slots-empty");
      const errorBox = this.container.querySelector("#kb-slots-error");
      const grid = this.container.querySelector("#kb-slots-grid");

      const hasPrefetched = Boolean(
        !forceRefresh && this._prefetchedSlots && Object.prototype.hasOwnProperty.call(this._prefetchedSlots, dateIso)
      );
      const hasWarm = hasPrefetched || (
        !forceRefresh && this.client && typeof this.client.hasCachedSlots === "function" && this.client.hasCachedSlots(dateIso)
      );

      if (!hasWarm) {
        loading.style.display = "flex";
        empty.style.display = "none";
        errorBox.style.display = "none";
        grid.style.display = "none";
        grid.innerHTML = "";
      } else {
        loading.style.display = "none";
        empty.style.display = "none";
        errorBox.style.display = "none";
      }

      try {
        const rawSlots = hasPrefetched
          ? this._prefetchedSlots[dateIso]
          : await this.fetchFilteredSlots(dateIso, forceRefresh);
        if (!Array.isArray(rawSlots)) throw new Error("Error al procesar los horarios disponibles");
        for (let i = 0; i < rawSlots.length; i += 1) {
          const slot = rawSlots[i];
          if (!slot || typeof slot.time !== "string" || !/^\d{2}:\d{2}$/.test(slot.time.trim())) {
            throw new Error("Formato de horario inválido al procesar la disponibilidad");
          }
        }
        const slots = this.restrictToPractitioner(rawSlots, dateIso);
        if (currentReq !== this._slotReqSeq) return;

        loading.style.display = "none";
        this.state.availableSlots = slots;

        if (slots.length === 0) {
          const card = this.container.querySelector(`.kb-date-card[data-date="${dateIso}"]`);
          const next = card && card.nextElementSibling;
          if (card) card.remove();
          this.replenishCarouselIfNeeded(this._carouselSeq).catch(() => {});
          if (next && next.dataset.date) {
            this.selectDate(next.dataset.date);
            return;
          }
          const firstRemaining = this.container.querySelector(".kb-date-card[data-date]");
          if (firstRemaining && firstRemaining.dataset.date) {
            this.selectDate(firstRemaining.dataset.date);
            return;
          }
          empty.style.display = "flex";
          return;
        }

        grid.style.display = "grid";
        grid.innerHTML = "";
        slots.forEach((slot) => {
          const chip = document.createElement("div");
          chip.className = "kb-slot-chip";
          const onDuty = !this.state.practitionerId ? this.practitionersForSlot(dateIso, slot.time) : [];
          const dutyLabel = onDuty.length === 1 ? ` · ${this.practitionerGenderLabel(onDuty[0])}` : "";
          const hs = this.t("hs");
          chip.textContent = `${slot.time}${hs ? " " + hs : ""}${dutyLabel}`;
          chip.dataset.time = slot.time;

          chip.addEventListener("click", () => {
            this.state.selectedTime = slot.time;
            grid.querySelectorAll(".kb-slot-chip").forEach((ch) => ch.classList.remove("selected"));
            chip.classList.add("selected");
            this.container.querySelector("#kb-btn-next-2").disabled = false;
          });

          grid.appendChild(chip);
        });
      } catch (err) {
        if (currentReq !== this._slotReqSeq) return;
        this.showSlotsError(err, dateIso);
      }
    };
  }

  return {
    attachStep2Slots,
  };
});
