/**
 * Kinésica Admin - Módulo de Gestión de Pacientes (facade).
 */

import { formatDisplayPhone } from "./pacientes-format.js";
import { initPendingSearchFromUrl, PACIENTES_BADGE_POLL_INTERVAL_MS } from "./pacientes-state.js";

initPendingSearchFromUrl();

export { formatDisplayPhone };
export { PACIENTES_BADGE_POLL_INTERVAL_MS };

export {
  GOOGLE_REVIEW_INVITE_URL,
  getPatientFirstName,
  buildReviewInviteMessage,
  patientEncuestaEnviada,
  patientHasReview,
} from "./pacientes-patient-meta.js";

export {
  canonicalPatientNameKey,
  cleanPatientDni,
  isPlaceholderPhone,
  patientMissingPhone,
  countMissingPhoneFromList,
} from "./pacientes-identifiers.js";

export { deduplicatePatientsInMemory } from "./pacientes-dedupe.js";
export { formatPatientName } from "./pacientes-name.js";

export { showPacientesView, hidePacientesView } from "./pacientes-view.js";
export { loadPacientes } from "./pacientes-load.js";
export { renderPacientesTable } from "./pacientes-table.js";
export { initPacientesModule } from "./pacientes-init.js";

export {
  setPacientesMissingPhoneBadge,
  syncPacientesBadgeFromCache,
  refreshPacientesMissingPhoneBadge,
  startPacientesBadgePoll,
  stopPacientesBadgePoll,
} from "./pacientes-badge.js";
