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
    define(["./booking-engine", "./booking-api-client"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"), require("./booking-api-client"));
  } else {
    root.KinesicaBookingWidget = factory(root.KinesicaBookingEngine, root.KinesicaBookingClient);
  }
})(typeof self !== "undefined" ? self : this, function (engine, clientModule) {
  "use strict";

  const MONTH_NAMES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];
  const DOW_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  class BookingWidget {
    constructor(containerId, options) {
      this.container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
      if (!this.container) {
        throw new Error(`Contenedor no encontrado: ${containerId}`);
      }

      this.options = options || {};
      this.client = new clientModule.BookingClient(options);

      // Estado del flujo
      this.state = {
        step: 1,
        tipo: "session",
        appointmentType: "session",
        existingPatient: null,
        techniqueId: null,
        practitionerId: null,
        selectedDate: null,
        selectedTime: null,
        availableSlots: [],
        isLoadingSlots: false,
        formData: {
          nombre: "",
          telefono: "",
          dni: "",
        },
        confirmedBooking: null,
      };

      this.init();
    }

    init() {
      this.renderSkeleton();
      this.bindEvents();
      if (this.client && typeof this.client.prewarm === "function") {
        this.client.prewarm();
      }

      this.setStep(1);
    }

    renderSkeleton() {
      this.container.innerHTML = `
        <div class="kinesica-booking-container">
          <div class="kb-header">
            ${this.options.isModal ? '<button type="button" class="kb-close-btn" aria-label="Cerrar ventana de reservas" data-action="close-modal">&times;</button>' : ''}
            <h2>Agendar</h2>
            <p>Consultorio de Kinesiología, Osteopatía, RPG y ATM en Palermo, CABA</p>
          </div>

          <div class="kb-stepper">
            <div class="kb-step-item active" data-step-indicator="1">
              <span class="kb-step-num">1</span> Inicio
            </div>
            <div class="kb-step-item" data-step-indicator="2">
              <span class="kb-step-num">2</span> Día y Horario
            </div>
            <div class="kb-step-item" data-step-indicator="3">
              <span class="kb-step-num">3</span> Tus Datos
            </div>
            <div class="kb-step-item" data-step-indicator="4">
              <span class="kb-step-num">4</span> Confirmación
            </div>
          </div>

          <div class="kb-body">
            <div id="kb-error-banner" class="kb-error-banner"></div>

            <!-- PASO 1: PACIENTE → PROFESIONAL O TÉCNICA -->
            <div class="kb-step-panel active" id="kb-step-1">
              <div class="kb-section-title">¿Ya te has atendido con nosotros?</div>
              <div class="kb-choice-grid" id="kb-patient-grid"></div>

              <div id="kb-existing-box" style="display: none; margin-top: 18px;">
                <div class="kb-section-title" style="font-size: 1.05rem;">¿Quién te atiende?</div>
                <div class="kb-choice-grid" id="kb-existing-practitioner-grid"></div>
              </div>

              <div id="kb-new-box" style="display: none; margin-top: 18px;">
                <div class="kb-section-title" style="font-size: 1.05rem;">¿Buscás alguna técnica en particular?</div>
                <div class="kb-choice-grid" id="kb-technique-grid"></div>
                <div id="kb-practitioner-box" style="display: none; margin-top: 18px;">
                  <div class="kb-section-title" style="font-size: 1.05rem;">¿Con quién preferís atenderte?</div>
                  <div class="kb-choice-grid" id="kb-practitioner-grid"></div>
                </div>
              </div>

              <div style="margin-top: 16px; text-align: right;">
                <button class="kb-btn kb-btn-primary" id="kb-btn-next-1" disabled>
                  Ver horarios disponibles →
                </button>
              </div>
            </div>

            <!-- PASO 2: DÍA Y HORA -->
            <div class="kb-step-panel" id="kb-step-2">
              <div class="kb-section-title">Elige el día y horario</div>
              <div class="kb-section-desc" id="kb-slots-subtitle" style="display: none;"></div>

              <label class="kb-slots-label">Días disponibles:</label>
              <div class="kb-date-scroll" id="kb-date-carousel"></div>

              <label class="kb-slots-label" id="kb-slots-grid-title">Horarios disponibles:</label>
              <div id="kb-slots-container">
                <div id="kb-slots-loading" class="kb-state-box" style="display: none;">
                  <div class="kb-spinner"></div>
                  <span>Consultando disponibilidad...</span>
                </div>
                <div id="kb-slots-empty" class="kb-state-box" style="display: none;">
                  <span>No hay horarios disponibles para esta fecha.<br>Por favor selecciona otro día en el calendario superior.</span>
                </div>
                <div id="kb-slots-error" class="kb-state-box" style="display: none; border-color: var(--kin-danger); color: var(--kin-danger);">
                  <span id="kb-slots-error-text"></span>
                  <button class="kb-btn kb-btn-secondary" id="kb-btn-retry-slots" style="margin-top: 6px; font-size: 13px; padding: 6px 14px;">↺ Reintentar</button>
                </div>
                <div class="kb-slots-grid" id="kb-slots-grid"></div>
              </div>

              <div class="kb-actions">
                <button class="kb-btn kb-btn-secondary" id="kb-btn-prev-2">← Volver</button>
                <button class="kb-btn kb-btn-primary" id="kb-btn-next-2" disabled>
                  Continuar a tus Datos →
                </button>
              </div>
            </div>

            <!-- PASO 3: FORMULARIO -->
            <div class="kb-step-panel" id="kb-step-3">
              <div class="kb-section-title">Completa tus datos de contacto</div>
              <div class="kb-section-desc">Esta información nos permite asentar tu reserva y contactarte puntualmente.</div>

              <div class="kb-form-group">
                <label for="kb-input-nombre">Nombre y Apellido Completo *</label>
                <input type="text" id="kb-input-nombre" placeholder="Ej: Juan Pérez" required>
              </div>

              <div class="kb-form-row">
                <div class="kb-form-group">
                  <label for="kb-input-telefono">Teléfono / WhatsApp *</label>
                  <input type="tel" id="kb-input-telefono" placeholder="Ej: +54 9 11 0000-0000" required>
                </div>
                <div class="kb-form-group">
                  <label for="kb-input-dni" id="kb-label-dni">DNI / Documento</label>
                  <input type="text" id="kb-input-dni" placeholder="Ej: 00.000.000">
                </div>
              </div>


              <div class="kb-actions">
                <button class="kb-btn kb-btn-secondary" id="kb-btn-prev-3">← Volver</button>
                <button class="kb-btn kb-btn-primary" id="kb-btn-submit">
                  Confirmar Reserva 🌿
                </button>
              </div>
            </div>

            <!-- PASO 4: CONFIRMACIÓN -->
            <div class="kb-step-panel" id="kb-step-4">
              <div class="kb-success-card">
                <div class="kb-success-icon">✓</div>
                <div class="kb-success-title" id="kb-success-title">¡Reserva Confirmada!</div>
                <p id="kb-success-subtitle" style="color: var(--kin-text-muted);">
                  Tu cita ya quedó registrada oficialmente en Google Calendar.
                </p>

                <div class="kb-summary-box" id="kb-success-summary"></div>

                <!-- Opciones para agregar a la agenda / calendario personal -->
                <div class="kb-calendar-sync-box" id="kb-calendar-sync-box">
                  <div class="kb-calendar-sync-header">
                    <span class="kb-calendar-sync-icon" aria-hidden="true">📅</span>
                    <div>
                      <div class="kb-calendar-sync-title">¿Querés guardar el turno en tu agenda?</div>
                      <div class="kb-calendar-sync-subtitle">Agregalo con un clic a tu calendario para tener el recordatorio en tu celular:</div>
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
                  <h4>📍 Información Importante para tu Asistencia al Consultorio:</h4>
                  <ul>
                    <li><strong>Dirección:</strong> Charcas 3889, Piso 5º, Depto B, Palermo (entre Scalabrini Ortiz y Aráoz).</li>
                    <li>Te pedimos que llegues a la hora de la sesión, ni antes ni después, por características del espacio y la organización.</li>
                    <li><strong>Sin acompañantes:</strong> La sesión es personalizada. Rogamos no asistir con acompañantes (salvo menores de edad o personas que requieran asistencia directa).</li>
                    <li><strong>Estudios previos:</strong> Si contás con radiografías, resonancias o informes médicos, por favor traelos a la sesión.</li>
                  </ul>
                  <div style="margin-top: 14px; text-align: center;">
                    <a href="https://maps.app.goo.gl/urpkh4HYe7dSdjPS9" target="_blank" rel="noopener" class="kb-btn kb-btn-primary" style="display: inline-flex; text-decoration: none;">
                      🗺️ Abrir en Google Maps
                    </a>
                  </div>
                </div>

                ${this.options.isModal ? `
                  <div style="margin-top: 22px; text-align: center;">
                    <button type="button" class="kb-btn kb-btn-secondary" data-action="close-modal" style="width: auto; padding: 10px 28px; font-weight: 600;">
                      ✓ Listo, finalizar y cerrar
                    </button>
                  </div>
                ` : ""}

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

      this.renderPatientChoices();
      this.renderTechniqueChoices();

      q("#kb-btn-next-1").addEventListener("click", () => {
        const technique = engine.getTechnique(this.state.techniqueId);
        if (this.state.existingPatient === true && !this.state.practitionerId) {
          this.showError("Elegí quién te atiende para ver los horarios.");
          return;
        }
        if (this.state.existingPatient !== true && (!technique || (!technique.bySchedule && !this.state.practitionerId))) {
          this.showError("Elegí la técnica para ver los horarios.");
          return;
        }
        this.clearError();
        this.state.selectedDate = null;
        this.state.selectedTime = null;
        this.renderDateCarousel();
        this.setStep(2);
      });

      q("#kb-btn-prev-2").addEventListener("click", () => {
        this.clearError();
        this.setStep(1);
      });

      q("#kb-btn-next-2").addEventListener("click", () => {
        if (!this.state.selectedDate || !this.state.selectedTime) {
          this.showError("Por favor selecciona un día y horario antes de continuar.");
          return;
        }
        this.clearError();
        this.setStep(3);
      });

      q("#kb-btn-prev-3").addEventListener("click", () => {
        this.clearError();
        this.setStep(2);
      });

      // Envío final
      q("#kb-btn-submit").addEventListener("click", () => this.handleBookingSubmit());


    }

    renderPatientChoices() {
      const grid = this.container.querySelector("#kb-patient-grid");
      grid.innerHTML = "";
      [
        { value: true, label: "Sí" },
        { value: false, label: "No" },
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
      this.container.querySelectorAll("#kb-patient-grid .kb-choice-card").forEach((card) => {
        const yes = card.dataset.patient === "yes";
        card.classList.toggle("selected", yes === isExisting);
      });
      const existingBox = this.container.querySelector("#kb-existing-box");
      const newBox = this.container.querySelector("#kb-new-box");
      existingBox.style.display = isExisting ? "block" : "none";
      newBox.style.display = isExisting ? "none" : "block";
      this.container.querySelectorAll("#kb-existing-practitioner-grid .kb-choice-card, #kb-technique-grid .kb-choice-card").forEach((card) => {
        card.classList.remove("selected");
      });
      const practitionerBox = this.container.querySelector("#kb-practitioner-box");
      if (practitionerBox) practitionerBox.style.display = "none";
      this.syncStep1Continue();
    }

    renderExistingPractitionerChoices() {
      const grid = this.container.querySelector("#kb-existing-practitioner-grid");
      grid.innerHTML = "";
      Object.keys(engine.PRACTITIONERS).forEach((id) => {
        const person = engine.PRACTITIONERS[id];
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.practitioner = id;
        card.innerHTML = `<h3>${person.name}</h3>`;
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

    renderTechniqueChoices() {
      const grid = this.container.querySelector("#kb-technique-grid");
      grid.innerHTML = "";
      engine.TECHNIQUES.filter((technique) => !technique.internal).forEach((technique) => {
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.technique = technique.id;
        const names = technique.bySchedule
          ? "Según el horario de atención"
          : technique.practitioners.map((id) => engine.PRACTITIONERS[id].name).join(" y ");
        card.innerHTML = `<h3>${technique.label}</h3><p>${names}</p>`;
        card.addEventListener("click", () => this.selectTechnique(technique.id));
        grid.appendChild(card);
      });
    }

    selectTechnique(techniqueId) {
      const technique = engine.getTechnique(techniqueId);
      this.state.techniqueId = techniqueId;
      this.state.practitionerId = technique.bySchedule
        ? null
        : technique.practitioners.length === 1
          ? technique.practitioners[0]
          : null;
      this.container.querySelectorAll("#kb-technique-grid .kb-choice-card").forEach((card) => {
        card.classList.toggle("selected", card.dataset.technique === techniqueId);
      });
      this.renderPractitionerChoices(technique);
      this.syncStep1Continue();
    }

    renderPractitionerChoices(technique) {
      const box = this.container.querySelector("#kb-practitioner-box");
      const grid = this.container.querySelector("#kb-practitioner-grid");
      grid.innerHTML = "";
      if (technique.bySchedule || technique.practitioners.length < 2) {
        box.style.display = "none";
        return;
      }
      box.style.display = "block";
      technique.practitioners.forEach((id) => {
        const person = engine.PRACTITIONERS[id];
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.practitioner = id;
        card.innerHTML = `<h3>${person.name}</h3>`;
        card.addEventListener("click", () => {
          this.state.practitionerId = id;
          grid.querySelectorAll(".kb-choice-card").forEach((c) => {
            c.classList.toggle("selected", c.dataset.practitioner === id);
          });
          this.syncStep1Continue();
        });
        grid.appendChild(card);
      });
    }

    syncStep1Continue() {
      const btn = this.container.querySelector("#kb-btn-next-1");
      const technique = engine.getTechnique(this.state.techniqueId);
      const ready = this.state.existingPatient === true
        ? Boolean(this.state.practitionerId)
        : technique && (technique.bySchedule || this.state.practitionerId);
      if (btn) btn.disabled = !ready;
    }

    updateDniRequirement() {
      const label = this.container.querySelector("#kb-label-dni");
      if (label) label.innerHTML = "DNI / Documento *";
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

      // Título y subtítulo paso 2
      const step2Title = this.container.querySelector("#kb-step-2 .kb-section-title");
      if (step2Title) {
        step2Title.textContent = "Elegí el horario de la sesión";
      }

      const subtitle = this.container.querySelector("#kb-slots-subtitle");
      if (subtitle) {
        const techniqueForSub = engine.getTechnique(this.state.techniqueId);
        subtitle.textContent = techniqueForSub && techniqueForSub.bySchedule
          ? "Sesión presencial de una hora"
          : "Sesión presencial de 1 hora, en los días en que atiende ese profesional.";
        subtitle.style.display = "block";
      }
    }

    dayHasAttendance(date) {
      const technique = engine.getTechnique(this.state.techniqueId);
      const works = technique && technique.bySchedule
        ? Object.keys(engine.PRACTITIONERS).some((id) => engine.getWorkingWindows(id, date).length > 0)
        : engine.getWorkingWindows(this.state.practitionerId, date).length > 0;
      return engine.isBusinessDay(date) && works;
    }

    async renderDateCarousel() {
      this._carouselSeq = (this._carouselSeq || 0) + 1;
      const seq = this._carouselSeq;
      const carousel = this.container.querySelector("#kb-date-carousel");
      carousel.innerHTML = "";

      const loading = this.container.querySelector("#kb-slots-loading");
      const empty = this.container.querySelector("#kb-slots-empty");
      const grid = this.container.querySelector("#kb-slots-grid");
      if (loading) loading.style.display = "flex";
      if (empty) empty.style.display = "none";
      if (grid) grid.style.display = "none";

      const today = new Date();
      let checkDate = new Date(today);
      let scanned = 0;
      const days = [];
      this._prefetchedSlots = {};

      while (days.length < 10 && scanned < 45) {
        const batch = [];
        while (batch.length < 10 && scanned < 45) {
          scanned += 1;
          const iso = engine.formatDateIso(checkDate);
          const current = new Date(checkDate);
          checkDate.setDate(checkDate.getDate() + 1);
          if (!this.dayHasAttendance(current)) continue;
          batch.push({ iso, current });
        }
        if (!batch.length) break;

        const settled = await Promise.all(batch.map(async (day) => {
          try {
            return { ...day, slots: await this.fetchFilteredSlots(day.iso), failed: false };
          } catch (err) {
            return { ...day, slots: [], failed: true };
          }
        }));
        if (seq !== this._carouselSeq) return;

        settled.forEach((day) => {
          if (days.length >= 10) return;
          if (!day.failed && !day.slots.length) return;
          if (!day.failed) this._prefetchedSlots[day.iso] = day.slots;
          days.push(day);
        });
      }

      let firstAvailable = null;
      days.forEach((day) => {
        const card = document.createElement("div");
        card.className = "kb-date-card";
        card.dataset.date = day.iso;
        card.innerHTML = `
          <div class="kb-date-dow">${DOW_NAMES[day.current.getDay()]}</div>
          <div class="kb-date-day">${day.current.getDate()}</div>
          <div class="kb-date-month">${MONTH_NAMES[day.current.getMonth()]}</div>
        `;
        card.addEventListener("click", () => {
          this.selectDate(day.iso);
        });
        carousel.appendChild(card);
        if (!firstAvailable) firstAvailable = day.iso;
      });

      if (seq !== this._carouselSeq) return;
      if (!firstAvailable) {
        if (loading) loading.style.display = "none";
        if (empty) {
          empty.style.display = "flex";
          empty.querySelector("span").textContent = "No hay días con horarios disponibles en las próximas semanas.";
        }
        return;
      }
      this.selectDate(this.state.selectedDate && carousel.querySelector(`[data-date="${this.state.selectedDate}"]`)
        ? this.state.selectedDate
        : firstAvailable);
    }

    async fetchFilteredSlots(dateIso, forceRefresh = false) {
      const res = await this.client.getAvailableSlots(dateIso, "session", {
        forceRefresh,
        practitionerId: this.state.practitionerId,
        techniqueId: this.state.techniqueId,
      });
      let slots = this.filterSlotsWithBuffer(res.availableSlots || [], dateIso, this.state.appointmentType);
      const chosen = engine.getTechnique(this.state.techniqueId);
      if (chosen && chosen.bySchedule) {
        slots = slots.filter((slot) => engine.practitionersAt(dateIso, slot.time).length > 0);
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

    async loadSlotsForDate(dateIso, forceRefresh = false) {
      this._slotReqSeq = (this._slotReqSeq || 0) + 1;
      const currentReq = this._slotReqSeq;

      const loading = this.container.querySelector("#kb-slots-loading");
      const empty = this.container.querySelector("#kb-slots-empty");
      const errorBox = this.container.querySelector("#kb-slots-error");
      const grid = this.container.querySelector("#kb-slots-grid");

      const cached = !forceRefresh && this._prefetchedSlots && this._prefetchedSlots[dateIso];
      loading.style.display = cached ? "none" : "flex";
      empty.style.display = "none";
      errorBox.style.display = "none";
      grid.style.display = "none";
      grid.innerHTML = "";

      try {
        const slots = cached ? this._prefetchedSlots[dateIso] : await this.fetchFilteredSlots(dateIso, forceRefresh);
        if (currentReq !== this._slotReqSeq) return;

        loading.style.display = "none";
        this.state.availableSlots = slots;

        if (slots.length === 0) {
          const card = this.container.querySelector(`.kb-date-card[data-date="${dateIso}"]`);
          const next = card && card.nextElementSibling;
          if (card) card.remove();
          if (next && next.dataset.date) {
            this.selectDate(next.dataset.date);
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
          const onDuty = engine.getTechnique(this.state.techniqueId) && engine.getTechnique(this.state.techniqueId).bySchedule
            ? engine.practitionersAt(dateIso, slot.time)
            : [];
          const dutyLabel = onDuty.length === 1 ? ` · ${engine.PRACTITIONERS[onDuty[0]].name}` : "";
          chip.textContent = `${slot.time} hs${dutyLabel}`;
          chip.dataset.time = slot.time;

          chip.addEventListener("click", () => {
            this.state.selectedTime = slot.time;
            if (onDuty.length === 1) this.state.practitionerId = onDuty[0];
            else if (onDuty.length > 1) this.state.practitionerId = null;
            const chips = grid.querySelectorAll(".kb-slot-chip");
            chips.forEach((ch) => ch.classList.remove("selected"));
            chip.classList.add("selected");
            this.container.querySelector("#kb-btn-next-2").disabled = false;
          });

          grid.appendChild(chip);
        });
      } catch (err) {
        if (currentReq !== this._slotReqSeq) return;
        loading.style.display = "none";
        errorBox.style.display = "flex";
        this.container.querySelector("#kb-slots-error-text").textContent = `Error al consultar disponibilidad: ${err.message}`;
        const retryBtn = this.container.querySelector("#kb-btn-retry-slots");
        if (retryBtn) {
          retryBtn.onclick = () => this.loadSlotsForDate(dateIso, true);
        }
      }
    }

    /**
     * Filtra los turnos garantizando el margen de anticipación cuando la consulta es para hoy:
     * Turnos presenciales (60 min): mínimo 2 horas de margen de traslado al consultorio.
     */
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
        this.showError("Por favor selecciona un día y horario antes de continuar.");
        this.setStep(2);
        return;
      }

      const nombre = q("#kb-input-nombre").value.trim();
      const telefono = q("#kb-input-telefono").value.trim();
      const dni = q("#kb-input-dni").value.trim();

      const payload = {
        tipo: "session",
        appointmentType: "session",
        techniqueId: this.state.techniqueId,
        practitionerId: this.state.practitionerId,
        date: this.state.selectedDate,
        time: this.state.selectedTime,
        nombre: nombre,
        telefono: telefono,
        dni: dni,
        motivo: "",
        isMenor: false,
        nombreFamiliar: "",
        notas: "",
      };

      const btnSubmit = q("#kb-btn-submit");
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Registrando...";

      try {
        const result = await this.client.bookAppointment(payload);
        this.state.confirmedBooking = result;
        this.renderConfirmation(payload, result);
        this.setStep(4);
      } catch (err) {
        this.showError(err.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Confirmar Reserva 🌿";
      }
    }

    renderConfirmation(payload, result) {
      const q = (sel) => this.container.querySelector(sel);

      const technique = engine.getTechnique(payload.techniqueId);
      const person = engine.PRACTITIONERS[payload.practitionerId];
      q("#kb-success-title").textContent = "¡Turno Presencial Confirmado!";

      const summaryBox = q("#kb-success-summary");
      summaryBox.innerHTML = `
        <div style="font-weight: 700; color: var(--kin-green-deep); margin-bottom: 8px;">
          🩺 Turno presencial de 1 hora
        </div>
        ${technique && !technique.bySchedule && !technique.internal ? `<div><strong>Técnica:</strong> ${technique.label}</div>` : ""}
        <div><strong>Profesional:</strong> ${person ? person.name : "Según el horario de atención"}</div>
        <div><strong>Paciente:</strong> ${payload.nombre}</div>
        <div><strong>Fecha y Hora:</strong> ${payload.date} a las ${payload.time} hs</div>
        <div><strong>WhatsApp / Contacto:</strong> ${payload.telefono}</div>
        <div style="margin-top: 6px; font-size: 12px; color: var(--kin-text-muted);">
          Identificador de cita: <code>${result.eventId || "CONFIRMADO"}</code>
        </div>
      `;

      // Reglas del consultorio sólo si es presencial
      const clinicRules = q("#kb-success-clinic-rules");
      clinicRules.style.display = "block";

      const subtitle = q("#kb-success-subtitle");
      subtitle.innerHTML = `Tu cita quedó reservada para el <strong>${payload.date} a las ${payload.time} hs</strong>.`;

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
              txt.textContent = "✓ Descargado";
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

    showError(msg) {
      const banner = this.container.querySelector("#kb-error-banner");
      banner.textContent = msg;
      banner.classList.add("visible");
      banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    clearError() {
      const banner = this.container.querySelector("#kb-error-banner");
      banner.textContent = "";
      banner.classList.remove("visible");
    }
  }

  return BookingWidget;
});
