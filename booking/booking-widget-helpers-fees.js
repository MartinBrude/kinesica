/**
 * Kinésica - Helpers de honorarios y tarjetas de técnicas del widget de reservas.
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingWidgetHelpersFees = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  function attachFeeHelpers(proto) {
    proto.formatFee = function (amount) {
      const num = Number(amount || 0);
      const formatted = num.toLocaleString("es-AR");
      if (this.lang === "en") {
        return `ARS ${formatted}`;
      }
      return `$${formatted}`;
    };

    proto.getFeeForTechnique = function (techniqueId) {
      if (techniqueId === "atm") {
        return (this.fees && this.fees.atm) || 65000;
      }
      return (this.fees && this.fees.general) || 75000;
    };

    proto.feeDisplayHtml = function (techniqueId, { compact = false } = {}) {
      const atm = this.formatFee((this.fees && this.fees.atm) || 65000);
      const general = this.formatFee((this.fees && this.fees.general) || 75000);
      if (techniqueId === "no-se") {
        if (compact) {
          return `${this.t("feeAtm")}: ${atm} · ${this.t("feeOther")}: ${general}`;
        }
        return `
          <div class="kb-choice-fee kb-choice-fee--split">
            <div class="kb-fee-row">
              <span class="kb-fee-label">${this.t("feeAtm")}:</span>
              <strong class="kb-fee-amount" data-fee="atm">${atm}</strong>
            </div>
            <div class="kb-fee-row">
              <span class="kb-fee-label">${this.t("feeOther")}:</span>
              <strong class="kb-fee-amount" data-fee="general">${general}</strong>
            </div>
          </div>`;
      }
      if (compact) return this.formatFee(this.getFeeForTechnique(techniqueId));
      return `
        <div class="kb-choice-fee">
          <span class="kb-fee-label">${this.t("sessionFee")}:</span>
          <strong class="kb-fee-amount">${this.formatFee(this.getFeeForTechnique(techniqueId))}</strong>
        </div>`;
    };

    proto.updateFees = function (fees) {
      if (!fees || typeof fees !== "object") return;
      this.fees = Object.assign({}, this.fees, fees);
      if (engine && typeof engine.setRuntimeFees === "function") {
        engine.setRuntimeFees(fees);
      }
      const techGrid = this.container.querySelector("#kb-technique-grid");
      if (!techGrid || techGrid.children.length === 0) {
        this.renderTechniqueChoices();
      } else {
        this.container.querySelectorAll("#kb-technique-grid .kb-choice-card, #kb-technique-more-grid .kb-choice-card").forEach((card) => {
          const id = card.dataset.technique;
          if (!id) return;
          if (id === "no-se") {
            const atmEl = card.querySelector('.kb-fee-amount[data-fee="atm"]');
            const genEl = card.querySelector('.kb-fee-amount[data-fee="general"]');
            if (atmEl) atmEl.textContent = this.formatFee((this.fees && this.fees.atm) || 65000);
            if (genEl) genEl.textContent = this.formatFee((this.fees && this.fees.general) || 75000);
            return;
          }
          const amountEl = card.querySelector(".kb-fee-amount");
          if (amountEl) amountEl.textContent = this.formatFee(this.getFeeForTechnique(id));
        });
      }
    };

    proto.techniqueLabel = function (technique) {
      if (!technique) return "";
      const labels = this.copy.techniques || {};
      return labels[technique.id] || technique.label;
    };

    proto.featuredTechniqueIds = function () {
      const ids = (engine && engine.FEATURED_TECHNIQUE_IDS) || ["no-se", "osteopatia", "rpg", "atm"];
      return ids.slice();
    };

    proto.buildTechniqueCard = function (technique) {
      const isAdmin = Boolean(this.options && this.options.adminMode);
      const unavailable = !isAdmin && typeof this.isTechniqueBlockedByLeave === "function"
        && this.isTechniqueBlockedByLeave(technique.id);
      const card = document.createElement("div");
      card.className = "kb-choice-card" + (unavailable ? " kb-choice-card--unavailable" : "");
      if (!unavailable && this.state.techniqueId === technique.id) card.classList.add("selected");
      card.dataset.technique = technique.id;
      if (unavailable) {
        card.setAttribute("aria-disabled", "true");
        const note = (this.getMariaReturnNoticeText && this.getMariaReturnNoticeText()) || "";
        if (note) card.title = note;
      }
      card.innerHTML = isAdmin
        ? `<h3>${this.techniqueLabel(technique)}</h3>`
        : `<h3>${this.techniqueLabel(technique)}</h3>${this.feeDisplayHtml(technique.id)}`;
      card.addEventListener("click", () => {
        if (unavailable) return;
        this.selectTechnique(technique.id);
      });
      return card;
    };
  }

  return { attachFeeHelpers };
});
