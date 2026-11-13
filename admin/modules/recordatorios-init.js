/**
 * Init — recordatorios.
 */

import { getSessionUser } from "./auth.js?v=83";
import { renderRecordatoriosRules } from "./recordatorios-rules.js?v=7";
import { recordatoriosStore } from "./recordatorios-store.js?v=1";
import { loadRecordatorios } from "./recordatorios-load.js?v=1";
import { applyFiltersAndRender, applyRecordatorioItemUpdate } from "./recordatorios-apply.js?v=1";
import { openRecordatorioContactModal, openRecordatorioDispatchModal } from "./recordatorios-modal-contact.js?v=1";
import { openTestCaseModal } from "./recordatorios-modal-test.js?v=1";

export function initRecordatoriosModule() {
  renderRecordatoriosRules(document.getElementById("recordatorios-rules"));
  const testBtn = document.getElementById("btn-test-recordatorio");
  if (testBtn) {
    const user = getSessionUser();
    const canTest = user?.role === "admin";
    testBtn.hidden = !canTest;
    testBtn.textContent = "＋ Caso de prueba";
    testBtn.title = "Crear un pending configurable para probar el envío manual por WhatsApp";
    testBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (recordatoriosStore.isRefreshing) return;
      openTestCaseModal();
    });
  }
  document.getElementById("btn-refresh-recordatorios")?.addEventListener("click", () => {
    loadRecordatorios(true);
  });
  document.getElementById("recordatorios-search")?.addEventListener("input", () => {
    if (recordatoriosStore.isRefreshing) return;
    recordatoriosStore.currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-stats")?.addEventListener("click", (e) => {
    if (recordatoriosStore.isRefreshing) return;
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    const next = btn.getAttribute("data-filter") || "all";
    recordatoriosStore.activeStatusFilter = recordatoriosStore.activeStatusFilter === next ? "all" : next;
    recordatoriosStore.currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-list-container")?.addEventListener("click", (e) => {
    const resetBtn = e.target.closest('[data-action="reset-filters"]');
    if (resetBtn) {
      recordatoriosStore.activeStatusFilter = "all";
      const searchInput = document.getElementById("recordatorios-search");
      if (searchInput) searchInput.value = "";
      recordatoriosStore.currentPage = 0;
      applyFiltersAndRender();
      return;
    }
    const contactBtn = e.target.closest('[data-action="save-contact"]');
    if (contactBtn) {
      const id = contactBtn.getAttribute("data-id");
      const item = recordatoriosStore.cachedItems.find((it) => String(it.id) === String(id));
      if (!item) return;
      openRecordatorioContactModal(item, {
        mode: "contact",
        onSuccess: applyRecordatorioItemUpdate,
      });
      return;
    }
    const btn = e.target.closest('[data-action="dispatch-manual"]');
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const item = recordatoriosStore.cachedItems.find((it) => String(it.id) === String(id));
    if (!item) return;
    openRecordatorioDispatchModal(item, applyRecordatorioItemUpdate);
  });
}
