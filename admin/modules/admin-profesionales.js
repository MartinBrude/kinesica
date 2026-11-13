/**
 * Kinésica Admin - Gestión de Profesionales del Equipo (facade).
 */

export { getInitials, getAvatarColor } from "./admin-profesionales-avatar.js";
export { isProfModalOpen, closeProfModal, openCreateModal, openEditModal } from "./admin-profesionales-modals.js";
export { openDetailModal } from "./admin-profesionales-detail.js";
export {
  handleSaveProfessional,
  handleToggleActive,
  handleResendInvite,
} from "./admin-profesionales-actions.js";
export { renderProfesionales } from "./admin-profesionales-render.js";
export { loadProfesionalesData, initProfesionalesUI } from "./admin-profesionales-init.js";
