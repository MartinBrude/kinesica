/**
 * Kinésica - Motor de Reservas y Reglas de Negocio (Orquestador Modular)
 * ======================================================================
 * 1. Solo turnos presenciales de 60 min. No hay llamadas de orientación.
 * 2. Cada técnica la atiende Norberto, María o ambos.
 * 3. Los horarios de cada profesional restringen los turnos ofrecidos.
 * 4. Feriados y fines de semana bloqueados.
 * 5. Un turno ocupa la camilla única para ambos profesionales.
 * 6. Buffer de traslado de 2 horas para turnos en el mismo día.
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([
      "./booking-calendar-sync",
      "./booking-engine-config",
      "./booking-engine-hours",
      "./booking-engine-slots",
      "./booking-engine-validate",
    ], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-calendar-sync"),
      require("./booking-engine-config"),
      require("./booking-engine-hours"),
      require("./booking-engine-slots"),
      require("./booking-engine-validate")
    );
  } else {
    root.KinesicaBookingEngine = factory(
      root.KinesicaBookingCalendarSync,
      root.KinesicaBookingEngineConfig,
      root.KinesicaBookingEngineHours,
      root.KinesicaBookingEngineSlots,
      root.KinesicaBookingEngineValidate
    );
  }
})(typeof self !== "undefined" ? self : this, function (
  calendarSyncModule,
  cfg,
  hoursMod,
  slotsMod,
  validateMod
) {
  "use strict";

  // Lista oficial de Feriados Nacionales de Argentina (YYYY-MM-DD)
  // Incluye inamovibles, trasladables y puentes turísticos oficiales
  const DEFAULT_ARGENTINA_HOLIDAYS = [
    // BEGIN_ARGENTINA_HOLIDAYS
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02",
    "2026-04-03", "2026-05-01", "2026-05-25", "2026-06-15", "2026-06-20",
    "2026-07-09", "2026-08-17", "2026-10-12", "2026-11-23", "2026-12-08",
    "2026-12-25", "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-24",
    "2027-03-26", "2027-04-02", "2027-05-01", "2027-05-25", "2027-06-20",
    "2027-07-09", "2027-08-16", "2027-10-11", "2027-11-20", "2027-12-08",
    "2027-12-25", "2028-01-01", "2028-02-28", "2028-02-29", "2028-03-24",
    "2028-04-02", "2028-04-14", "2028-05-01", "2028-05-25", "2028-06-20",
    "2028-07-09", "2028-08-21", "2028-10-16", "2028-11-20", "2028-12-08",
    "2028-12-25", "2029-01-01", "2029-02-12", "2029-02-13", "2029-03-24",
    "2029-03-30", "2029-04-02", "2029-05-01", "2029-05-25", "2029-06-20",
    "2029-07-09", "2029-08-20", "2029-10-15", "2029-11-19", "2029-12-08",
    "2029-12-25"
    // END_ARGENTINA_HOLIDAYS
  ];

  function isBusinessDay(dateInput, customHolidays) {
    if (!dateInput) return false;
    let d;
    if (typeof dateInput === "string") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) return false;
      d = cfg.parseLocalDate(dateInput.trim());
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return false;
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    const holidays = customHolidays || DEFAULT_ARGENTINA_HOLIDAYS;
    return !holidays.includes(cfg.formatDateIso(d));
  }

  const calculateAvailableSlots = slotsMod.createSlotCalculator(isBusinessDay);
  const validateBookingRequest = validateMod.createRequestValidator({
    isBusinessDay,
    getWorkingWindows: slotsMod.getWorkingWindows,
    practitionersAt: slotsMod.practitionersAt,
    isPractitionerOnLeave: slotsMod.isPractitionerOnLeave,
    isTechniqueOfferedOnDate: slotsMod.isTechniqueOfferedOnDate,
  });

  const syncFactory = (calendarSyncModule && calendarSyncModule.createCalendarSync)
    || (typeof window !== "undefined" && window.KinesicaBookingCalendarSync && window.KinesicaBookingCalendarSync.createCalendarSync);
  const calSync = syncFactory
    ? syncFactory({
        PRACTITIONERS: cfg.PRACTITIONERS,
        getTechnique: cfg.getTechnique,
        SESSION_DURATION_MINUTES: cfg.SESSION_DURATION_MINUTES,
      })
    : {};

  return {
    SESSION_DURATION_MINUTES: cfg.SESSION_DURATION_MINUTES,
    DAY_START_HOUR: cfg.DAY_START_HOUR,
    DAY_END_HOUR: cfg.DAY_END_HOUR,
    SESSION_BUFFER_HOURS: cfg.SESSION_BUFFER_HOURS,
    SAME_DAY_BUFFER_HOURS: cfg.SAME_DAY_BUFFER_HOURS,
    PRACTITIONERS: cfg.PRACTITIONERS,
    TECHNIQUES: cfg.TECHNIQUES,
    FEATURED_TECHNIQUE_IDS: cfg.FEATURED_TECHNIQUE_IDS,
    DEFAULT_PRACTITIONER_HOURS: cfg.DEFAULT_PRACTITIONER_HOURS,
    PRACTITIONER_HOURS: cfg.PRACTITIONER_HOURS,
    MAX_BOOKING_DAYS: cfg.MAX_BOOKING_DAYS,
    DEFAULT_FEES: cfg.DEFAULT_FEES,
    setRuntimeFees: cfg.setRuntimeFees,
    getRuntimeFees: cfg.getRuntimeFees,
    getFeeForTechnique: cfg.getFeeForTechnique,
    DEFAULT_ARGENTINA_HOLIDAYS,
    clonePractitionerHours: cfg.clonePractitionerHours,
    validatePractitionerHours: hoursMod.validatePractitionerHours,
    setPractitionerHours: hoursMod.setPractitionerHours,
    resetPractitionerHours: hoursMod.resetPractitionerHours,
    getPractitionerHours: hoursMod.getPractitionerHours,
    setScheduleOverrides: cfg.setScheduleOverrides,
    getScheduleOverrides: cfg.getScheduleOverrides,
    resetScheduleOverrides: cfg.resetScheduleOverrides,
    formatClaraScheduleSummary: hoursMod.formatClaraScheduleSummary,
    parseHmToMinutes: cfg.parseHmToMinutes,
    minutesToHm: cfg.minutesToHm,
    isBusinessDay,
    getTechnique: cfg.getTechnique,
    practitionersAt: slotsMod.practitionersAt,
    getWorkingWindows: slotsMod.getWorkingWindows,
    isPractitionerOnLeave: slotsMod.isPractitionerOnLeave,
    getActiveLeaveEndIso: slotsMod.getActiveLeaveEndIso,
    isTechniqueBlockedByActiveLeave: slotsMod.isTechniqueBlockedByActiveLeave,
    isTechniqueOfferedOnDate: slotsMod.isTechniqueOfferedOnDate,
    practitionersAvailableOnDate: slotsMod.practitionersAvailableOnDate,
    practitionersBookableForTechnique: slotsMod.practitionersBookableForTechnique,
    practitionerOffersTechnique: cfg.practitionerOffersTechnique,
    calculateAvailableSlots,
    validateBookingRequest,
    formatCalendarSummary: calSync.formatCalendarSummary,
    formatCalendarDescription: calSync.formatCalendarDescription,
    generateCalendarExportData: calSync.generateCalendarExportData,
    formatDateIso: cfg.formatDateIso,
    parseLocalDate: cfg.parseLocalDate,
  };
});
