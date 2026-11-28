/**
 * Init — recordatorios.
 */

import { api } from "./api.js?v=79";
import { debounce, dialogConfirm, dialogAlert, toast } from "./dom.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import { renderRecordatoriosRules } from "./recordatorios-rules.js?v=8";
import { recordatoriosStore } from "./recordatorios-store.js?v=1";
import { loadRecordatorios } from "./recordatorios-load.js?v=2";
import {
  applyFiltersAndRender,
  applyRecordatorioItemUpdate,
  applyRecordatorioItemDelete,
} from "./recordatorios-apply.js?v=1";
import { openRecordatorioContactModal, openRecordatorioDispatchModal } from "./recordatorios-modal-contact.js?v=5";
import { openRecordatorioMessageModal } from "./recordatorios-modal-message.js?v=2";
import { openTestCaseModal } from "./recordatorios-modal-test.js?v=2";

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
  const onRecordatoriosSearch = debounce(() => {
    if (recordatoriosStore.isRefreshing) return;
    recordatoriosStore.currentPage = 0;
    applyFiltersAndRender();
  }, 180);
  document.getElementById("recordatorios-search")?.addEventListener("input", onRecordatoriosSearch);
  document.getElementById("recordatorios-stats")?.addEventListener("click", (e) => {
    if (recordatoriosStore.isRefreshing) return;
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    const next = btn.getAttribute("data-filter") || "all";
    recordatoriosStore.activeStatusFilter = recordatoriosStore.activeStatusFilter === next ? "all" : next;
    recordatoriosStore.currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-list-container")?.addEventListener("click", async (e) => {
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
    const viewBtn = e.target.closest('[data-action="view-message"]');
    if (viewBtn) {
      const id = viewBtn.getAttribute("data-id");
      const item = recordatoriosStore.cachedItems.find((it) => String(it.id) === String(id));
      if (!item) return;
      openRecordatorioMessageModal(item);
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-recordatorio"]');
    if (delBtn) {
      const id = delBtn.getAttribute("data-id");
      const item = recordatoriosStore.cachedItems.find((it) => String(it.id) === String(id));
      if (!item) return;
      const who = item.patient_name || item.event_summary || `#${id}`;
      const when = [item.appointment_date, item.appointment_time].filter(Boolean).join(" · ");
      const confirmed = await dialogConfirm(
        `¿Confirmás que querés eliminar el recordatorio de "${who}"${when ? ` (${when})` : ""}?\n\nEsta acción no se puede deshacer.`,
        { title: "Eliminar recordatorio", danger: true, okText: "Eliminar", cancelText: "Cancelar" }
      );
      if (!confirmed) return;
      delBtn.disabled = true;
      const prevHtml = delBtn.innerHTML;
      delBtn.textContent = "Eliminando…";
      try {
        await api("recordatorios.php", {
          method: "POST",
          body: JSON.stringify({ action: "delete", id: Number(id) }),
        });
        applyRecordatorioItemDelete(id);
        toast("Recordatorio eliminado", { type: "success" });
      } catch (err) {
        delBtn.disabled = false;
        delBtn.innerHTML = prevHtml;
        await dialogAlert(err?.message || "No se pudo eliminar el recordatorio", { type: "danger" });
      }
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
