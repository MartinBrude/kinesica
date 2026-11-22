(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine", "./booking-widget-template"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"), require("./booking-widget-template"));
  } else {
    root.KinesicaBookingWidgetDom = factory(root.KinesicaBookingEngine, root.KinesicaBookingWidgetTemplate);
  }
})(typeof self !== "undefined" ? self : this, function (engine, templateModule) {
  "use strict";

  const tm = templateModule || (typeof window !== "undefined" && window.KinesicaBookingWidgetTemplate) || {};

  function attachDomMethods(proto, BookingWidgetClass) {
    proto.renderSkeleton = function () {
      if (typeof tm.buildWidgetTemplate === "function") {
        this.container.innerHTML = tm.buildWidgetTemplate(this);
      }
    };

    proto.setupAdminLayout = function () {
      const q = (sel) => this.container.querySelector(sel);
      const root = q(".kinesica-booking-container");
      if (root) root.classList.add("kb-admin-mode");

      const header = q(".kb-header");
      if (header) header.remove();

      const labels = { 1: "Paciente", 2: "Horario", 4: "Listo" };
      this.container.querySelectorAll(".kb-step-item").forEach((item) => {
        const n = Number(item.dataset.stepIndicator);
        if (n === 3) {
          item.hidden = true;
          item.style.display = "none";
          return;
        }
        const num = item.querySelector(".kb-step-num");
        item.textContent = "";
        if (num) {
          num.textContent = n === 4 ? "3" : String(n);
          item.appendChild(num);
        }
        item.appendChild(document.createTextNode(` ${labels[n]}`));
      });

      const step1 = q("#kb-step-1");
      const title = q("#kb-step-1 > .kb-section-title");
      const dataBox = document.createElement("div");
      dataBox.id = "kb-admin-data";
      dataBox.className = "kb-admin-data";
      dataBox.hidden = true;
      const nombreGroup = q("#kb-input-nombre")?.closest(".kb-form-group");
      const emailGroup = q("#kb-input-email")?.closest(".kb-form-group");
      const phoneRow = q("#kb-group-telefono")?.closest(".kb-form-row");
      [nombreGroup, emailGroup, phoneRow].forEach((el) => el && dataBox.appendChild(el));

      if (title) title.remove();
      if (step1) step1.prepend(dataBox);

      const next2 = q("#kb-btn-next-2");
      if (next2) next2.textContent = "Confirmar turno";
    };

    proto.validateAdminPatientFields = function () {
      if (this.state.adminPatient) return true;
      const q = (sel) => this.container.querySelector(sel);
      this._confirmedPhones = this._confirmedPhones || new Set();
      this._confirmedEmails = this._confirmedEmails || new Set();
      const validator = BookingWidgetClass && BookingWidgetClass.validateContactForm
        ? BookingWidgetClass.validateContactForm
        : (typeof this.constructor.validateContactForm === "function" ? this.constructor.validateContactForm : null);
      if (!validator) return true;

      const errors = validator({
        isOther: false,
        contactoNombre: "",
        contactoTelefono: "",
        nombre: q("#kb-input-nombre").value.trim(),
        email: q("#kb-input-email") ? q("#kb-input-email").value.trim() : "",
        emailOptional: true,
        dni: q("#kb-input-dni") ? q("#kb-input-dni").value.trim() : "",
        dniOptional: true,
        telefono: q("#kb-input-telefono").value.trim(),
        usesContactPhone: false,
        confirmedPhones: this._confirmedPhones,
        confirmedEmails: this._confirmedEmails,
      }, (key) => this.t(key));

      errors.forEach((err) => {
        if (err.isSoftPhoneConfirm && err.phoneDigits) this._confirmedPhones.add(err.phoneDigits);
        if (err.isSoftEmailConfirm && err.emailValue) this._confirmedEmails.add(err.emailValue);
      });
      if (errors.length) this.showFieldErrors(errors);
      return errors.length === 0;
    };

    proto.updateDniRequirement = function () {
      const label = this.container.querySelector("#kb-label-dni");
      const input = this.container.querySelector("#kb-input-dni");
      const optional = Boolean(this.options.adminMode);
      if (label) label.textContent = optional ? this.t("dniOptionalLabel") : this.t("dni");
      if (input) {
        input.placeholder = optional ? this.t("dniOptionalPh") : this.t("dniPh");
        if (optional) input.removeAttribute("required");
        else input.setAttribute("required", "required");
      }
    };

    proto.setStep = function (stepNumber) {
      this.state.step = stepNumber;
      const panels = this.container.querySelectorAll(".kb-step-panel");
      panels.forEach((p, idx) => {
        p.classList.toggle("active", idx + 1 === stepNumber);
      });

      const indicators = this.container.querySelectorAll(".kb-step-item");
      indicators.forEach((ind, idx) => {
        const itemStep = idx + 1;
        ind.classList.remove("active", "completed");
        if (itemStep === stepNumber) {
          ind.classList.add("active");
        } else if (itemStep < stepNumber) {
          ind.classList.add("completed");
        }
      });

      if (stepNumber === 3) this.updateDniRequirement();

      const step2Title = this.container.querySelector("#kb-step-2 .kb-section-title");
      if (step2Title) {
        const named = this.state.existingPatient === true && this.state.practitionerId
          ? this.practitionerFullName(this.state.practitionerId)
          : "";
        step2Title.textContent = named
          ? `${this.t("slotTitleWith")} ${named}`
          : this.t("slotTitle");
      }

      const prefContainer = this.container.querySelector("#kb-step2-pref-container");
      const prefVal = this.container.querySelector("#kb-step2-pref-val");
      if (prefContainer && prefVal) {
        const prefText = this.getPractitionerPreferenceDisplay();
        if (prefText && stepNumber === 2) {
          prefVal.textContent = prefText;
          prefContainer.style.display = "block";
        } else {
          prefContainer.style.display = "none";
        }
      }

      const subtitle = this.container.querySelector("#kb-slots-subtitle");
      if (subtitle) {
        const techniqueForSub = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(this.state.techniqueId) : null;
        subtitle.textContent = (techniqueForSub && techniqueForSub.bySchedule) || !this.state.practitionerId
          ? this.t("sessionHour")
          : this.t("sessionPro");
        subtitle.style.display = "block";
      }
    };
  }

  return {
    attachDomMethods,
  };
});
