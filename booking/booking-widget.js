/**
 * Kinésica - Componente Interactivo de Reservas Web
 * ===================================================
 * Gestiona el flujo paso a paso con validaciones en tiempo real:
 * - Paso 1: Triaje (Primera vez vs Habitual)
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
        tipo: null, // 'primera_vez' | 'habitual'
        appointmentType: null, // 'call' (10m) | 'session' (60m)
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

      // Si el enlace incluye ?tipo=habitual o #habitual, ir directo a reservar sesión de 1 hora
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("tipo") === "habitual" || window.location.hash === "#habitual") {
          this.state.tipo = "habitual";
          this.state.appointmentType = "session";
          this.updateDniRequirement();
          this.setStep(2);
          this.renderDateCarousel();
          return;
        }
      } catch (e) {}

      this.setStep(1);
    }

    renderSkeleton() {
      this.container.innerHTML = `
        <div class="kinesica-booking-container">
          <div class="kb-header">
            ${this.options.isModal ? '<button type="button" class="kb-close-btn" aria-label="Cerrar ventana de reservas" data-action="close-modal">&times;</button>' : ''}
            <h2>Agendar</h2>
            <p>Consultorio de Kinesiología y RPG en Palermo, CABA</p>
          </div>

          <div class="kb-stepper">
            <div class="kb-step-item active" data-step-indicator="1">
              <span class="kb-step-num">1</span> Tipo de Consulta
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

            <!-- PASO 1: TRIAJE -->
            <div class="kb-step-panel active" id="kb-step-1">
              <div class="kb-section-title">¿Es tu primera vez en Kinésica?</div>
              <div class="kb-section-desc">Selecciona la opción que mejor describa tu situación para mostrarte las opciones de atención correspondientes.</div>

              <div class="kb-choice-grid">
                <div class="kb-choice-card" id="kb-choice-primera-vez" data-tipo="primera_vez">
                  <span class="kb-badge kb-badge-blue">Nuevo Paciente</span>
                  <h3>Es mi primera vez</h3>
                  <p>Llamada previa de orientación (10 min) sin cargo para evaluar tu caso.</p>
                </div>
                <div class="kb-choice-card" id="kb-choice-habitual" data-tipo="habitual">
                  <span class="kb-badge kb-badge-teal">Paciente Habitual</span>
                  <h3>Ya soy paciente</h3>
                  <p>Turno presencial de 1 hora en consultorio (Kinesiología, RPG, Osteopatía).</p>
                </div>
              </div>

              <!-- Cartel informativo y avance para primera vez -->
              <div id="kb-info-primera-vez" class="kb-alert-box" style="display: none; margin-top: 20px;">
                <strong>📞 Llamada previa de orientación (10 minutos):</strong><br>
                Para pacientes nuevos, el primer paso es coordinar una breve llamada telefónica sin cargo con el kinesiólogo. De esta manera evaluamos tu caso clínico en detalle y te informamos los honorarios correspondientes antes de que asistas al consultorio.
                <div style="margin-top: 16px; text-align: right;">
                  <button class="kb-btn kb-btn-primary" id="kb-btn-next-1">
                    Continuar a Horarios de Llamada →
                  </button>
                </div>
              </div>
            </div>

            <!-- PASO 2: DÍA Y HORA -->
            <div class="kb-step-panel" id="kb-step-2">
              <div class="kb-section-title">Elige el día y horario</div>
              <div class="kb-section-desc" id="kb-slots-subtitle">
                Atención de lunes a viernes entre las 08:00 y las 19:00 hs.
              </div>

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

                <!-- Normas del consultorio para turnos presenciales -->
                <div class="kb-clinic-rules" id="kb-success-clinic-rules" style="display: none;">
                  <h4>📍 Información Importante para tu Asistencia al Consultorio:</h4>
                  <ul>
                    <li><strong>Dirección:</strong> Charcas 3889, Piso 5º, Depto B, Palermo (entre Salguero y Vidt).</li>
                    <li><strong>Sin sala de espera:</strong> El espacio no cuenta con sala de espera. Te pedimos <strong>puntualidad exacta</strong> al horario acordado para evitar esperas en la entrada o palier.</li>
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

      // Selección Primera Vez vs Habitual
      q("#kb-choice-primera-vez").addEventListener("click", () => {
        this.state.tipo = "primera_vez";
        this.state.appointmentType = "call"; // REGLA: Primera vez = LLAMADA
        q("#kb-choice-primera-vez").classList.add("selected");
        q("#kb-choice-habitual").classList.remove("selected");
        q("#kb-info-primera-vez").style.display = "block";
        this.updateDniRequirement();
      });

      // Si ya es paciente, llevarlo DIRECTO a reservar turno de una hora
      q("#kb-choice-habitual").addEventListener("click", () => {
        this.state.tipo = "habitual";
        this.state.appointmentType = "session"; // Paciente habitual: turno presencial de 1 hora directo
        q("#kb-choice-habitual").classList.add("selected");
        q("#kb-choice-primera-vez").classList.remove("selected");
        q("#kb-info-primera-vez").style.display = "none";
        this.updateDniRequirement();
        this.clearError();
        this.setStep(2);
        this.renderDateCarousel();
      });



      // Navegación Stepper
      q("#kb-btn-next-1").addEventListener("click", () => {
        this.clearError();
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

    updateDniRequirement() {
      const label = this.container.querySelector("#kb-label-dni");
      if (this.state.appointmentType === "session") {
        label.innerHTML = "DNI / Documento *";
      } else {
        label.innerHTML = "DNI / Documento (opcional)";
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

      // Título y subtítulo paso 2
      const step2Title = this.container.querySelector("#kb-step-2 .kb-section-title");
      if (step2Title) {
        if (this.state.appointmentType === "session") {
          step2Title.textContent = "Elige el día y horario de tu sesión (1 hora)";
        } else {
          step2Title.textContent = "Elige el día y horario de tu llamada de orientación (10 min)";
        }
      }

      const subtitle = this.container.querySelector("#kb-slots-subtitle");
      if (subtitle) {
        if (this.state.appointmentType === "call") {
          subtitle.textContent = "Llamada previa de orientación de 10 min (Lunes a viernes 08:00 a 19:00 hs).";
        } else {
          subtitle.textContent = "Turno presencial de 1 hora en consultorio (Lunes a viernes 08:00 a 19:00 hs).";
        }
      }
    }

    renderDateCarousel() {
      const carousel = this.container.querySelector("#kb-date-carousel");
      carousel.innerHTML = "";

      const today = new Date();
      let added = 0;
      let checkDate = new Date(today);
      let firstAvailable = null;

      // Buscar los próximos 10 días hábiles
      while (added < 10) {
        const iso = engine.formatDateIso(checkDate);
        const isBiz = engine.isBusinessDay(checkDate);

        if (isBiz) {
          const card = document.createElement("div");
          card.className = "kb-date-card";
          card.dataset.date = iso;
          card.innerHTML = `
            <div class="kb-date-dow">${DOW_NAMES[checkDate.getDay()]}</div>
            <div class="kb-date-day">${checkDate.getDate()}</div>
            <div class="kb-date-month">${MONTH_NAMES[checkDate.getMonth()]}</div>
          `;

          card.addEventListener("click", () => {
            this.selectDate(iso);
          });

          carousel.appendChild(card);
          if (!firstAvailable) firstAvailable = iso;
          added++;
        }

        checkDate.setDate(checkDate.getDate() + 1);
      }

      if (firstAvailable && !this.state.selectedDate) {
        this.selectDate(firstAvailable);
      }
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

    async loadSlotsForDate(dateIso) {
      const loading = this.container.querySelector("#kb-slots-loading");
      const empty = this.container.querySelector("#kb-slots-empty");
      const errorBox = this.container.querySelector("#kb-slots-error");
      const grid = this.container.querySelector("#kb-slots-grid");

      loading.style.display = "flex";
      empty.style.display = "none";
      errorBox.style.display = "none";
      grid.style.display = "none";
      grid.innerHTML = "";

      try {
        const res = await this.client.getAvailableSlots(dateIso, this.state.appointmentType);
        loading.style.display = "none";
        const slots = res.availableSlots || [];
        this.state.availableSlots = slots;

        if (slots.length === 0) {
          empty.style.display = "flex";
          return;
        }

        grid.style.display = "grid";
        grid.innerHTML = "";
        slots.forEach((slot) => {
          const chip = document.createElement("div");
          chip.className = "kb-slot-chip";
          chip.textContent = `${slot.time} hs`;
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
        loading.style.display = "none";
        errorBox.style.display = "flex";
        this.container.querySelector("#kb-slots-error-text").textContent = `Error al consultar disponibilidad: ${err.message}`;
        const retryBtn = this.container.querySelector("#kb-btn-retry-slots");
        if (retryBtn) {
          retryBtn.onclick = () => this.loadSlotsForDate(dateIso);
        }
      }
    }

    async handleBookingSubmit() {
      this.clearError();
      const q = (sel) => this.container.querySelector(sel);

      const nombre = q("#kb-input-nombre").value.trim();
      const telefono = q("#kb-input-telefono").value.trim();
      const dni = q("#kb-input-dni").value.trim();

      const payload = {
        tipo: this.state.tipo,
        appointmentType: this.state.appointmentType,
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

      const isCall = payload.appointmentType === "call";
      q("#kb-success-title").textContent = isCall
        ? "¡Llamada Previa Agendada!"
        : "¡Turno Presencial Confirmado!";

      const summaryBox = q("#kb-success-summary");
      summaryBox.innerHTML = `
        <div style="font-weight: 700; color: var(--kin-green-deep); margin-bottom: 8px;">
          ${isCall ? "📞 Llamada de Orientación Telefónica (10 min)" : "🩺 Turno Presencial en Consultorio (1 hora)"}
        </div>
        <div><strong>Paciente:</strong> ${payload.nombre}</div>
        <div><strong>Fecha y Hora:</strong> ${payload.date} a las ${payload.time} hs</div>
        <div><strong>WhatsApp / Contacto:</strong> ${payload.telefono}</div>
        <div style="margin-top: 6px; font-size: 12px; color: var(--kin-text-muted);">
          Identificador de cita: <code>${result.eventId || "CONFIRMADO"}</code>
        </div>
      `;

      // Reglas del consultorio sólo si es presencial
      const clinicRules = q("#kb-success-clinic-rules");
      clinicRules.style.display = isCall ? "none" : "block";

      const subtitle = q("#kb-success-subtitle");
      if (isCall) {
        subtitle.innerHTML = `El kinesiólogo se comunicará puntualmente a tu teléfono <strong>${payload.telefono}</strong> el <strong>${payload.date} a las ${payload.time} hs</strong> para evaluar tu caso e informarte los honorarios.`;
      } else {
        subtitle.innerHTML = `Tu cita quedó reservada en la agenda del consultorio para el <strong>${payload.date} a las ${payload.time} hs</strong>.`;
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
