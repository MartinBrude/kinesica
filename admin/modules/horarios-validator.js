/**
 * Kinésica Admin - Validador de Horarios y Franjas de Consultorio
 * Fachada: 1 camilla física, franjas ≥60 min, preview Clara e inferencia.
 */

export {
  DEFAULT_HEADER_SCHEDULE,
  DEFAULT_PRACTITIONER_HOURS,
  DAYS,
  PROF_META,
  TIMELINE_START_MIN,
  TIMELINE_END_MIN,
  TIMELINE_SPAN_MIN,
  hmToMin,
  minToHm,
  buildTimeOptions,
  cloneHours,
  formatHeaderScheduleText,
} from "./horarios-validator-core.js?v=1";

export { validateHoursDraft } from "./horarios-validator-validate.js?v=1";
export { buildClaraPreviewText, inferPractitionerFromSlot } from "./horarios-validator-infer.js?v=1";
