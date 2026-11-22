(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingWidgetStep1Existing = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  function attachStep1Existing(proto) {
    proto.renderExistingPractitionerChoices = function () {
      const grid = this.container.querySelector("#kb-existing-practitioner-grid");
      if (!grid) return;
      grid.innerHTML = "";
      const mariaOnLeave = Boolean(this.getActiveLeaveEndIso && this.getActiveLeaveEndIso("maria"));
      if (mariaOnLeave && this.state.practitionerId === "maria") {
        this.state.practitionerId = null;
        this.state.techniqueId = null;
      }
      const practitioners = (engine && engine.PRACTITIONERS) || {};
      Object.keys(practitioners).forEach((id) => {
        const unavailable = id === "maria" && mariaOnLeave;
        const card = document.createElement("div");
        card.className = "kb-choice-card" + (unavailable ? " kb-choice-card--unavailable" : "");
        if (!unavailable && this.state.practitionerId === id && this.state.techniqueId === "paciente") {
          card.classList.add("selected");
        }
        card.dataset.practitioner = id;
        if (unavailable) {
          card.setAttribute("aria-disabled", "true");
          card.title = (this.getMariaLeaveNoticeText && this.getMariaLeaveNoticeText()) || "";
        }
        card.innerHTML = `<h3>${this.practitionerFullName(id)}</h3>`;
        card.addEventListener("click", () => {
          if (unavailable) return;
          this.state.practitionerId = id;
          this.state.techniqueId = "paciente";
          grid.querySelectorAll(".kb-choice-card").forEach((c) => {
            c.classList.toggle("selected", c.dataset.practitioner === id);
          });
          this.syncStep1Continue();
        });
        grid.appendChild(card);
      });
      this.syncExistingLeaveNotice();
      this.syncStep1Continue();
    };

    proto.syncExistingLeaveNotice = function () {
      const notice = this.container.querySelector("#kb-existing-leave-notice");
      const noticeText = this.container.querySelector("#kb-existing-leave-notice-text");
      const existingBox = this.container.querySelector("#kb-existing-box");
      if (!notice || !noticeText) return;
      const text = this.getMariaLeaveNoticeText ? this.getMariaLeaveNoticeText() : null;
      const show = Boolean(text && existingBox && !existingBox.hidden && !this.options.adminMode);
      notice.hidden = !show;
      noticeText.textContent = show ? text : "";
    };
  }

  return {
    attachStep1Existing,
  };
});
