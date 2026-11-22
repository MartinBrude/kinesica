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
    proto.renderTechniqueChoices = function () {
      const grid = this.container.querySelector("#kb-technique-grid");
      if (!grid) return;
      grid.innerHTML = "";
      const techniques = (engine && engine.TECHNIQUES) || [];
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

      if (more.length === 0) return;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "kb-btn-link kb-more-toggle";
      toggle.textContent = this.state.showMoreTechniques
        ? this.t("showFewerTechniques")
        : this.t("showMoreTechniques");

      const moreGrid = document.createElement("div");
      moreGrid.id = "kb-technique-more-grid";
      moreGrid.className = "kb-choice-grid kb-choice-grid--secondary";
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
    };

    proto.selectTechnique = function (techniqueId) {
      if (!techniqueId || typeof techniqueId !== "string") return;
      const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(techniqueId) : null;
      if (!technique) return;

      this.state.techniqueId = techniqueId;
      const hasMultiple = Boolean(Array.isArray(technique.practitioners) && technique.practitioners.length > 1);
      this.state.practitionerPreference = hasMultiple ? "any" : null;
      this.state.practitionerId = technique.bySchedule || hasMultiple
        ? null
        : technique.practitioners.length === 1
          ? technique.practitioners[0]
          : null;
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
      if (!technique || !Array.isArray(technique.practitioners) || technique.practitioners.length < 2) {
        if (box) box.hidden = true;
        return;
      }
      if (box) box.hidden = false;
      const options = technique.practitioners.map((id) => ({
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
      const ready = isExisting
        ? Boolean(this.state.practitionerId)
        : Boolean(technique);
      if (btn) {
        btn.disabled = !ready;
        btn.textContent = this.t("seeSlots");
      }
      if (waBtn) {
        const showWa = isExisting && !this.options.adminMode && Boolean(this.state.practitionerId);
        waBtn.hidden = !showWa;
        if (showWa) {
          const name = this.practitionerFullName(this.state.practitionerId);
          waBtn.textContent = String(this.t("whatsappToPro") || "").replace("{name}", name);
        }
      }
    };
  }

  return {
    attachStep1Techniques,
  };
});
