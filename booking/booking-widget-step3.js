(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine", "./booking-validation"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"), require("./booking-validation"));
  } else {
    root.KinesicaBookingWidgetStep3 = factory(root.KinesicaBookingEngine, root.KinesicaBookingValidation);
  }
})(typeof self !== "undefined" ? self : this, function (engine, validationModule) {
  "use strict";

  function attachStep3Methods(proto, BookingWidgetClass) {
    proto.handleBookingSubmit = async function () {
      this.clearError();
      const q = (sel) => this.container.querySelector(sel);

      if (!this.state.selectedDate || !this.state.selectedTime) {
        this.showError(this.t("errSlot"));
        this.setStep(2);
        return;
      }

      const isOther = Boolean(q("#kb-radio-other") && q("#kb-radio-other").checked);
      let contactoNombre = "";
      let contactoTelefono = "";
      let contactoNotas = "";
      if (isOther) {
        contactoNombre = q("#kb-input-contacto-nombre") ? q("#kb-input-contacto-nombre").value.trim() : "";
        contactoTelefono = q("#kb-input-contacto-telefono") ? q("#kb-input-contacto-telefono").value.trim() : "";
        contactoNotas = q("#kb-input-contacto-notas") ? q("#kb-input-contacto-notas").value.trim() : "";
      }

      const nombre = q("#kb-input-nombre").value.trim();
      const email = q("#kb-input-email") ? q("#kb-input-email").value.trim() : "";
      let telefono = q("#kb-input-telefono").value.trim();
      const checkNoPhone = q("#kb-check-no-phone");
      if (isOther && (!telefono || (checkNoPhone && checkNoPhone.checked))) {
        telefono = contactoTelefono;
      }
      const dni = q("#kb-input-dni").value.trim();

      const telefonoPropio = q("#kb-input-telefono").value.trim();
      const usesContactPhone = Boolean(isOther && (!telefonoPropio || (checkNoPhone && checkNoPhone.checked)));
      this._confirmedPhones = this._confirmedPhones || new Set();
      this._confirmedEmails = this._confirmedEmails || new Set();
      const skipValidation = Boolean(this.options.adminMode && this.state.adminPatient);
      if (skipValidation && /^sin-/i.test(telefono)) telefono = "";

      const validateFn = (BookingWidgetClass && BookingWidgetClass.validateContactForm) ||
        (validationModule && validationModule.validateContactForm);
      const fieldErrors = skipValidation ? [] : validateFn({
        isOther, contactoNombre, contactoTelefono, nombre, email,
        emailOptional: Boolean(this.options.adminMode),
        dni, dniOptional: Boolean(this.options.adminMode),
        telefono, usesContactPhone,
        confirmedPhones: this._confirmedPhones,
        confirmedEmails: this._confirmedEmails,
      }, (key) => this.t(key));

      if (fieldErrors.length) {
        fieldErrors.forEach((err) => {
          if (err.isSoftPhoneConfirm && err.phoneDigits) this._confirmedPhones.add(err.phoneDigits);
          if (err.isSoftEmailConfirm && err.emailValue) this._confirmedEmails.add(err.emailValue);
        });
        this.showFieldErrors(fieldErrors);
        if (this.options.adminMode) this.setStep(1);
        return;
      }

      const slotPractitioners = this.practitionersForSlot(this.state.selectedDate, this.state.selectedTime);
      const effectivePractitionerId = this.state.practitionerId ||
        (slotPractitioners.length === 1 ? slotPractitioners[0] : null);

      const chosenTech = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(this.state.techniqueId) : null;
      const especialidad = this.state.techniqueId === "no-se"
        ? "No especifica"
        : (chosenTech ? chosenTech.label : "No especifica");

      const payload = {
        tipo: "session",
        appointmentType: "session",
        techniqueId: this.state.techniqueId,
        practitionerId: effectivePractitionerId,
        date: this.state.selectedDate,
        time: this.state.selectedTime,
        nombre, email, telefono, dni,
        adminMode: Boolean(this.options.adminMode),
        motivo: especialidad, especialidad,
        esParaTercero: isOther,
        contactoNombre, contactoTelefono, contactoNotas,
        isMenor: Boolean(isOther && (/hijo|menor/i.test(contactoNotas) || (checkNoPhone && checkNoPhone.checked))),
        nombreFamiliar: contactoNombre,
        notas: isOther ? `Agendado por: ${contactoNombre} (${contactoTelefono})` : "",
      };

      const btnSubmit = this.options.adminMode ? q("#kb-btn-next-2") : q("#kb-btn-submit");
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = this.t("saving");
      }

      try {
        const result = await this.client.bookAppointment(payload);
        this.state.confirmedBooking = result;

        if (typeof this.options.onBookingSuccess === "function") {
          try {
            await this.options.onBookingSuccess(payload, result);
          } catch (persistError) {
            console.warn("No se pudo sincronizar el paciente con ADMIN:", persistError);
          }
        }

        const mailMeta = await this.sendConfirmationEmail(payload, result);
        if (mailMeta && mailMeta.manageCode) {
          result.manageCode = mailMeta.manageCode;
          result.manageUrl = mailMeta.manageUrl || this.defaultManageUrl();
        }

        this.trackBookingConversion(payload, result);
        this.renderConfirmation(payload, result);
        this.setStep(4);
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) console.warn("booking submit failed", err);
        this.showError(this.friendlySubmitError(err), {
          offerWhatsAppFallback: Boolean(err && err.bothSystemsFailed),
        });
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = this.options.adminMode ? "Confirmar turno" : this.t("confirm");
        }
      }
    };

    proto.bookingAnalyticsParams = function (payload) {
      const appointmentType = String((payload && payload.appointmentType) || this.state.appointmentType || "session").toLowerCase();
      const bookingType = appointmentType === "call" ? "consulta" : "presencial";
      let service = "";
      const techniqueId = payload && payload.techniqueId;
      if (techniqueId && techniqueId !== "no-se" && techniqueId !== "paciente") {
        const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(techniqueId) : null;
        if (technique && !technique.bySchedule && !technique.internal) service = technique.id || "";
      }
      if (!service && payload && payload.especialidad && payload.especialidad !== "No especifica") {
        service = String(payload.especialidad).slice(0, 80);
      }
      const params = { booking_type: bookingType, value: 1, currency: "ARS" };
      if (service) params.service = service;
      return params;
    };

    proto.isConsultaEnviadaResult = function (payload, result) {
      const appointmentType = String((payload && payload.appointmentType) || (result && result.appointmentType) || "").toLowerCase();
      if (appointmentType === "call") return true;
      const status = String((result && result.status) || "").toLowerCase();
      return status === "consulta_enviada" || status === "inquiry_sent";
    };

    proto.trackBookingConversion = function (payload, result) {
      if (this.options.adminMode || this._bookingAnalyticsSent) return;
      this._bookingAnalyticsSent = true;
      const params = this.bookingAnalyticsParams(payload);
      const isConsulta = this.isConsultaEnviadaResult(payload, result);
      const eventName = isConsulta ? "kinesica_consulta_enviada" : "kinesica_agenda_confirmada";

      if (typeof window.kinesicaPushEvent === "function") {
        window.kinesicaPushEvent(eventName, params);
        return;
      }
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, params));
    };

    proto.sendConfirmationEmail = async function (payload, bookResult) {
      if (!payload || !payload.email) return null;
      try {
        const professionalName = this.practitionerFullName(payload.practitionerId) || "Lic. Norberto Brude";
        const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(payload.techniqueId) : null;
        let serviceName = technique && !technique.bySchedule && !technique.internal ? technique.label : (payload.especialidad || "");
        if (!serviceName || serviceName === "No especifica" || /osteopat[ií]a/i.test(serviceName)) {
          serviceName = "Terapias Manuales";
        }
        const eventId = (bookResult && bookResult.eventId) || "";
        const body = {
          email: payload.email, paciente: payload.nombre, telefono: payload.telefono,
          dni: payload.dni, fecha: payload.date, hora: payload.time,
          profesional: professionalName, servicio: serviceName,
          motivo: payload.motivo || payload.especialidad,
          esMenor: Boolean(payload.isMenor), esParaTercero: Boolean(payload.esParaTercero),
          contactoNombre: payload.contactoNombre || "",
          contactoTelefono: payload.contactoTelefono || "",
          contactoNotas: payload.contactoNotas || "",
          eventId, practitionerId: payload.practitionerId || "",
        };

        const postConfirm = (extra) => fetch("/api/send-confirmation.php", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({}, body, extra || {})),
        });

        let res = await postConfirm();
        if (!res.ok && eventId) res = await postConfirm({ retry: true, rotate_manage_code: true });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        return data && data.success ? data : null;
      } catch (err) {
        console.warn("No se pudo enviar el correo de confirmación:", err);
        return null;
      }
    };
  }

  return {
    attachStep3Methods,
  };
});
