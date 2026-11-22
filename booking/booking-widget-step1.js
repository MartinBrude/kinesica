(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingWidgetStep1 = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  function attachStep1Methods(proto) {
    proto.renderPatientChoices = function () {
      const grid = this.container.querySelector("#kb-patient-grid");
      if (!grid) return;
      grid.innerHTML = "";
      [{ value: true, label: this.t("yes") }, { value: false, label: this.t("no") }].forEach((option) => {
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.patient = option.value ? "yes" : "no";
        card.innerHTML = `<h3>${option.label}</h3>`;
        card.addEventListener("click", () => this.selectExistingPatient(option.value));
        grid.appendChild(card);
      });
      this.renderExistingPractitionerChoices();
    };

    proto.selectExistingPatient = function (isExisting) {
      this.state.existingPatient = isExisting;
      this.state.techniqueId = null;
      this.state.practitionerId = null;
      this.state.practitionerPreference = null;
      this.state.showMoreTechniques = false;
      this.container.querySelectorAll("#kb-patient-grid .kb-choice-card").forEach((card) => {
        card.classList.toggle("selected", (card.dataset.patient === "yes") === isExisting);
      });
      const existingBox = this.container.querySelector("#kb-existing-box");
      const newBox = this.container.querySelector("#kb-new-box");
      if (existingBox) existingBox.hidden = !isExisting;
      if (newBox) newBox.hidden = isExisting;
      this.container.querySelectorAll("#kb-existing-practitioner-grid .kb-choice-card.selected, #kb-technique-grid .kb-choice-card.selected, #kb-technique-more-grid .kb-choice-card.selected").forEach((card) => {
        card.classList.remove("selected");
      });
      const practitionerBox = this.container.querySelector("#kb-practitioner-box");
      if (practitionerBox) practitionerBox.hidden = true;
      if (isExisting) this.renderExistingPractitionerChoices();
      if (!isExisting) this.renderTechniqueChoices();
      if (this.options.adminMode) this.applyAdminPatientData();
      this.syncStep1Continue();
    };

    proto.setAdminPatient = function (patient) {
      if (!this.options.adminMode) return;
      this.state.adminPatient = patient && typeof patient === "object" ? patient : null;
      this.selectExistingPatient(Boolean(this.state.adminPatient));
      if (this.state.adminPatient) {
        const habitual = String(this.state.adminPatient.profesional_habitual || "").toLowerCase();
        this.state.practitionerId = ["norberto", "maria"].includes(habitual) ? habitual : null;
        if (this.state.practitionerId) this.state.techniqueId = "paciente";
        this.container.querySelectorAll("#kb-existing-practitioner-grid .kb-choice-card").forEach((card) => {
          card.classList.toggle("selected", card.dataset.practitioner === this.state.practitionerId);
        });
      }
      this.applyAdminPatientData();
      this.syncStep1Continue();
    };

    proto.setAdminNewPatient = function () {
      if (!this.options.adminMode) return;
      this.state.adminPatient = null;
      this.selectExistingPatient(false);
      this.applyAdminPatientData();
    };

    proto.applyAdminPatientData = function () {
      if (!this.options.adminMode) return;
      const patient = this.state.adminPatient;
      const q = (sel) => this.container.querySelector(sel);
      const fullName = patient ? String(patient.nombre_completo || `${patient.nombre || ""} ${patient.apellido || ""}`).trim() : "";
      const values = {
        "#kb-input-nombre": fullName,
        "#kb-input-email": patient ? String(patient.email || "") : "",
        "#kb-input-telefono": patient ? String(patient.telefono || "") : "",
        "#kb-input-dni": patient ? String(patient.dni || "") : "",
      };
      Object.entries(values).forEach(([selector, value]) => {
        const input = q(selector);
        if (!input) return;
        input.value = patient ? value : "";
        input.readOnly = Boolean(patient && value);
        if (input.readOnly) input.setAttribute("aria-readonly", "true");
        else input.removeAttribute("aria-readonly");
      });
      const isNew = this.state.existingPatient === false;
      const hasSelection = Boolean(patient) || isNew;
      const footer = q("#kb-step-1 .kb-step1-footer");
      if (footer) footer.style.visibility = hasSelection ? "visible" : "hidden";

      Object.keys(values).forEach((selector) => {
        const group = q(selector)?.closest(".kb-form-group");
        if (!group) return;
        group.hidden = Boolean(patient);
        const input = q(selector);
        if (!input) return;
        const isOptional = selector === "#kb-input-dni" || selector === "#kb-input-email";
        const needsRequired = !patient && !isOptional;
        input.required = needsRequired;
        input.setAttribute("aria-required", needsRequired ? "true" : "false");
        if (selector === "#kb-input-email" && !patient) {
          const label = group.querySelector("label");
          if (label) label.textContent = "Correo electrónico (opcional)";
          input.placeholder = "Opcional";
        }
      });
      const dataBox = q("#kb-admin-data");
      if (dataBox) {
        dataBox.hidden = !hasSelection || Boolean(patient);
        let note = q("#kb-admin-missing-note");
        if (!note) {
          note = document.createElement("div");
          note.id = "kb-admin-missing-note";
          note.className = "kb-admin-missing-note";
          note.textContent = "Faltan datos en el directorio para agendar:";
          dataBox.prepend(note);
        }
        note.hidden = true;
      }
      const whoTitle = q("#kb-existing-box .kb-section-title");
      if (whoTitle) whoTitle.textContent = "¿Con quién se atiende?";
      const techTitle = q("#kb-new-box > .kb-section-title");
      if (techTitle) techTitle.textContent = "Técnica";
      const preferTitle = q("#kb-practitioner-box .kb-section-title");
      if (preferTitle) preferTitle.textContent = "Profesional";
    };

    proto.reset = function () {
      this._carouselSeq = (this._carouselSeq || 0) + 1;
      this._slotReqSeq = (this._slotReqSeq || 0) + 1;
      this._bookingAnalyticsSent = false;
      this.state = {
        step: 1, tipo: "session", appointmentType: "session", existingPatient: null,
        techniqueId: null, practitionerId: null, practitionerPreference: null,
        showMoreTechniques: false, selectedDate: null, selectedTime: null,
        availableSlots: [], isLoadingSlots: false,
        formData: { nombre: "", email: "", telefono: "", dni: "" },
        adminPatient: null, confirmedBooking: null,
      };

      this.clearError();
      const q = (sel) => this.container.querySelector(sel);
      this.container.querySelectorAll(".kb-choice-card.selected").forEach((c) => c.classList.remove("selected"));
      ["#kb-existing-box", "#kb-new-box", "#kb-practitioner-box"].forEach((sel) => {
        const el = q(sel);
        if (el) el.hidden = true;
      });
      const carousel = q("#kb-date-carousel");
      if (carousel) carousel.innerHTML = "";

      const slotsGrid = q("#kb-slots-grid");
      if (slotsGrid) { slotsGrid.innerHTML = ""; slotsGrid.style.display = "none"; }
      ["#kb-slots-loading", "#kb-slots-empty", "#kb-slots-error"].forEach((sel) => {
        const el = q(sel);
        if (el) el.style.display = "none";
      });

      const btnNext2 = q("#kb-btn-next-2");
      if (btnNext2) btnNext2.disabled = true;

      ["#kb-input-nombre", "#kb-input-email", "#kb-input-telefono", "#kb-input-dni", "#kb-input-contacto-nombre", "#kb-input-contacto-telefono", "#kb-input-contacto-notas"].forEach((sel) => {
        const input = q(sel);
        if (input) {
          input.value = "";
          input.readOnly = false;
          input.removeAttribute("aria-readonly");
        }
      });

      this.clearAllFieldErrors();
      const radioSelf = q("#kb-radio-self");
      if (radioSelf) radioSelf.checked = true;
      const thirdPartyBox = q("#kb-third-party-box");
      if (thirdPartyBox) thirdPartyBox.style.display = "none";
      const patientHeader = q("#kb-patient-header");
      if (patientHeader) patientHeader.style.display = "none";
      const wrapNoPhone = q("#kb-wrap-no-phone");
      if (wrapNoPhone) wrapNoPhone.style.display = "none";
      const checkNoPhone = q("#kb-check-no-phone");
      if (checkNoPhone) checkNoPhone.checked = false;
      const inputTel = q("#kb-input-telefono");
      if (inputTel) inputTel.disabled = false;
      const labelNombre = q("#kb-label-nombre");
      if (labelNombre) labelNombre.textContent = this.t("name");

      const btnSubmit = q("#kb-btn-submit");
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = this.t("confirm");
      }
      if (this.options.adminMode && btnNext2) btnNext2.textContent = "Confirmar turno";

      const summaryBox = q("#kb-success-summary");
      if (summaryBox) summaryBox.innerHTML = "";
      const clinicRules = q("#kb-success-clinic-rules");
      if (clinicRules) clinicRules.style.display = "none";

      this.syncStep1Continue();
      if (this.options.adminMode) this.applyAdminPatientData();
      this.setStep(1);
    };
  }

  return {
    attachStep1Methods,
  };
});
