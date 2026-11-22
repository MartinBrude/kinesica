/**
 * Kinésica - Componente Interactivo de Reservas Web (Orquestador Modular)
 * =====================================================================
 * Gestiona el flujo paso a paso con validaciones en tiempo real:
 * - Paso 1: Paciente nuevo / habitual → técnica o profesional
 * - Paso 2: Calendario y Horarios disponibles
 * - Paso 3: Formulario de datos clínicos y contacto
 * - Paso 4: Confirmación oficial con normas del consultorio
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([
      "./booking-widget-copy",
      "./booking-engine",
      "./booking-api-client",
      "./booking-validation",
      "./booking-widget-helpers",
      "./booking-widget-template",
      "./booking-widget-dom",
      "./booking-widget-events",
      "./booking-widget-step1-techniques",
      "./booking-widget-step1-existing",
      "./booking-widget-step1",
      "./booking-widget-step2-dates",
      "./booking-widget-step2-slots",
      "./booking-widget-step3",
      "./booking-widget-step4",
    ], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-widget-copy"),
      require("./booking-engine"),
      require("./booking-api-client"),
      require("./booking-validation"),
      require("./booking-widget-helpers"),
      require("./booking-widget-template"),
      require("./booking-widget-dom"),
      require("./booking-widget-events"),
      require("./booking-widget-step1-techniques"),
      require("./booking-widget-step1-existing"),
      require("./booking-widget-step1"),
      require("./booking-widget-step2-dates"),
      require("./booking-widget-step2-slots"),
      require("./booking-widget-step3"),
      require("./booking-widget-step4")
    );
  } else {
    root.KinesicaBookingWidget = factory(
      root.KinesicaBookingWidgetCopy,
      root.KinesicaBookingEngine,
      root.KinesicaBookingClient,
      root.KinesicaBookingValidation,
      root.KinesicaBookingWidgetHelpers,
      root.KinesicaBookingWidgetTemplate,
      root.KinesicaBookingWidgetDom,
      root.KinesicaBookingWidgetEvents,
      root.KinesicaBookingWidgetStep1Techniques,
      root.KinesicaBookingWidgetStep1Existing,
      root.KinesicaBookingWidgetStep1,
      root.KinesicaBookingWidgetStep2Dates,
      root.KinesicaBookingWidgetStep2Slots,
      root.KinesicaBookingWidgetStep3,
      root.KinesicaBookingWidgetStep4
    );
  }
})(typeof self !== "undefined" ? self : this, function (
  copyModule,
  engine,
  clientModule,
  validationModule,
  helpersModule,
  templateModule,
  domModule,
  eventsModule,
  step1TechModule,
  step1ExistingModule,
  step1Module,
  step2DatesModule,
  step2SlotsModule,
  step3Module,
  step4Module
) {
  "use strict";

  const pageLang = copyModule && copyModule.pageLang ? copyModule.pageLang : (l) => l || "es";
  const COPY = (copyModule && copyModule.COPY) || {};

  class BookingWidget {
    constructor(containerId, options) {
      this.container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
      if (!this.container) throw new Error(`Contenedor no encontrado: ${containerId}`);

      this.options = options || {};
      this.lang = pageLang(this.options.lang);
      this.copy = COPY[this.lang] || COPY.es || {};
      const ClientClass = (clientModule && clientModule.BookingClient) || (typeof window !== "undefined" && window.KinesicaBookingClient && window.KinesicaBookingClient.BookingClient);
      this.client = ClientClass ? new ClientClass(options) : null;

      this.state = {
        step: 1, tipo: "session", appointmentType: "session", existingPatient: null,
        techniqueId: null, practitionerId: null, practitionerPreference: null,
        showMoreTechniques: false, selectedDate: null, selectedTime: null,
        availableSlots: [], isLoadingSlots: false,
        formData: { nombre: "", email: "", telefono: "", dni: "" },
        adminPatient: null, confirmedBooking: null,
      };

      this.fees = (engine && typeof engine.getRuntimeFees === "function")
        ? engine.getRuntimeFees()
        : { atm: 65000, general: 75000, payment_methods: "Efectivo o transferencia bancaria" };

      try {
        const cached = JSON.parse(localStorage.getItem("kinesica_public_settings") || "null");
        if (cached && cached.fees) {
          this.fees = Object.assign({}, this.fees, cached.fees);
          if (engine && typeof engine.setRuntimeFees === "function") engine.setRuntimeFees(cached.fees);
        }
      } catch (_) {}

      this.init();
    }

    init() {
      this.renderSkeleton();
      if (this.options.adminMode) this.setupAdminLayout();
      this.updateDniRequirement();
      this.bindEvents();
      if (this.client && typeof this.client.prewarm === "function") this.client.prewarm();
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
                if (typeof this.renderExistingPractitionerChoices === "function") {
                  this.renderExistingPractitionerChoices();
                }
              }
              if (data.fees) this.updateFees(data.fees);
            }
          })
          .catch(() => {});
      }

      this.setStep(1);
    }
  }

  // Acoplar submódulos al prototipo de BookingWidget
  const helpers = helpersModule || (typeof self !== "undefined" && self.KinesicaBookingWidgetHelpers);
  const dom = domModule || (typeof self !== "undefined" && self.KinesicaBookingWidgetDom);
  const events = eventsModule || (typeof self !== "undefined" && self.KinesicaBookingWidgetEvents);
  const step1Tech = step1TechModule || (typeof self !== "undefined" && self.KinesicaBookingWidgetStep1Techniques);
  const step1Existing = step1ExistingModule || (typeof self !== "undefined" && self.KinesicaBookingWidgetStep1Existing);
  const step1 = step1Module || (typeof self !== "undefined" && self.KinesicaBookingWidgetStep1);
  const step2Dates = step2DatesModule || (typeof self !== "undefined" && self.KinesicaBookingWidgetStep2Dates);
  const step2Slots = step2SlotsModule || (typeof self !== "undefined" && self.KinesicaBookingWidgetStep2Slots);
  const step3 = step3Module || (typeof self !== "undefined" && self.KinesicaBookingWidgetStep3);
  const step4 = step4Module || (typeof self !== "undefined" && self.KinesicaBookingWidgetStep4);

  if (helpers && helpers.attachHelpers) helpers.attachHelpers(BookingWidget.prototype);
  if (dom && dom.attachDomMethods) dom.attachDomMethods(BookingWidget.prototype, BookingWidget);
  if (events && events.attachEventMethods) events.attachEventMethods(BookingWidget.prototype, BookingWidget);
  if (step1Tech && step1Tech.attachStep1Techniques) step1Tech.attachStep1Techniques(BookingWidget.prototype);
  if (step1Existing && step1Existing.attachStep1Existing) step1Existing.attachStep1Existing(BookingWidget.prototype);
  if (step1 && step1.attachStep1Methods) step1.attachStep1Methods(BookingWidget.prototype);
  if (step2Dates && step2Dates.attachStep2Dates) step2Dates.attachStep2Dates(BookingWidget.prototype);
  if (step2Slots && step2Slots.attachStep2Slots) step2Slots.attachStep2Slots(BookingWidget.prototype);
  if (step3 && step3.attachStep3Methods) step3.attachStep3Methods(BookingWidget.prototype, BookingWidget);
  if (step4 && step4.attachStep4Methods) step4.attachStep4Methods(BookingWidget.prototype);

  // Integración estática de validación y sanitización
  const Val = validationModule || (typeof self !== "undefined" && self.KinesicaBookingValidation) || {};
  BookingWidget.FORM_FIELDS = Val.FORM_FIELDS || ["contacto-nombre", "contacto-telefono", "nombre", "email", "telefono", "dni"];
  BookingWidget.sanitizeFieldInput = Val.sanitizeFieldInput;
  BookingWidget.isValidEmail = Val.isValidEmail;
  BookingWidget.suggestEmailDomain = Val.suggestEmailDomain;
  BookingWidget.inspectPhone = Val.inspectPhone;
  BookingWidget.isValidDni = Val.isValidDni;
  BookingWidget.validateContactForm = Val.validateContactForm;

  return BookingWidget;
});
