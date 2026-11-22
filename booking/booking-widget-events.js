(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingWidgetEvents = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  function attachEventMethods(proto, BookingWidgetClass) {
    proto.bindEvents = function () {
      const q = (sel) => this.container.querySelector(sel);

      if (this.options.onClose) {
        this.container.querySelectorAll('[data-action="close-modal"]').forEach((b) => b.addEventListener("click", () => this.options.onClose()));
      }
      this.container.querySelectorAll('[data-action="reset-widget"]').forEach((b) => b.addEventListener("click", () => this.reset()));

      this.renderPatientChoices();
      this.renderTechniqueChoices();

      const btnNext1 = q("#kb-btn-next-1");
      if (btnNext1) {
        btnNext1.addEventListener("click", () => {
          if (this.options.adminMode && !this.validateAdminPatientFields()) return;
          if (this.state.existingPatient === true && !this.state.practitionerId) {
            this.showError(this.t("errWho"));
            return;
          }
          const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(this.state.techniqueId) : null;
          if (!technique) {
            this.showError(this.state.existingPatient === true ? this.t("errWho") : this.t("errTechnique"));
            return;
          }
          this.clearError();
          this.state.selectedDate = null;
          this.state.selectedTime = null;
          this.renderDateCarousel();
          this.setStep(2);
        });
      }

      const waExistingBtn = q("#kb-btn-wa-existing");
      if (waExistingBtn) {
        waExistingBtn.addEventListener("click", () => {
          const fromBtn = (waExistingBtn.dataset && waExistingBtn.dataset.waPractitioner) || "";
          const pid = fromBtn || this.state.practitionerId;
          if (!pid) { this.showError(this.t("errWho")); return; }
          this.clearError();
          this.openPractitionerWhatsApp(pid);
        });
      }

      const prev2 = q("#kb-btn-prev-2") || q("#kb-btn-back-2");
      if (prev2) prev2.addEventListener("click", () => { this.clearError(); this.setStep(1); });

      const prefPill = q("#kb-step2-pref-pill");
      if (prefPill) {
        prefPill.addEventListener("click", () => {
          this.clearError();
          this.setStep(1);
          const prefBox = q("#kb-practitioner-box");
          if (prefBox && !prefBox.hidden) prefBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }

      const fallbackWaBtn = q("#kb-btn-fallback-whatsapp");
      if (fallbackWaBtn) fallbackWaBtn.onclick = () => this.openPractitionerWhatsApp(this.fallbackPractitionerId());

      const btnNext2 = q("#kb-btn-next-2");
      if (btnNext2) {
        btnNext2.addEventListener("click", () => {
          if (!this.state.selectedDate || !this.state.selectedTime) { this.showError(this.t("errSlot")); return; }
          this.clearError();
          if (this.options.adminMode) { this.handleBookingSubmit(); return; }
          this.setStep(3);
        });
      }

      const prev3 = q("#kb-btn-prev-3") || q("#kb-btn-back-3");
      if (prev3) prev3.addEventListener("click", () => { this.clearError(); this.setStep(2); });

      const btnSubmit = q("#kb-btn-submit");
      if (btnSubmit) btnSubmit.addEventListener("click", () => this.handleBookingSubmit());

      const formFields = (BookingWidgetClass && BookingWidgetClass.FORM_FIELDS) ||
        (this.constructor && this.constructor.FORM_FIELDS) ||
        ["contacto-nombre", "contacto-telefono", "nombre", "email", "telefono", "dni"];

      formFields.forEach((field) => {
        const input = q(`#kb-input-${field}`);
        if (input) {
          input.addEventListener("input", () => {
            if (typeof input.value === "string") {
              const sanitizeFn = (BookingWidgetClass && BookingWidgetClass.sanitizeFieldInput) ||
                (this.constructor && this.constructor.sanitizeFieldInput);
              if (typeof sanitizeFn === "function") {
                const sanitized = sanitizeFn(field, input.value);
                if (sanitized !== input.value) input.value = sanitized;
              }
            }
            this.clearFieldError(field);
          });
        }
      });

      const inputContactNotas = q("#kb-input-contacto-notas");
      if (inputContactNotas) {
        inputContactNotas.addEventListener("input", () => {
          if (typeof inputContactNotas.value === "string") {
            const sanitizeFn = (BookingWidgetClass && BookingWidgetClass.sanitizeFieldInput) ||
              (this.constructor && this.constructor.sanitizeFieldInput);
            if (typeof sanitizeFn === "function") {
              const sanitized = sanitizeFn("contacto-notas", inputContactNotas.value);
              if (sanitized !== inputContactNotas.value) inputContactNotas.value = sanitized;
            }
          }
        });
      }

      const noPhoneToggle = q("#kb-check-no-phone");
      if (noPhoneToggle) noPhoneToggle.addEventListener("change", () => this.clearFieldError("telefono"));

      const radioSelf = q("#kb-radio-self");
      const radioOther = q("#kb-radio-other");
      const thirdPartyBox = q("#kb-third-party-box");
      const patientHeader = q("#kb-patient-header");
      const wrapNoPhone = q("#kb-wrap-no-phone");
      const checkNoPhone = q("#kb-check-no-phone");
      const inputTel = q("#kb-input-telefono");
      const inputContactTel = q("#kb-input-contacto-telefono");

      const updateThirdPartyView = () => {
        const isOther = Boolean(radioOther && radioOther.checked);
        if (thirdPartyBox) thirdPartyBox.style.display = isOther ? "block" : "none";
        if (patientHeader) patientHeader.style.display = isOther ? "block" : "none";
        if (wrapNoPhone) wrapNoPhone.style.display = isOther ? "inline-flex" : "none";
        const labelNombre = q("#kb-label-nombre");
        if (labelNombre) labelNombre.textContent = isOther ? "Nombre y Apellido de quien asistirá *" : this.t("name");
        if (isOther && checkNoPhone && checkNoPhone.checked) {
          if (inputTel && inputContactTel) {
            inputTel.value = inputContactTel.value;
            inputTel.disabled = true;
          }
        } else if (inputTel) {
          inputTel.disabled = false;
        }
      };

      if (radioSelf) radioSelf.addEventListener("change", updateThirdPartyView);
      if (radioOther) radioOther.addEventListener("change", updateThirdPartyView);
      if (checkNoPhone) {
        checkNoPhone.addEventListener("change", () => {
          if (checkNoPhone.checked && inputContactTel && inputTel) {
            inputTel.value = inputContactTel.value;
            inputTel.disabled = true;
          } else if (inputTel) {
            inputTel.disabled = false;
          }
        });
      }
      if (inputContactTel) {
        inputContactTel.addEventListener("input", () => {
          if (checkNoPhone && checkNoPhone.checked && inputTel) inputTel.value = inputContactTel.value;
        });
      }
    };

    proto.showError = function (msg, opts) {
      const banner = this.container.querySelector("#kb-error-banner");
      if (!banner) return;
      banner.textContent = msg;
      if (opts && opts.offerWhatsAppFallback && typeof document !== "undefined") {
        const wrap = document.createElement("div");
        wrap.style.marginTop = "10px";
        const p = document.createElement("p");
        p.style.margin = "0 0 8px 0";
        p.textContent = this.t("slotFallbackText");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kb-btn kb-btn-whatsapp";
        btn.textContent = this.t("slotFallbackBtn");
        btn.onclick = () => this.openPractitionerWhatsApp("norberto");
        wrap.appendChild(p);
        wrap.appendChild(btn);
        banner.appendChild(wrap);
      }
      banner.classList.add("visible");
      if (banner.scrollIntoView) banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    proto.clearError = function () {
      const banner = this.container.querySelector("#kb-error-banner");
      if (!banner) return;
      banner.textContent = "";
      banner.classList.remove("visible");
    };

    proto.showFieldErrors = function (errors) {
      this.clearAllFieldErrors();
      let first = null;
      (errors || []).forEach(({ field, message }) => {
        const input = this.container.querySelector(`#kb-input-${field}`);
        const box = this.container.querySelector(`#kb-err-${field}`);
        if (box) { box.textContent = message; box.hidden = false; }
        if (input) {
          input.classList.add("kb-input-invalid");
          input.setAttribute("aria-invalid", "true");
          if (box) input.setAttribute("aria-describedby", box.id);
          if (!first && !input.disabled) first = input;
        }
      });
      if (first) {
        try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
        if (first.scrollIntoView) first.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    proto.clearFieldError = function (field) {
      const input = this.container.querySelector(`#kb-input-${field}`);
      const box = this.container.querySelector(`#kb-err-${field}`);
      if (box) { box.textContent = ""; box.hidden = true; }
      if (input) {
        input.classList.remove("kb-input-invalid");
        input.removeAttribute("aria-invalid");
        if (box && input.getAttribute("aria-describedby") === box.id) input.removeAttribute("aria-describedby");
      }
    };

    proto.clearAllFieldErrors = function () {
      const fields = (BookingWidgetClass && BookingWidgetClass.FORM_FIELDS) ||
        (this.constructor && this.constructor.FORM_FIELDS) ||
        ["contacto-nombre", "contacto-telefono", "nombre", "email", "telefono", "dni"];
      fields.forEach((field) => this.clearFieldError(field));
    };
  }

  return {
    attachEventMethods,
  };
});
