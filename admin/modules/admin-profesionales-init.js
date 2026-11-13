import { api } from "./api.js?v=79";
import { dialogAlert } from "./dom.js?v=79";
import {
  btnNuevoProf,
  modalEl,
  formEl,
  btnCloseModal,
  btnCancelModal,
  detailModalEl,
  detailCloseBtn,
  detailModalCloseBtn,
  detailBtnEdit,
  detailBtnInvite,
  detailBtnToggle,
  getCachedProfesionales,
  setCachedProfesionales,
  setReloadCallback,
  getCurrentDetailUser,
  getReloadCallback,
} from "./admin-profesionales-state.js";
import { openCreateModal, closeProfModal, openEditModal } from "./admin-profesionales-modals.js";
import {
  handleSaveProfessional,
  handleToggleActive,
  handleResendInvite,
} from "./admin-profesionales-actions.js";
import { renderProfesionales } from "./admin-profesionales-render.js";

export async function loadProfesionalesData(onReload) {
  try {
    setReloadCallback(onReload);
    const tbody = document.getElementById("admin-prof-tbody");
    const cachedProfesionales = getCachedProfesionales();
    if (tbody && (!cachedProfesionales || !cachedProfesionales.length)) {
      tbody.innerHTML = `<tr><td colspan="4" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando equipo profesional…</span></td></tr>`;
    }
    const data = await api("profesionales.php");
    const list = Array.isArray(data?.profesionales)
      ? data.profesionales
      : (Array.isArray(data?.users) ? data.users : null);
    if (!list) return;
    setCachedProfesionales(list);
    renderProfesionales(getCachedProfesionales(), onReload);
  } catch (err) {
    dialogAlert("Error al cargar datos de administración: " + (err.message || "Error desconocido"));
  }
}

export function initProfesionalesUI({ onReload }) {
  setReloadCallback(onReload);

  btnNuevoProf?.addEventListener("click", openCreateModal);
  btnCloseModal?.addEventListener("click", closeProfModal);
  btnCancelModal?.addEventListener("click", closeProfModal);
  formEl?.addEventListener("submit", (e) => handleSaveProfessional(e, onReload));
  modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) closeProfModal();
  });

  detailCloseBtn?.addEventListener("click", closeProfModal);
  detailModalCloseBtn?.addEventListener("click", closeProfModal);
  detailModalEl?.addEventListener("click", (e) => {
    if (e.target === detailModalEl) closeProfModal();
  });

  detailBtnEdit?.addEventListener("click", () => {
    const currentDetailUser = getCurrentDetailUser();
    if (currentDetailUser) {
      openEditModal(currentDetailUser);
    }
  });

  detailBtnInvite?.addEventListener("click", () => {
    const currentDetailUser = getCurrentDetailUser();
    if (currentDetailUser) {
      handleResendInvite(currentDetailUser);
    }
  });

  detailBtnToggle?.addEventListener("click", () => {
    const currentDetailUser = getCurrentDetailUser();
    if (currentDetailUser) {
      handleToggleActive(currentDetailUser, getReloadCallback());
    }
  });
}
