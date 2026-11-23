(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingWidgetStep1Techniques = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  function attachStep1Techniques(proto) {
    proto.isTechniqueBlockedByLeave = function (techniqueId) {
      if (!techniqueId || !engine || typeof engine.isTechniqueBlockedByActiveLeave !== "function") {
        return false;
      }
      return engine.isTechniqueBlockedByActiveLeave(techniqueId);
    };

    proto.syncTechniqueLeaveNotice = function () {
      const notice = this.container.querySelector("#kb-technique-leave-notice");
      const noticeText = this.container.querySelector("#kb-technique-leave-notice-text");
      const newBox = this.container.querySelector("#kb-new-box");
      if (!notice || !noticeText) return;
      const isAdmin = Boolean(this.options && this.options.adminMode);
      const text = !isAdmin && this.getMariaReturnNoticeText ? this.getMariaReturnNoticeText() : null;
      const hasBlocked = Boolean(text) && ((engine && engine.TECHNIQUES) || []).some((t) => {
        return t && !t.internal && this.isTechniqueBlockedByLeave(t.id);
      });
      const show = Boolean(hasBlocked && newBox && !newBox.hidden);
      notice.hidden = !show;
      noticeText.textContent = show ? text : "";
    };

    proto.renderTechniqueChoices = function () {
      const grid = this.container.querySelector("#kb-technique-grid");
      if (!grid) return;
      grid.innerHTML = "";
      const isAdmin = Boolean(this.options && this.options.adminMode);
      const techniques = ((engine && engine.TECHNIQUES) || []).filter((t) => Boolean(t && !t.internal));
      if (this.state.techniqueId && this.isTechniqueBlockedByLeave(this.state.techniqueId) && !isAdmin) {
        this.state.techniqueId = null;
        this.state.practitionerId = null;
        this.state.practitionerPreference = null;
      }
      const featuredIds = this.featuredTechniqueIds();
      const featured = [];
      const more = [];

      techniques.forEach((t) => {
        if (featuredIds.includes(t.id)) featured.push(t);
        else more.push(t);
      });

      featured.forEach((technique) => {
        grid.appendChild(this.buildTechniqueCard(technique));
      });

      let moreWrap = this.container.querySelector("#kb-technique-more-wrap");
      if (!moreWrap) {
        moreWrap = document.createElement("div");
        moreWrap.id = "kb-technique-more-wrap";
        moreWrap.className = "kb-technique-more-wrap";
        grid.parentNode.insertBefore(moreWrap, grid.nextSibling);
      }
      moreWrap.innerHTML = "";

      if (!more.length) {
        moreWrap.hidden = true;
        this.syncTechniqueLeaveNotice();
        return;
      }
      moreWrap.hidden = false;

      // Solo expandir si ya hay una técnica de "más" seleccionada.
      // Técnicas no disponibles (licencia) no deben abrir el listado por defecto.
      const selectedInMore = more.some((t) => t.id === this.state.techniqueId);
      if (selectedInMore) this.state.showMoreTechniques = true;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "kb-tech-more-toggle";
      toggle.id = "kb-btn-tech-more";
      toggle.setAttribute("aria-expanded", this.state.showMoreTechniques ? "true" : "false");
      toggle.textContent = this.state.showMoreTechniques
        ? this.t("showFewerTechniques")
        : this.t("showMoreTechniques");

      const moreGrid = document.createElement("div");
      moreGrid.id = "kb-technique-more-grid";
      moreGrid.className = "kb-choice-grid kb-technique-more-grid";
      moreGrid.hidden = !this.state.showMoreTechniques;

      more.forEach((technique) => {
        moreGrid.appendChild(this.buildTechniqueCard(technique));
      });

      toggle.addEventListener("click", () => {
        this.state.showMoreTechniques = !this.state.showMoreTechniques;
        moreGrid.hidden = !this.state.showMoreTechniques;
        toggle.setAttribute("aria-expanded", this.state.showMoreTechniques ? "true" : "false");
        toggle.textContent = this.state.showMoreTechniques
          ? this.t("showFewerTechniques")
          : this.t("showMoreTechniques");
      });

      moreWrap.appendChild(toggle);
      moreWrap.appendChild(moreGrid);
      this.syncTechniqueLeaveNotice();
    };

    proto.bookablePractitionersForTechnique = function (technique) {
      if (!technique) return [];
      let list;
      if (engine && typeof engine.practitionersBookableForTechnique === "function") {
        list = engine.practitionersBookableForTechnique(technique.id);
      } else {
        list = Array.isArray(technique.practitioners) ? technique.practitioners.slice() : [];
      }
      // Baja activa (p. ej. María hasta reincorporación): no ofrecer hombre/mujer
      // aunque vuelva dentro del horizonte de reserva.
      if (this.options && this.options.adminMode) return list;
      if (typeof this.getActiveLeaveEndIso !== "function") return list;
      return list.filter((pid) => !this.getActiveLeaveEndIso(pid));
    };

    proto.selectTechnique = function (techniqueId) {
      if (!techniqueId || typeof techniqueId !== "string") return;
      const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(techniqueId) : null;
      if (!technique) return;
      if (!(this.options && this.options.adminMode) && this.isTechniqueBlockedByLeave(techniqueId)) return;

      this.state.techniqueId = techniqueId;
      const bookable = this.bookablePractitionersForTechnique(technique);
      const hasMultiple = bookable.length > 1;
      this.state.practitionerPreference = hasMultiple ? "any" : null;
      this.state.practitionerId = technique.bySchedule || hasMultiple
        ? null
        : bookable.length === 1
          ? bookable[0]
          : (Array.isArray(technique.practitioners) && technique.practitioners.length === 1
            ? technique.practitioners[0]
            : null);
      this.container.querySelectorAll("#kb-technique-grid .kb-choice-card, #kb-technique-more-grid .kb-choice-card").forEach((card) => {
        card.classList.toggle("selected", card.dataset.technique === techniqueId);
      });
      this.renderPractitionerChoices(technique);
      this.syncStep1Continue();
    };

    proto.renderPractitionerChoices = function (technique) {
      const box = this.container.querySelector("#kb-practitioner-box");
      const grid = this.container.querySelector("#kb-practitioner-grid");
      if (!grid) return;
      grid.innerHTML = "";
      const bookable = this.bookablePractitionersForTechnique(technique);
      // Si por cesión/baja solo queda uno, no ofrecer hombre/mujer.
      if (!technique || bookable.length < 2) {
        if (box) box.hidden = true;
        if (bookable.length === 1) {
          this.state.practitionerPreference = null;
          this.state.practitionerId = bookable[0];
        }
        return;
      }
      if (box) box.hidden = false;
      const options = bookable.map((id) => ({
        value: id,
        label: this.practitionerGenderLabel(id),
      }));
      options.push({
        value: "any",
        label: this.t("proAny"),
      });

      if (!this.state.practitionerPreference) {
        this.state.practitionerPreference = "any";
      }
      if (this.state.practitionerPreference !== "any"
        && bookable.indexOf(this.state.practitionerPreference) === -1) {
        this.state.practitionerPreference = "any";
        this.state.practitionerId = null;
      }

      options.forEach((opt) => {
        const card = document.createElement("div");
        const isSelected = this.state.practitionerPreference === opt.value;
        card.className = "kb-choice-card" + (isSelected ? " selected" : "");
        card.dataset.practitioner = opt.value;
        card.innerHTML = `<h3>${opt.label}</h3>`;
        card.addEventListener("click", () => {
          const isSame = this.state.practitionerPreference === opt.value;
          const nextPref = isSame ? "any" : opt.value;
          this.state.practitionerPreference = nextPref;
          this.state.practitionerId = !nextPref || nextPref === "any" ? null : nextPref;
          grid.querySelectorAll(".kb-choice-card").forEach((c) => {
            c.classList.toggle("selected", c.dataset.practitioner === nextPref);
          });
          this.syncStep1Continue();
        });
        grid.appendChild(card);
      });
    };

    proto.syncStep1Continue = function () {
      const btn = this.container.querySelector("#kb-btn-next-1");
      const waBtn = this.container.querySelector("#kb-btn-wa-existing");
      const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(this.state.techniqueId) : null;
      const isExisting = this.state.existingPatient === true;
      const mariaOnLeave = Boolean(this.getActiveLeaveEndIso && this.getActiveLeaveEndIso("maria"));
      if (isExisting && mariaOnLeave && this.state.practitionerId === "maria") {
        this.state.practitionerId = null;
        this.state.techniqueId = null;
      }
      const ready = isExisting
        ? Boolean(this.state.practitionerId)
        : Boolean(technique);
      if (btn) {
        btn.disabled = !ready;
        btn.textContent = this.t("seeSlots");
      }
      if (typeof this.syncExistingLeaveNotice === "function") this.syncExistingLeaveNotice();
      if (waBtn) {
        const leaveWaTarget = isExisting && mariaOnLeave && !this.options.adminMode ? "norberto" : null;
        const waTarget = leaveWaTarget || (isExisting && !this.options.adminMode ? this.state.practitionerId : null);
        const showWa = Boolean(waTarget);
        waBtn.hidden = !showWa;
        waBtn.dataset.waPractitioner = waTarget || "";
        if (showWa) {
          const name = this.practitionerFullName(waTarget);
          waBtn.textContent = String(this.t("whatsappToPro") || "").replace("{name}", name);
        }
      }
    };
  }

  return {
    attachStep1Techniques,
  };
});
