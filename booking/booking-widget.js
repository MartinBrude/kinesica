/**
 * Kinésica - Componente Interactivo de Reservas Web
 * ===================================================
 * Gestiona el flujo paso a paso con validaciones en tiempo real:
 * - Paso 1: ¿Ya te has atendido con nosotros? → profesional o técnica
 * - Paso 2: Calendario y Horarios disponibles
 * - Paso 3: Formulario de datos clínicos y contacto
 * - Paso 4: Confirmación oficial con normas del consultorio
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-widget-copy", "./booking-engine", "./booking-api-client", "./booking-validation"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-widget-copy"),
      require("./booking-engine"),
      require("./booking-api-client"),
      require("./booking-validation")
    );
  } else {
    root.KinesicaBookingWidget = factory(
      root.KinesicaBookingWidgetCopy,
      root.KinesicaBookingEngine,
      root.KinesicaBookingClient,
      root.KinesicaBookingValidation
    );
  }
})(typeof self !== "undefined" ? self : this, function (copyModule, engine, clientModule, validationModule) {
  "use strict";

  const pageLang = copyModule.pageLang;
  const COPY = copyModule.COPY;

  class BookingWidget {
    constructor(containerId, options) {
      this.container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
      if (!this.container) {
        throw new Error(`Contenedor no encontrado: ${containerId}`);
      }

      this.options = options || {};
      this.lang = pageLang(this.options.lang);
      this.copy = COPY[this.lang] || COPY.es;
      this.client = new clientModule.BookingClient(options);

      // Estado del flujo
      this.state = {
        step: 1,
        tipo: "session",
        appointmentType: "session",
        existingPatient: null,
        techniqueId: null,
        practitionerId: null,
        practitionerPreference: null,
        showMoreTechniques: false,
        selectedDate: null,
        selectedTime: null,
        availableSlots: [],
        isLoadingSlots: false,
        formData: {
          nombre: "",
          email: "",
          telefono: "",
          dni: "",
        },
        adminPatient: null,
        confirmedBooking: null,
      };

      this.fees = (engine && typeof engine.getRuntimeFees === "function") ? engine.getRuntimeFees() : { atm: 65000, general: 75000, payment_methods: "Efectivo o transferencia bancaria" };
      try {
        const cached = JSON.parse(localStorage.getItem("kinesica_public_settings") || "null");
        if (cached && cached.fees) {
          this.fees = Object.assign({}, this.fees, cached.fees);
          if (engine && typeof engine.setRuntimeFees === "function") engine.setRuntimeFees(cached.fees);
        }
      } catch (_) {}

      this.init();
    }

    formatFee(amount) {
      const num = Number(amount || 0);
      const formatted = num.toLocaleString("es-AR");
      if (this.lang === "en") {
        return `ARS ${formatted}`;
      }
      return `$${formatted}`;
    }

    getFeeForTechnique(techniqueId) {
      if (techniqueId === "atm") {
        return (this.fees && this.fees.atm) || 65000;
      }
      return (this.fees && this.fees.general) || 75000;
    }

    /** HTML del valor a mostrar en tarjetas / confirmación. "No sé" informa ambos honorarios. */
    feeDisplayHtml(techniqueId, { compact = false } = {}) {
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
    }

    updateFees(fees) {
      if (!fees || typeof fees !== "object") return;
      this.fees = Object.assign({}, this.fees, fees);
      if (engine && typeof engine.setRuntimeFees === "function") {
        engine.setRuntimeFees(fees);
      }
      // Actualizar montos in-place: un re-render completo del grid provoca un flash
      // visible cuando el paciente ya eligió "No" y ve las técnicas.
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
    }

    t(key) {
      const value = this.copy[key];
      if (value != null) return value;
      return COPY.es[key] != null ? COPY.es[key] : key;
    }

    /**
     * Retorna la etiqueta i18n del género del profesional según su ID ('norberto' -> Hombre, 'maria' -> Mujer).
     * @param {string} id
     * @returns {string}
     */
    practitionerGenderLabel(id) {
      if (typeof id !== "string") return "";
      const normalized = id.trim().toLowerCase();
      if (normalized === "norberto") return this.t("proMale");
      if (normalized === "maria") return this.t("proFemale");
      return "";
    }

    /**
     * Retorna el nombre completo del profesional para mostrar en el título o resúmenes.
     * @param {string} id
     * @returns {string}
     */
    practitionerFullName(id) {
      if (typeof id !== "string") return "";
      const normalized = id.trim().toLowerCase();
      if (normalized === "norberto") return "Norberto Brude";
      if (normalized === "maria") return "María Gulin";
      return this.practitionerGenderLabel(normalized);
    }

    /**
     * Retorna el texto para la píldora de preferencia de profesional en el Paso 2
     * (ej. "Hombre", "Mujer", "Indistinto"). Si el paciente es habitual o la técnica solo la atiende
     * 1 solo profesional, retorna null para no mostrar la píldora.
     * @returns {string|null}
     */
    getPractitionerPreferenceDisplay() {
      if (!this.state || this.state.existingPatient === true) return null;
      const techniqueId = this.state.techniqueId;
      const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(techniqueId) : null;
      const hasMultiplePros = Boolean(technique && Array.isArray(technique.practitioners) && technique.practitioners.length > 1);
      const pref = typeof this.state.practitionerPreference === "string" ? this.state.practitionerPreference.trim().toLowerCase() : null;
      if (!hasMultiplePros && !pref) {
        return null;
      }

      if (pref === "norberto") {
        return this.t("proMale");
      }
      if (pref === "maria") {
        return this.t("proFemale");
      }
      if (pref === "any" || hasMultiplePros) {
        return this.t("proAny");
      }
      return null;
    }

    practitionerWhatsappUrl(id) {
      const prac = engine && engine.PRACTITIONERS && engine.PRACTITIONERS[id];
      const digits = (prac && prac.whatsapp) || (id === "maria" ? "5491128531224" : "5491161564311");
      return `https://wa.me/${digits}`;
    }

    openPractitionerWhatsApp(id) {
      const url = this.practitionerWhatsappUrl(id);
      if (typeof window !== "undefined" && typeof window.open === "function") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else if (typeof window !== "undefined") {
        window.location.href = url;
      }
    }

    fallbackPractitionerId() {
      const techniqueId = this.state && this.state.techniqueId;
      if (techniqueId === "paciente" && this.state && this.state.practitionerId === "maria") {
        return "maria";
      }
      const technique =
        engine && typeof engine.getTechnique === "function"
          ? engine.getTechnique(techniqueId)
          : null;
      if (
        technique &&
        Array.isArray(technique.practitioners) &&
        technique.practitioners.length === 1 &&
        technique.practitioners[0] === "maria"
      ) {
        return "maria";
      }
      return "norberto";
    }

    techniqueLabel(technique) {
      if (!technique) return "";
      const labels = this.copy.techniques || {};
      return labels[technique.id] || technique.label;
    }

    init() {
      this.renderSkeleton();
      if (this.options.adminMode) this.setupAdminLayout();
      this.updateDniRequirement();
      this.bindEvents();
      if (this.client && typeof this.client.prewarm === "function") {
        this.client.prewarm();
      }
      this.prefetchUpcomingDays();
      if (typeof fetch === "function") {
        fetch("/admin/api/settings.php", { cache: "no-cache" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data && typeof data === "object") {
              if (data.practitioner_hours && engine && typeof engine.setPractitionerHours === "function") {
                engine.setPractitionerHours(data.practitioner_hours);
              }
              if (data.schedule_overrides && engine && typeof engine.setScheduleOverrides === "function") {
                engine.setScheduleOverrides(data.schedule_overrides);
              }
              if (data.fees) {
                this.updateFees(data.fees);
              }
            }
          })
          .catch(() => {});
      }

      this.setStep(1);
    }

    /**
     * Turnera profesional (ADMIN): flujo compacto de 2 pasos.
     *  1) Paciente: datos básicos + técnica/profesional en la MISMA vista.
     *  2) Horario: al elegir el slot se confirma directamente.
     * Sin precios, reglas del consultorio ni botones de calendario personal:
     * esa información es para el paciente, no para quien agenda.
     */
    setupAdminLayout() {
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

      // Mover los campos de datos del paciente al paso 1.
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

      // El selector de paciente (lo inyecta ADMIN) reemplaza la pregunta para pacientes.
      if (title) title.remove();
      if (step1) step1.prepend(dataBox);

      const next2 = q("#kb-btn-next-2");
      if (next2) next2.textContent = "Confirmar turno";
    }

    validateAdminPatientFields() {
      // Paciente encontrado en el directorio: alcanza con eso, no se exige email ni DNI.
      if (this.state.adminPatient) return true;
      const q = (sel) => this.container.querySelector(sel);
      this._confirmedPhones = this._confirmedPhones || new Set();
      this._confirmedEmails = this._confirmedEmails || new Set();
      const errors = BookingWidget.validateContactForm({
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
    }

    renderSkeleton() {
      const containerMod = this.options.isModal ? "is-modal" : "is-inline";
      this.container.innerHTML = `
        <div class="kinesica-booking-container ${containerMod}">
          <div class="kb-header">
            ${this.options.isModal ? `<button type="button" class="kb-close-btn" aria-label="${this.t("close")}" data-action="close-modal">&times;</button>` : ''}
            <h2>${this.t("title")}</h2>
            <p>${this.t("subtitle")}</p>
          </div>

          <div class="kb-stepper">
            <div class="kb-step-item active" data-step-indicator="1">
              <span class="kb-step-num">1</span> ${this.t("step1")}
            </div>
            <div class="kb-step-item" data-step-indicator="2">
              <span class="kb-step-num">2</span> ${this.t("step2")}
            </div>
            <div class="kb-step-item" data-step-indicator="3">
              <span class="kb-step-num">3</span> ${this.t("step3")}
            </div>
            <div class="kb-step-item" data-step-indicator="4">
              <span class="kb-step-num">4</span> ${this.t("step4")}
            </div>
          </div>

          <div class="kb-body">
            <div id="kb-error-banner" class="kb-error-banner"></div>

            <!-- PASO 1: PACIENTE → PROFESIONAL O TÉCNICA -->
            <div class="kb-step-panel active" id="kb-step-1">
              <div class="kb-section-title">${this.t("qPatient")}</div>
              <div class="kb-choice-grid" id="kb-patient-grid" ${this.options.adminMode ? 'style="display:none"' : ""}></div>

              <div id="kb-existing-box" class="kb-step1-followup" hidden>
                <div class="kb-section-title" style="font-size: 17px;">${this.t("qWho")}</div>
                <p class="kb-section-hint" id="kb-existing-hint" ${this.options.adminMode ? "hidden" : ""}>${this.t("existingHint")}</p>
                <div class="kb-choice-grid" id="kb-existing-practitioner-grid"></div>
              </div>

              <div id="kb-new-box" class="kb-step1-followup" hidden>
                <div class="kb-section-title" style="font-size: 17px;">${this.t("qTechnique")}</div>
                <p class="kb-section-hint" id="kb-technique-hint" ${this.options.adminMode ? "hidden" : ""}>${this.t("techniqueHint")}</p>
                <div class="kb-choice-grid" id="kb-technique-grid"></div>
                <div id="kb-practitioner-box" class="kb-step1-followup" hidden>
                  <div class="kb-section-title" style="font-size: 17px;">${this.t("qPrefer")}</div>
                  <div class="kb-choice-grid" id="kb-practitioner-grid"></div>
                </div>
              </div>

              <div class="kb-step1-footer">
                <button type="button" class="kb-btn kb-btn-whatsapp" id="kb-btn-wa-existing" hidden>
                  ${this.t("openWhatsapp")}
                </button>
                <button type="button" class="kb-btn kb-btn-primary" id="kb-btn-next-1" disabled>
                  ${this.t("seeSlots")}
                </button>
              </div>
            </div>

            <!-- PASO 2: DÍA Y HORA -->
            <div class="kb-step-panel" id="kb-step-2">
              <div class="kb-section-title">${this.t("pickDay")}</div>
              <div class="kb-step2-pref-container" id="kb-step2-pref-container" style="display: none;">
                <button type="button" class="kb-step2-pref-pill" id="kb-step2-pref-pill" title="${this.t("changePref")}">
                  <svg class="kb-step2-pref-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span class="kb-step2-pref-label">${this.t("prefTag")}</span>
                  <strong class="kb-step2-pref-val" id="kb-step2-pref-val"></strong>
                  <span class="kb-step2-pref-change">(${this.t("changePref")})</span>
                </button>
              </div>
              <div class="kb-section-desc" id="kb-slots-subtitle" style="display: none;"></div>

              <label class="kb-slots-label">${this.t("daysLabel")}</label>
              <div class="kb-date-scroll" id="kb-date-carousel"></div>

              <label class="kb-slots-label" id="kb-slots-grid-title">${this.t("slotsLabel")}</label>
              <div id="kb-slots-container">
                <div id="kb-slots-loading" class="kb-state-box" style="display: none;">
                  <div class="kb-spinner"></div>
                  <span>${this.t("loading")}</span>
                </div>
                <div id="kb-slots-empty" class="kb-state-box" style="display: none;">
                  <span>${this.t("emptyDay")}</span>
                </div>
                <div id="kb-slots-error" class="kb-state-box kb-state-box-error" role="alert" style="display: none;">
                  <span id="kb-slots-error-text" class="kb-slots-error-title">${this.t("slotError")}</span>
                  <p id="kb-slots-error-fallback" class="kb-slots-error-fallback">${this.t("slotFallbackText")}</p>
                  <div class="kb-slots-error-actions">
                    <button type="button" class="kb-btn kb-btn-whatsapp kb-btn-whatsapp-primary" id="kb-btn-fallback-whatsapp">${this.t("slotFallbackBtn")}</button>
                    <button type="button" class="kb-btn kb-btn-secondary" id="kb-btn-retry-slots">${this.t("retry")}</button>
                  </div>
                </div>
                <div class="kb-slots-grid" id="kb-slots-grid"></div>
              </div>

              <div class="kb-actions">
                <button class="kb-btn kb-btn-secondary" id="kb-btn-prev-2">${this.t("back")}</button>
                <button class="kb-btn kb-btn-primary" id="kb-btn-next-2" disabled>
                  ${this.t("toData")}
                </button>
              </div>
            </div>

            <!-- PASO 3: FORMULARIO -->
            <div class="kb-step-panel" id="kb-step-3">
              <div class="kb-section-title">${this.t("dataTitle")}</div>
              <div class="kb-section-desc">${this.t("dataDesc")}</div>

              <div class="kb-radio-group" ${this.options.adminMode ? 'style="display:none"' : ""}>
                <div class="kb-radio-title">¿Para quién es el turno?</div>
                <div class="kb-radio-options">
                  <label class="kb-radio-label">
                    <input type="radio" name="kb-for-whom" id="kb-radio-self" value="self" checked>
                    <span>Para mí</span>
                  </label>
                  <label class="kb-radio-label">
                    <input type="radio" name="kb-for-whom" id="kb-radio-other" value="other">
                    <span>Para otra persona</span>
                  </label>
                </div>
              </div>

              <!-- Bloque condicional: Datos de quien agenda (cuando es para otra persona) -->
              <div id="kb-third-party-box" style="display: none; margin-bottom: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                <div style="font-size: 12px; font-weight: 700; color: #166534; margin-bottom: 10px; text-transform: uppercase;">
                  Tus datos (quien agenda el turno):
                </div>
                <div class="kb-form-group" style="margin-bottom: 8px;">
                  <label for="kb-input-contacto-nombre">Tu Nombre y Apellido *</label>
                  <input type="text" id="kb-input-contacto-nombre" placeholder="Ej: Laura Gómez" maxlength="100" autocomplete="name">
                  <div class="kb-field-error" id="kb-err-contacto-nombre" role="alert" aria-live="assertive" hidden></div>
                </div>
                <div class="kb-form-row">
                  <div class="kb-form-group" style="margin-bottom: 8px;">
                    <label for="kb-input-contacto-telefono">Tu Teléfono / WhatsApp *</label>
                    <input type="tel" id="kb-input-contacto-telefono" placeholder="${this.t("phonePh")}" maxlength="24" inputmode="tel" autocomplete="tel">
                  <div class="kb-field-error" id="kb-err-contacto-telefono" role="alert" aria-live="assertive" hidden></div>
                  </div>
                  <div class="kb-form-group" style="margin-bottom: 8px;">
                    <label for="kb-input-contacto-notas">Relación o rol (opcional)</label>
                    <input type="text" id="kb-input-contacto-notas" placeholder="Ej: Cónyuge, Hijo/a, Secretaria" maxlength="80">
                  </div>
                </div>
                <small style="color: #64748b; font-size: 12px; display: block;">
                  Te enviaremos el comprobante y podrás consultar o anular el turno cuando lo necesites.
                </small>
              </div>

              <div id="kb-patient-header" style="display: none; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 10px; text-transform: uppercase;">
                Datos del paciente (quien asistirá a la sesión):
              </div>

              <div class="kb-form-group">
                <label for="kb-input-nombre" id="kb-label-nombre">${this.t("name")}</label>
                <input type="text" id="kb-input-nombre" placeholder="${this.t("namePh")}" maxlength="100" autocomplete="name" required>
                  <div class="kb-field-error" id="kb-err-nombre" role="alert" aria-live="assertive" hidden></div>
              </div>

              <div class="kb-form-group">
                <label for="kb-input-email">${this.t("email")}</label>
                <input type="email" id="kb-input-email" placeholder="${this.t("emailPh")}" maxlength="120" inputmode="email" autocapitalize="off" spellcheck="false" required autocomplete="email">
                  <div class="kb-field-error" id="kb-err-email" role="alert" aria-live="assertive" hidden></div>
              </div>

              <div class="kb-form-row">
                <div class="kb-form-group" id="kb-group-telefono">
                  <label for="kb-input-telefono" id="kb-label-telefono">${this.t("phone")}</label>
                  <input type="tel" id="kb-input-telefono" placeholder="${this.t("phonePh")}" maxlength="24" inputmode="tel" autocomplete="tel" required>
                  <div class="kb-field-error" id="kb-err-telefono" role="alert" aria-live="assertive" hidden></div>
                  <label id="kb-wrap-no-phone" class="kb-checkbox-label" style="display: none; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; color: #475569; cursor: pointer;">
                    <input type="checkbox" id="kb-check-no-phone">
                    <span>No tiene celular propio (usar mi número de WhatsApp)</span>
                  </label>
                </div>
                <div class="kb-form-group">
                  <label for="kb-input-dni" id="kb-label-dni">${this.options.adminMode ? this.t("dniOptionalLabel") : this.t("dni")}</label>
                  <input type="text" id="kb-input-dni" placeholder="${this.options.adminMode ? this.t("dniOptionalPh") : this.t("dniPh")}" maxlength="20"${this.options.adminMode ? "" : " required"}>
                  <div class="kb-field-error" id="kb-err-dni" role="alert" aria-live="assertive" hidden></div>
                </div>
              </div>


              <div class="kb-actions">
                <button class="kb-btn kb-btn-secondary" id="kb-btn-prev-3">${this.t("back")}</button>
                <button class="kb-btn kb-btn-primary" id="kb-btn-submit">
                  ${this.t("confirm")}
                </button>
              </div>
              <p class="kb-privacy-notice">
                ${this.t("privacyNoticeBefore")}<a href="${this.t("privacyUrl")}" target="_blank" rel="noopener noreferrer">${this.t("privacyPolicyLabel")}</a>${this.t("privacyNoticeAfter")}
              </p>
            </div>

            <!-- PASO 4: CONFIRMACIÓN -->
            <div class="kb-step-panel" id="kb-step-4">
              <div class="kb-success-card">
                <div class="kb-success-icon">✓</div>
                <div class="kb-success-title" id="kb-success-title">${this.t("success")}</div>
                <p id="kb-success-subtitle" style="color: var(--kin-text-muted);">
                  ${this.t("saved")}
                </p>

                <div class="kb-summary-box" id="kb-success-summary"></div>

                <!-- Opciones para agregar a la agenda / calendario personal -->
                <div class="kb-calendar-sync-box" id="kb-calendar-sync-box">
                  <div class="kb-calendar-sync-header">
                    <span class="kb-calendar-sync-icon" aria-hidden="true">📅</span>
                    <div>
                      <div class="kb-calendar-sync-title">${this.t("saveCal")}</div>
                      <div class="kb-calendar-sync-subtitle">${this.t("saveCalSub")}</div>
                    </div>
                  </div>
                  <div class="kb-calendar-sync-actions">
                    <a href="#" target="_blank" rel="noopener noreferrer" class="kb-btn-cal kb-btn-cal-google" id="kb-btn-cal-google">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6c0-1.11-.89-2-2-2zm0 16H5V9h14v11z" fill="#4285F4"/>
                        <rect x="7" y="11" width="3" height="3" fill="#EA4335"/>
                        <rect x="11" y="11" width="3" height="3" fill="#FBBC05"/>
                        <rect x="15" y="11" width="3" height="3" fill="#34A853"/>
                      </svg>
                      <span>Google Calendar</span>
                    </a>
                    <button type="button" class="kb-btn-cal kb-btn-cal-ics" id="kb-btn-cal-ics">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span id="kb-btn-cal-ics-text">Apple / Outlook (.ics)</span>
                    </button>
                  </div>
                </div>

                <!-- Normas del consultorio para turnos presenciales -->
                <div class="kb-clinic-rules" id="kb-success-clinic-rules" style="display: none;">
                  <h4>${this.t("rulesTitle")}</h4>
                  <ul>
                    <li>${this.t("rulesAddr")}</li>
                    <li>${this.t("rulesTime")}</li>
                    <li>${this.t("rulesCompany")}</li>
                    <li>${this.t("rulesClothes")}</li>
                    <li>${this.t("rulesStudies")}</li>
                  </ul>
                  <div style="margin-top: 14px; text-align: center;">
                    <a href="https://maps.app.goo.gl/urpkh4HYe7dSdjPS9" target="_blank" rel="noopener" class="kb-btn kb-btn-primary" style="display: inline-flex; text-decoration: none;">
                      ${this.t("maps")}
                    </a>
                  </div>
                </div>

                ${this.options.isModal ? `
                  <div style="margin-top: 22px; text-align: center;">
                    <button type="button" class="kb-btn kb-btn-secondary" data-action="close-modal" style="width: auto; padding: 10px 28px; font-weight: 600;">
                      ${this.t("done")}
                    </button>
                  </div>
                ` : `
                  <div style="margin-top: 22px; text-align: center;">
                    <button type="button" class="kb-btn kb-btn-secondary" data-action="reset-widget" style="width: auto; padding: 10px 28px; font-weight: 600;">
                      ${this.t("newBooking")}
                    </button>
                  </div>
                `}

              </div>
            </div>

          </div>
        </div>
      `;
    }

    bindEvents() {
      const q = (sel) => this.container.querySelector(sel);

      // Eventos de cierre de modal si aplica
      if (this.options.onClose) {
        this.container.querySelectorAll('[data-action="close-modal"]').forEach((btn) => {
          btn.addEventListener("click", () => this.options.onClose());
        });
      }

      this.container.querySelectorAll('[data-action="reset-widget"]').forEach((btn) => {
        btn.addEventListener("click", () => this.reset());
      });

      this.renderPatientChoices();
      this.renderTechniqueChoices();

      q("#kb-btn-next-1").addEventListener("click", () => {
        if (this.options.adminMode && !this.validateAdminPatientFields()) return;
        if (this.state.existingPatient === true && !this.state.practitionerId) {
          this.showError(this.t("errWho"));
          return;
        }
        const technique = engine.getTechnique(this.state.techniqueId);
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

      const waExistingBtn = q("#kb-btn-wa-existing");
      if (waExistingBtn) {
        waExistingBtn.addEventListener("click", () => {
          if (!this.state.practitionerId) {
            this.showError(this.t("errWho"));
            return;
          }
          this.clearError();
          this.openPractitionerWhatsApp(this.state.practitionerId);
        });
      }

      q("#kb-btn-prev-2").addEventListener("click", () => {
        this.clearError();
        this.setStep(1);
      });

      const prefPill = q("#kb-step2-pref-pill");
      if (prefPill) {
        prefPill.addEventListener("click", () => {
          this.clearError();
          this.setStep(1);
          const prefBox = q("#kb-practitioner-box");
          if (prefBox && !prefBox.hidden) {
            prefBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });
      }

      const fallbackWaBtn = q("#kb-btn-fallback-whatsapp");
      if (fallbackWaBtn) {
        fallbackWaBtn.onclick = () => {
          this.openPractitionerWhatsApp(this.fallbackPractitionerId());
        };
      }

      q("#kb-btn-next-2").addEventListener("click", () => {
        if (!this.state.selectedDate || !this.state.selectedTime) {
          this.showError(this.t("errSlot"));
          return;
        }
        this.clearError();
        if (this.options.adminMode) {
          this.handleBookingSubmit();
          return;
        }
        this.setStep(3);
      });

      q("#kb-btn-prev-3").addEventListener("click", () => {
        this.clearError();
        this.setStep(2);
      });

      // Envío final
      q("#kb-btn-submit").addEventListener("click", () => this.handleBookingSubmit());

      // Errores por campo: se ocultan recién cuando el usuario modifica ESE campo.
      // Restricción de entrada en vivo para evitar que viajen caracteres inválidos.
      BookingWidget.FORM_FIELDS.forEach((field) => {
        const input = q(`#kb-input-${field}`);
        if (input) {
          input.addEventListener("input", () => {
            if (typeof input.value === "string") {
              const sanitized = BookingWidget.sanitizeFieldInput(field, input.value);
              if (sanitized !== input.value) input.value = sanitized;
            }
            this.clearFieldError(field);
          });
        }
      });
      const inputContactNotas = q("#kb-input-contacto-notas");
      if (inputContactNotas) {
        inputContactNotas.addEventListener("input", () => {
          if (typeof inputContactNotas.value === "string") {
            const sanitized = BookingWidget.sanitizeFieldInput("contacto-notas", inputContactNotas.value);
            if (sanitized !== inputContactNotas.value) inputContactNotas.value = sanitized;
          }
        });
      }
      const noPhoneToggle = q("#kb-check-no-phone");
      if (noPhoneToggle) noPhoneToggle.addEventListener("change", () => this.clearFieldError("telefono"));

      // Soporte de agendamiento para otra persona (terceros / familiares / etc.)
      const radioSelf = q("#kb-radio-self");
      const radioOther = q("#kb-radio-other");
      const thirdPartyBox = q("#kb-third-party-box");
      const patientHeader = q("#kb-patient-header");
      const wrapNoPhone = q("#kb-wrap-no-phone");
      const checkNoPhone = q("#kb-check-no-phone");
      const inputTel = q("#kb-input-telefono");
      const inputContactTel = q("#kb-input-contacto-telefono");

      const updateThirdPartyView = () => {
        const isOther = radioOther && radioOther.checked;
        if (thirdPartyBox) thirdPartyBox.style.display = isOther ? "block" : "none";
        if (patientHeader) patientHeader.style.display = isOther ? "block" : "none";
        if (wrapNoPhone) wrapNoPhone.style.display = isOther ? "inline-flex" : "none";
        const labelNombre = q("#kb-label-nombre");
        if (labelNombre) {
          labelNombre.textContent = isOther ? "Nombre y Apellido de quien asistirá *" : this.t("name");
        }
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
          if (checkNoPhone && checkNoPhone.checked && inputTel) {
            inputTel.value = inputContactTel.value;
          }
        });
      }


    }

    renderPatientChoices() {
      const grid = this.container.querySelector("#kb-patient-grid");
      grid.innerHTML = "";
      [
        { value: true, label: this.t("yes") },
        { value: false, label: this.t("no") },
      ].forEach((option) => {
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.patient = option.value ? "yes" : "no";
        card.innerHTML = `<h3>${option.label}</h3>`;
        card.addEventListener("click", () => this.selectExistingPatient(option.value));
        grid.appendChild(card);
      });
      this.renderExistingPractitionerChoices();
    }

    selectExistingPatient(isExisting) {
      this.state.existingPatient = isExisting;
      this.state.techniqueId = null;
      this.state.practitionerId = null;
      this.state.practitionerPreference = null;
      this.state.showMoreTechniques = false;
      this.container.querySelectorAll("#kb-patient-grid .kb-choice-card").forEach((card) => {
        const yes = card.dataset.patient === "yes";
        card.classList.toggle("selected", yes === isExisting);
      });
      const existingBox = this.container.querySelector("#kb-existing-box");
      const newBox = this.container.querySelector("#kb-new-box");
      // Mostrar/ocultar al instante (sin fade): un opacity 0→1 deja un hueco blanco = flash.
      if (existingBox) existingBox.hidden = !isExisting;
      if (newBox) newBox.hidden = isExisting;
      this.container.querySelectorAll("#kb-existing-practitioner-grid .kb-choice-card.selected, #kb-technique-grid .kb-choice-card.selected, #kb-technique-more-grid .kb-choice-card.selected").forEach((card) => {
        card.classList.remove("selected");
      });
      const practitionerBox = this.container.querySelector("#kb-practitioner-box");
      if (practitionerBox) practitionerBox.hidden = true;
      if (!isExisting) this.renderTechniqueChoices();
      if (this.options.adminMode) this.applyAdminPatientData();
      this.syncStep1Continue();
    }

    /**
     * Selecciona un paciente desde la turnera profesional de ADMIN.
     * Los datos existentes se muestran como referencia y solo quedan editables
     * los campos que realmente faltan en el directorio.
     */
    setAdminPatient(patient) {
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
    }

    setAdminNewPatient() {
      if (!this.options.adminMode) return;
      this.state.adminPatient = null;
      this.selectExistingPatient(false);
      this.applyAdminPatientData();
    }

    applyAdminPatientData() {
      if (!this.options.adminMode) return;
      const patient = this.state.adminPatient;
      const q = (sel) => this.container.querySelector(sel);
      const fullName = patient
        ? String(patient.nombre_completo || `${patient.nombre || ""} ${patient.apellido || ""}`).trim()
        : "";
      const values = {
        "#kb-input-nombre": fullName,
        "#kb-input-email": patient ? String(patient.email || "") : "",
        "#kb-input-telefono": patient ? String(patient.telefono || "") : "",
        "#kb-input-dni": patient ? String(patient.dni || "") : "",
      };
      Object.entries(values).forEach(([selector, value]) => {
        const input = q(selector);
        if (!input) return;
        if (patient) {
          input.value = value;
          input.readOnly = Boolean(value);
          input.setAttribute("aria-readonly", input.readOnly ? "true" : "false");
        } else {
          input.value = "";
          input.readOnly = false;
          input.removeAttribute("aria-readonly");
        }
      });
      const isNew = this.state.existingPatient === false;
      const hasSelection = Boolean(patient) || isNew;
      const footer = q("#kb-step-1 .kb-step1-footer");
      if (footer) footer.style.visibility = hasSelection ? "visible" : "hidden";
      // Si el paciente ya fue encontrado, el registro del directorio es la
      // fuente de verdad: no hay que completar email, documento ni teléfono
      // para poder agendar. Los datos disponibles viajan en el payload y los
      // que no existan quedan vacíos, sin bloquear la reserva.
      // DNI y email nunca son obligatorios en la turnera de admin.
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
    }

    renderExistingPractitionerChoices() {
      const grid = this.container.querySelector("#kb-existing-practitioner-grid");
      if (!grid) return;
      grid.innerHTML = "";
      Object.keys(engine.PRACTITIONERS).forEach((id) => {
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        if (this.state.practitionerId === id && this.state.techniqueId === "paciente") {
          card.classList.add("selected");
        }
        card.dataset.practitioner = id;
        card.innerHTML = `<h3>${this.practitionerFullName(id)}</h3>`;
        card.addEventListener("click", () => {
          this.state.practitionerId = id;
          this.state.techniqueId = "paciente";
          grid.querySelectorAll(".kb-choice-card").forEach((c) => {
            c.classList.toggle("selected", c.dataset.practitioner === id);
          });
          this.syncStep1Continue();
        });
        grid.appendChild(card);
      });
    }

    featuredTechniqueIds() {
      const ids = (engine && engine.FEATURED_TECHNIQUE_IDS) || ["no-se", "osteopatia", "rpg", "atm"];
      return ids.slice();
    }

    buildTechniqueCard(technique) {
      const card = document.createElement("div");
      card.className = "kb-choice-card";
      if (this.state.techniqueId === technique.id) {
        card.classList.add("selected");
      }
      card.dataset.technique = technique.id;
      card.innerHTML = this.options.adminMode
        ? `<h3>${this.techniqueLabel(technique)}</h3>`
        : `<h3>${this.techniqueLabel(technique)}</h3>${this.feeDisplayHtml(technique.id)}`;
      card.addEventListener("click", () => this.selectTechnique(technique.id));
      return card;
    }

    renderTechniqueChoices() {
      const grid = this.container.querySelector("#kb-technique-grid");
      if (!grid) return;
      grid.innerHTML = "";

      const featuredIds = this.featuredTechniqueIds();
      const all = engine.TECHNIQUES.filter((technique) => !technique.internal);
      const featured = featuredIds
        .map((id) => all.find((t) => t.id === id))
        .filter(Boolean);
      const more = all.filter((t) => featuredIds.indexOf(t.id) === -1);

      featured.forEach((technique) => {
        grid.appendChild(this.buildTechniqueCard(technique));
      });

      let moreWrap = this.container.querySelector("#kb-technique-more-wrap");
      if (!moreWrap) {
        moreWrap = document.createElement("div");
        moreWrap.id = "kb-technique-more-wrap";
        moreWrap.className = "kb-technique-more-wrap";
        grid.insertAdjacentElement("afterend", moreWrap);
      }
      moreWrap.innerHTML = "";

      if (!more.length) {
        moreWrap.hidden = true;
        return;
      }
      moreWrap.hidden = false;

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
      moreGrid.className = "kb-choice-grid kb-technique-more-grid";
      moreGrid.id = "kb-technique-more-grid";
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
    }

    /**
     * Selecciona una técnica en el Paso 1.
     * Si la técnica la atienden múltiples profesionales (ej. RPG o 'no-se'),
     * se preselecciona la preferencia 'any' (Indistinto) por defecto y se muestran las opciones.
     * Si la atiende un único profesional (ej. osteopatia -> Norberto, acupuntura -> María),
     * se fija el profesional y se ocultan las opciones de preferencia.
     * @param {string} techniqueId
     */
    selectTechnique(techniqueId) {
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
    }

    /**
     * Renderiza las opciones de preferencia de profesional (Hombre / Mujer / Indistinto).
     * Preselecciona 'Indistinto' por defecto cuando hay más de 1 profesional disponible.
     * @param {Object} technique
     */
    renderPractitionerChoices(technique) {
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
    }

    syncStep1Continue() {
      const btn = this.container.querySelector("#kb-btn-next-1");
      const waBtn = this.container.querySelector("#kb-btn-wa-existing");
      const technique = engine.getTechnique(this.state.techniqueId);
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
    }

    reset() {
      this._carouselSeq = (this._carouselSeq || 0) + 1;
      this._slotReqSeq = (this._slotReqSeq || 0) + 1;
      this._bookingAnalyticsSent = false;
      this.state = {
        step: 1,
        tipo: "session",
        appointmentType: "session",
        existingPatient: null,
        techniqueId: null,
        practitionerId: null,
        practitionerPreference: null,
        showMoreTechniques: false,
        selectedDate: null,
        selectedTime: null,
        availableSlots: [],
        isLoadingSlots: false,
        formData: {
          nombre: "",
          email: "",
          telefono: "",
          dni: "",
        },
        adminPatient: null,
        confirmedBooking: null,
      };

      this.clearError();

      const q = (sel) => this.container.querySelector(sel);

      this.container.querySelectorAll(".kb-choice-card.selected").forEach((card) => {
        card.classList.remove("selected");
      });

      const existingBox = q("#kb-existing-box");
      if (existingBox) existingBox.hidden = true;

      const newBox = q("#kb-new-box");
      if (newBox) newBox.hidden = true;

      const practitionerBox = q("#kb-practitioner-box");
      if (practitionerBox) practitionerBox.hidden = true;

      const carousel = q("#kb-date-carousel");
      if (carousel) carousel.innerHTML = "";

      const slotsGrid = q("#kb-slots-grid");
      if (slotsGrid) {
        slotsGrid.innerHTML = "";
        slotsGrid.style.display = "none";
      }

      const slotsLoading = q("#kb-slots-loading");
      if (slotsLoading) slotsLoading.style.display = "none";

      const slotsEmpty = q("#kb-slots-empty");
      if (slotsEmpty) slotsEmpty.style.display = "none";

      const slotsError = q("#kb-slots-error");
      if (slotsError) slotsError.style.display = "none";

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
    }

    collectAttendanceDays(limit) {
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
    }

    prefetchUpcomingDays() {
      if (this._prefetchRun) return;
      this._prefetchRun = true;
      this._prefetchedSlots = this._prefetchedSlots || {};
      const cacheGen = this._slotCacheGen || 0;
      const days = this.collectAttendanceDays(14);
      const run = async () => {
        let rangeOk = false;
        if (this.client && typeof this.client.getSlotsRange === "function") {
          try {
            rangeOk = await this.client.getSlotsRange(days.map((day) => day.iso));
          } catch (e) {
            rangeOk = false;
          }
        }
        if (cacheGen !== (this._slotCacheGen || 0)) return;

        // Si getSlotsRange funcionó o no, aseguramos que los primeros 3 a 5 días estén precargados
        const initialBatch = days.slice(0, 4);
        await Promise.all(
          initialBatch.map(async (day) => {
            if (cacheGen !== (this._slotCacheGen || 0)) return;
            if (this._prefetchedSlots[day.iso]) return;
            try {
              const slots = await this.fetchFilteredSlots(day.iso);
              if (cacheGen !== (this._slotCacheGen || 0)) return;
              this._prefetchedSlots[day.iso] = slots;
            } catch (err) {}
          })
        );

        // Prefech del resto en tandas para no saturar
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
    }

    updateDniRequirement() {
      const label = this.container.querySelector("#kb-label-dni");
      const input = this.container.querySelector("#kb-input-dni");
      const optional = Boolean(this.options.adminMode);
      if (label) label.textContent = optional ? this.t("dniOptionalLabel") : this.t("dni");
      if (input) {
        input.placeholder = optional ? this.t("dniOptionalPh") : this.t("dniPh");
        if (optional) input.removeAttribute("required");
        else input.setAttribute("required", "required");
      }
    }

    setStep(stepNumber) {
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

      // Auto-agenda: DNI obligatorio. Admin: opcional.
      if (stepNumber === 3) this.updateDniRequirement();

      // Título y subtítulo paso 2
      const step2Title = this.container.querySelector("#kb-step-2 .kb-section-title");
      if (step2Title) {
        const named = this.state.existingPatient === true && this.state.practitionerId
          ? this.practitionerFullName(this.state.practitionerId)
          : "";
        step2Title.textContent = named
          ? `${this.t("slotTitleWith")} ${named}`
          : this.t("slotTitle");
      }

      // Indicador sutil de preferencia de profesional (Hombre / Mujer / Indistinto)
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
        const techniqueForSub = engine.getTechnique(this.state.techniqueId);
        subtitle.textContent = (techniqueForSub && techniqueForSub.bySchedule) || !this.state.practitionerId
          ? this.t("sessionHour")
          : this.t("sessionPro");
        subtitle.style.display = "block";
      }
    }

    dayHasAttendance(date) {
      const technique = engine.getTechnique(this.state.techniqueId);
      const ids = this.state.practitionerId
        ? [this.state.practitionerId]
        : (technique && technique.practitioners) || Object.keys(engine.PRACTITIONERS);
      const works = ids.some((id) => engine.getWorkingWindows(id, date).length > 0);
      return engine.isBusinessDay(date) && works;
    }

    practitionersForSlot(dateIso, timeHm) {
      const onDuty = engine.practitionersAt(dateIso, timeHm);
      const chosen = engine.getTechnique(this.state.techniqueId);
      if (chosen && Array.isArray(chosen.practitioners) && !chosen.bySchedule) {
        return onDuty.filter((id) => chosen.practitioners.indexOf(id) !== -1);
      }
      return onDuty;
    }

    createDateCard(day) {
      const card = document.createElement("div");
      card.className = "kb-date-card";
      card.dataset.date = day.iso;
      card.innerHTML = `
        <div class="kb-date-dow">${this.copy.dows[day.current.getDay()]}</div>
        <div class="kb-date-day">${day.current.getDate()}</div>
        <div class="kb-date-month">${this.copy.months[day.current.getMonth()]}</div>
      `;
      card.addEventListener("click", () => {
        this.selectDate(day.iso);
      });
      return card;
    }

    async replenishCarouselIfNeeded(seq) {
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
        if (!nextDay || carousel.querySelector(`.kb-date-card[data-date="${nextDay.iso}"]`)) {
          continue;
        }
        try {
          const slots = await this.fetchFilteredSlots(nextDay.iso);
          if (seq !== this._carouselSeq) return;
          this._prefetchedSlots[nextDay.iso] = slots;
          if (slots && slots.length > 0) {
            carousel.appendChild(this.createDateCard(nextDay));
          }
        } catch (err) {}
      }
    }

    async renderDateCarousel() {
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
          this.client.getSlotsRange(allCandidateDays.map((day) => day.iso)).catch(() => {});
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
        this.pruneEmptyDays(days.filter((day) => day.iso !== selected), seq);
      } catch (err) {
        if (seq !== this._carouselSeq) return;
        this.showSlotsError(err, null);
      }
    }

    async pruneEmptyDays(days, seq) {
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
    }

    async fetchFilteredSlots(dateIso, forceRefresh = false) {
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
    }

    async selectDate(dateIso) {
      this.state.selectedDate = dateIso;
      this.state.selectedTime = null;
      this.container.querySelector("#kb-btn-next-2").disabled = true;

      const cards = this.container.querySelectorAll(".kb-date-card");
      cards.forEach((c) => {
        c.classList.toggle("selected", c.dataset.date === dateIso);
      });

      await this.loadSlotsForDate(dateIso);
    }

    showSlotsError(err, dateIso) {
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
      if (grid) {
        grid.style.display = "none";
        grid.innerHTML = "";
      }
      if (!errorBox) return;

      errorBox.style.display = "flex";
      const errorText = this.container.querySelector("#kb-slots-error-text");
      if (errorText) {
        errorText.textContent = this.t("slotError");
      }
      // Always Norberto on slot failures — never Clara (active WhatsApp), who redirects to the site.
      const fallbackPrac = "norberto";
      const fallbackText = this.container.querySelector("#kb-slots-error-fallback");
      if (fallbackText) {
        fallbackText.textContent = this.t("slotFallbackText");
      }
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
          if (this._prefetchedSlots && targetDate) {
            delete this._prefetchedSlots[targetDate];
          }
          if (this.client && typeof this.client.clearCache === "function") {
            this.client.clearCache();
          }
          if (targetDate) {
            this.loadSlotsForDate(targetDate, true);
          } else {
            this.renderDateCarousel();
          }
        };
      }
    }

    async loadSlotsForDate(dateIso, forceRefresh = false) {
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
      // Si ya hay slots en caché, no vaciar el grid (evita flash blanco al cambiar de día).
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
        if (!Array.isArray(rawSlots)) {
          throw new Error("Error al procesar los horarios disponibles");
        }
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
          const onDuty = !this.state.practitionerId
            ? this.practitionersForSlot(dateIso, slot.time)
            : [];
          const dutyLabel = onDuty.length === 1 ? ` · ${this.practitionerGenderLabel(onDuty[0])}` : "";
          const hs = this.t("hs");
          chip.textContent = `${slot.time}${hs ? " " + hs : ""}${dutyLabel}`;
          chip.dataset.time = slot.time;

          chip.addEventListener("click", () => {
            this.state.selectedTime = slot.time;
            const chips = grid.querySelectorAll(".kb-slot-chip");
            chips.forEach((ch) => ch.classList.remove("selected"));
            chip.classList.add("selected");
            this.container.querySelector("#kb-btn-next-2").disabled = false;
          });

          grid.appendChild(chip);
        });
      } catch (err) {
        if (currentReq !== this._slotReqSeq) return;
        this.showSlotsError(err, dateIso);
      }
    }

    /**
     * Filtra los turnos garantizando el margen de anticipación cuando la consulta es para hoy:
     * Turnos presenciales (60 min): mínimo 2 horas de margen de traslado al consultorio.
     */
    restrictToPractitioner(slots, dateIso) {
      const id = this.state.practitionerId;
      if (!id || !Array.isArray(slots)) return slots || [];
      const windows = engine.getWorkingWindows(id, dateIso);
      return slots.filter((slot) => {
        const parts = String(slot.time || "").split(":");
        const tMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
        return windows.some((w) => tMin >= w.startMin && tMin + engine.SESSION_DURATION_MINUTES <= w.endMin);
      });
    }

    filterSlotsWithBuffer(slots, dateIso, appointmentType) {
      if (!Array.isArray(slots) || slots.length === 0) return [];

      let todayArg = "";
      try {
        todayArg = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Argentina/Buenos_Aires",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      } catch (e) {
        const d = new Date(Date.now() - 3 * 3600 * 1000);
        todayArg = d.toISOString().slice(0, 10);
      }

      // Si no es para la fecha de hoy en Argentina, no se aplica buffer relativo a now
      if (dateIso !== todayArg) {
        return slots;
      }

      const bufferHours = engine.SESSION_BUFFER_HOURS || 2;
      const minAllowedTimestamp = Date.now() + bufferHours * 3600 * 1000;

      return slots.filter((slot) => {
        let slotTimestamp = 0;
        if (slot.startIso) {
          slotTimestamp = new Date(slot.startIso).getTime();
        } else if (slot.time) {
          // Buenos Aires siempre es UTC-3
          slotTimestamp = new Date(`${dateIso}T${slot.time}:00-03:00`).getTime();
        }
        return slotTimestamp >= minAllowedTimestamp;
      });
    }

    async handleBookingSubmit() {
      this.clearError();
      const q = (sel) => this.container.querySelector(sel);

      if (!this.state.selectedDate || !this.state.selectedTime) {
        this.showError(this.t("errSlot"));
        this.setStep(2);
        return;
      }

      const isOther = q("#kb-radio-other") && q("#kb-radio-other").checked;
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
      const fieldErrors = skipValidation ? [] : BookingWidget.validateContactForm({
        isOther,
        contactoNombre,
        contactoTelefono,
        nombre,
        email,
        emailOptional: Boolean(this.options.adminMode),
        dni,
        dniOptional: Boolean(this.options.adminMode),
        telefono,
        usesContactPhone,
        confirmedPhones: this._confirmedPhones,
        confirmedEmails: this._confirmedEmails,
      }, (key) => this.t(key));
      if (fieldErrors.length) {
        fieldErrors.forEach((err) => {
          if (err.isSoftPhoneConfirm && err.phoneDigits) {
            this._confirmedPhones.add(err.phoneDigits);
          }
          if (err.isSoftEmailConfirm && err.emailValue) {
            this._confirmedEmails.add(err.emailValue);
          }
        });
        this.showFieldErrors(fieldErrors);
        if (this.options.adminMode) this.setStep(1);
        return;
      }

      const slotPractitioners = this.practitionersForSlot(this.state.selectedDate, this.state.selectedTime);
      const effectivePractitionerId =
        this.state.practitionerId ||
        (slotPractitioners.length === 1 ? slotPractitioners[0] : null);

      const chosenTech = engine.getTechnique(this.state.techniqueId);
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
        nombre: nombre,
        email: email,
        telefono: telefono,
        dni: dni,
        adminMode: Boolean(this.options.adminMode),
        motivo: especialidad,
        especialidad: especialidad,
        esParaTercero: isOther,
        contactoNombre: contactoNombre,
        contactoTelefono: contactoTelefono,
        contactoNotas: contactoNotas,
        isMenor: Boolean(isOther && (/hijo|menor/i.test(contactoNotas) || (checkNoPhone && checkNoPhone.checked))),
        nombreFamiliar: contactoNombre,
        notas: isOther ? `Agendado por: ${contactoNombre} (${contactoTelefono})` : "",
      };

      const btnSubmit = this.options.adminMode ? q("#kb-btn-next-2") : q("#kb-btn-submit");
      btnSubmit.disabled = true;
      btnSubmit.textContent = this.t("saving");

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

        // Se envía solo en la confirmación de turno (incluye código de gestión)
        const mailMeta = await this.sendConfirmationEmail(payload, result);
        if (mailMeta && mailMeta.manageCode) {
          result.manageCode = mailMeta.manageCode;
          result.manageUrl = mailMeta.manageUrl || this.defaultManageUrl();
        }

        this.trackBookingConversion(payload, result);
        this.renderConfirmation(payload, result);
        this.setStep(4);
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("booking submit failed", err);
        }
        this.showError(this.friendlySubmitError(err), {
          offerWhatsAppFallback: Boolean(err && err.bothSystemsFailed),
        });
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = this.options.adminMode ? "Confirmar turno" : this.t("confirm");
      }
    }

    /**
     * GA4 + dataLayer conversion for a confirmed booking (or consulta enviada).
     * Once per reservation; skipped in adminMode. No PII.
     */
    bookingAnalyticsParams(payload) {
      const appointmentType = String(
        (payload && payload.appointmentType) || this.state.appointmentType || "session"
      ).toLowerCase();
      const bookingType = appointmentType === "call" ? "consulta" : "presencial";

      let service = "";
      const techniqueId = payload && payload.techniqueId;
      if (techniqueId && techniqueId !== "no-se" && techniqueId !== "paciente") {
        const technique = engine.getTechnique(techniqueId);
        if (technique && !technique.bySchedule && !technique.internal) {
          service = technique.id || "";
        }
      }
      if (!service && payload && payload.especialidad && payload.especialidad !== "No especifica") {
        service = String(payload.especialidad).slice(0, 80);
      }

      const params = {
        booking_type: bookingType,
        value: 1,
        currency: "ARS",
      };
      if (service) params.service = service;
      return params;
    }

    /**
     * True when the success path is "consulta enviada" (no confirmed calendar slot).
     * Current public flow only confirms presencial sessions; kept for a future/legacy call path.
     */
    isConsultaEnviadaResult(payload, result) {
      const appointmentType = String(
        (payload && payload.appointmentType) || (result && result.appointmentType) || ""
      ).toLowerCase();
      if (appointmentType === "call") return true;
      const status = String((result && result.status) || "").toLowerCase();
      return status === "consulta_enviada" || status === "inquiry_sent";
    }

    trackBookingConversion(payload, result) {
      if (this.options.adminMode) return;
      if (this._bookingAnalyticsSent) return;
      this._bookingAnalyticsSent = true;

      const params = this.bookingAnalyticsParams(payload);
      const isConsulta = this.isConsultaEnviadaResult(payload, result);
      const eventName = isConsulta
        ? "kinesica_consulta_enviada"
        : "kinesica_agenda_confirmada";

      if (typeof window.kinesicaPushEvent === "function") {
        window.kinesicaPushEvent(eventName, params);
        return;
      }

      // Fallback if ui-core/gtm-events has not loaded: dataLayer only (no duplicate gtag bootstrap).
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, params));
    }

    async sendConfirmationEmail(payload, bookResult) {
      if (!payload || !payload.email) return null;
      try {
        const professionalName = this.practitionerFullName(payload.practitionerId) || "Lic. Norberto Brude";
        const technique = engine.getTechnique(payload.techniqueId);
        let serviceName = technique && !technique.bySchedule && !technique.internal ? technique.label : (payload.especialidad || "");
        if (!serviceName || serviceName === "No especifica" || /osteopat[ií]a/i.test(serviceName)) {
          serviceName = "Terapias Manuales";
        }

        const eventId = (bookResult && bookResult.eventId) || "";
        const body = {
          email: payload.email,
          paciente: payload.nombre,
          telefono: payload.telefono,
          dni: payload.dni,
          fecha: payload.date,
          hora: payload.time,
          profesional: professionalName,
          servicio: serviceName,
          motivo: payload.motivo || payload.especialidad,
          esMenor: Boolean(payload.isMenor),
          esParaTercero: Boolean(payload.esParaTercero),
          contactoNombre: payload.contactoNombre || "",
          contactoTelefono: payload.contactoTelefono || "",
          contactoNotas: payload.contactoNotas || "",
          eventId,
          practitionerId: payload.practitionerId || "",
        };

        const postConfirm = (extra) =>
          fetch("/api/send-confirmation.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign({}, body, extra || {})),
          });

        let res = await postConfirm();
        // Si el mail falló tras haber adjuntado el hash, un reintento con rotate
        // permite incluir un código nuevo en el segundo mail (el primero no llegó).
        if (!res.ok && eventId) {
          res = await postConfirm({ retry: true, rotate_manage_code: true });
        }
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        return data && data.success ? data : null;
      } catch (err) {
        console.warn("No se pudo enviar el correo de confirmación:", err);
        return null;
      }
    }

    formatConfirmationWhen(dateIso, time) {
      const parts = String(dateIso || "").split("-");
      const day = parts.length === 3 ? `${parts[2]}/${parts[1]}` : String(dateIso || "");
      const hm = String(time || "").slice(0, 5);
      return `${day} ${this.t("at")} ${hm} hs`;
    }

    escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    /** Mensaje seguro para UI: evita HTTP/stack/fetch crudos. */
    friendlySubmitError(err) {
      const raw = String((err && err.message) || "").trim();
      const fallback = this.t("bookError");
      if (!raw) return fallback;
      if (
        raw.length > 180
        || /HTTP Error|Failed to fetch|NetworkError|TypeError|ECONN|SQLSTATE|stack|at \w+\s*\(/i.test(raw)
      ) {
        return fallback;
      }
      return raw;
    }

    defaultManageUrl() {
      const lang = this.lang || "es";
      if (lang === "en") return "/en/mi-turno.html";
      if (lang === "fr") return "/fr/mi-turno.html";
      if (lang === "pt") return "/pt/mi-turno.html";
      return "/mi-turno.html";
    }

    safeManageUrl(raw) {
      const fallback = this.defaultManageUrl();
      const url = String(raw || fallback).trim();
      if (/^\/(?:[a-z]{2}\/)?mi-turno\.html(?:[?#].*)?$/i.test(url)) {
        return url;
      }
      return fallback;
    }

    renderConfirmation(payload, result) {
      const q = (sel) => this.container.querySelector(sel);
      const esc = (v) => this.escapeHtml(v);

      const technique = engine.getTechnique(payload.techniqueId);
      const professional = this.practitionerFullName(payload.practitionerId) || this.t("bySchedulePro");
      const isExisting = Boolean(payload.esPaciente || this.state.existingPatient || payload.techniqueId === "paciente");
      q("#kb-success-title").textContent = this.t("success");

      const manageUrl = this.safeManageUrl(result && result.manageUrl);
      const summaryBox = q("#kb-success-summary");
      summaryBox.innerHTML = `
        <div style="font-weight: 700; color: var(--kin-green-deep); margin-bottom: 8px;">
          ${esc(this.t("summaryKind"))}
        </div>
        ${technique && !technique.bySchedule && !technique.internal ? `<div><strong>${esc(this.t("technique"))}:</strong> ${esc(this.techniqueLabel(technique))}</div>` : ""}
        <div><strong>${esc(this.t("practitioner"))}:</strong> ${esc(professional)}</div>
        <div><strong>${esc(this.t("patient"))}:</strong> ${esc(payload.nombre)}</div>
        <div><strong>${esc(this.t("when"))}:</strong> ${esc(this.formatConfirmationWhen(payload.date, payload.time))}</div>
        ${!isExisting && !this.options.adminMode ? `<div><strong>${esc(this.t("fee"))}:</strong> ${esc(this.feeDisplayHtml(payload.techniqueId, { compact: true }))} <span style="font-size: 12px; color: var(--kin-text-muted);">(${esc(this.t("paymentMethodsNote"))})</span></div>` : ""}
        ${payload.email ? `<div><strong>${esc(this.t("email"))}:</strong> ${esc(payload.email)}</div>` : ""}
        ${result.manageCode ? `<div style="margin-top: 10px; padding: 10px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
          <div><strong>${esc(this.t("manageCode"))}</strong> <code style="font-size: 16px; letter-spacing: 0.08em; font-weight: 700; color: #0f766e;">${esc(result.manageCode)}</code></div>
          <div style="margin-top: 6px; font-size: 12px; color: var(--kin-text-muted);">
            ${esc(this.t("manageHint"))}
            <a href="${esc(manageUrl)}" style="color: var(--kin-blue, #005f99); font-weight: 600;">${esc(this.t("manageLink"))}</a>.
          </div>
        </div>` : ""}
        ${this.options.adminMode ? `<div style="margin-top: 6px; font-size: 12px; color: var(--kin-text-muted);">
          ${esc(this.t("eventId"))} <code>${esc(result.eventId || "OK")}</code>
        </div>` : ""}
      `;

      // Reglas del consultorio sólo si es presencial
      const clinicRules = q("#kb-success-clinic-rules");
      clinicRules.style.display = this.options.adminMode ? "none" : "block";

      const subtitle = q("#kb-success-subtitle");
      if (subtitle) subtitle.hidden = true;

      const calBox = q("#kb-calendar-sync-box");
      if (this.options.adminMode) {
        if (calBox) calBox.style.display = "none";
        return;
      }
      this.setupCalendarButtons(payload, result);
    }

    setupCalendarButtons(payload, result) {
      const q = (sel) => this.container.querySelector(sel);
      const data = engine && engine.generateCalendarExportData
        ? engine.generateCalendarExportData(payload, result && result.eventId)
        : null;

      if (!data) return;

      const gcalBtn = q("#kb-btn-cal-google");
      if (gcalBtn) {
        gcalBtn.href = data.googleCalendarUrl;
      }

      const icsBtn = q("#kb-btn-cal-ics");
      if (icsBtn) {
        icsBtn.onclick = (e) => {
          e.preventDefault();
          try {
            const blob = new Blob([data.icsContent], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);

            const txt = q("#kb-btn-cal-ics-text");
            if (txt) {
              const orig = txt.textContent;
              txt.textContent = this.t("downloaded");
              setTimeout(() => {
                txt.textContent = orig;
              }, 2500);
            }
          } catch (err) {
            console.error("Error al generar archivo .ics:", err);
          }
        };
      }
    }

    showError(msg, opts) {
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
    }

    clearError() {
      const banner = this.container.querySelector("#kb-error-banner");
      if (!banner) return;
      banner.textContent = "";
      banner.classList.remove("visible");
    }

    /** Muestra cada error junto a su campo (borde, aria-invalid, aria-describedby, role=alert) y enfoca el primero. */
    showFieldErrors(errors) {
      this.clearAllFieldErrors();
      let first = null;
      (errors || []).forEach(({ field, message }) => {
        const input = this.container.querySelector(`#kb-input-${field}`);
        const box = this.container.querySelector(`#kb-err-${field}`);
        if (box) {
          box.textContent = message;
          box.hidden = false;
        }
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
    }

    clearFieldError(field) {
      const input = this.container.querySelector(`#kb-input-${field}`);
      const box = this.container.querySelector(`#kb-err-${field}`);
      if (box) {
        box.textContent = "";
        box.hidden = true;
      }
      if (input) {
        input.classList.remove("kb-input-invalid");
        input.removeAttribute("aria-invalid");
        if (box && input.getAttribute("aria-describedby") === box.id) input.removeAttribute("aria-describedby");
      }
    }

    clearAllFieldErrors() {
      BookingWidget.FORM_FIELDS.forEach((field) => this.clearFieldError(field));
    }
  }

  // Integración modular de validación y sanitización
  const Val = validationModule || (typeof window !== "undefined" && window.KinesicaBookingValidation) || {};

  BookingWidget.FORM_FIELDS = Val.FORM_FIELDS || ["contacto-nombre", "contacto-telefono", "nombre", "email", "telefono", "dni"];
  BookingWidget.sanitizeFieldInput = Val.sanitizeFieldInput;
  BookingWidget.isValidEmail = Val.isValidEmail;
  BookingWidget.suggestEmailDomain = Val.suggestEmailDomain;
  BookingWidget.inspectPhone = Val.inspectPhone;
  BookingWidget.isValidDni = Val.isValidDni;
  BookingWidget.validateContactForm = Val.validateContactForm;

  return BookingWidget;
});
