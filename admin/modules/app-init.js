/**
 * Kinésica Admin - Inicialización y Enlace de Módulos Clínicos y de Gestión
 * Conecta los eventos y callbacks entre el Formulario, la Biblioteca, el Comparador y el Dashboard.
 */

import { ageOn, patientKey, PATIENT_FIELDS, todayISO } from "../ficha-rules.mjs?v=91";
import { api } from "./api.js?v=77";
import { dialogAlert } from "./dom.js?v=78";
import { printItems } from "./print.js?v=82";
import { initForm } from "./form.js?v=88";
import { initLibrary } from "./library.js?v=93";
import { initCompare } from "./compare.js?v=79";
import { initPacientesModule } from "./pacientes.js?v=3";
import { initHorariosModule } from "./horarios.js?v=3";
import { initHonorariosModule } from "./honorarios.js?v=2";
import { initAdminModule } from "./admin-panel.js?v=9";
import { initConfiguracionModule } from "./configuracion.js?v=28";
import { initDashboardModule, updateDashboardClara, updateDashboardBooking } from "./dashboard.js?v=10";
import { initInteraccionesModule } from "./interacciones.js?v=4";

export function initAppControllers({
  loadAll,
  getSessionUser,
  fillForm,
  blank,
  showForm,
  showLibrary,
  showCompare,
  switchTab,
  upsert,
  remove,
  refresh,
}) {
  initForm({
    onSave: async (data, meta) => {
      if (meta?.identityKey) {
        const siblings = loadAll().filter((ficha) => ficha.id !== data.id && patientKey(ficha) === meta.identityKey);
        for (const sibling of siblings) {
          const next = { ...sibling };
          for (const key of PATIENT_FIELDS) next[key] = data[key];
          next.sinDocumento = Boolean(data.sinDocumento);
          next.edad = ageOn(data.nacimiento, sibling.fechaSesion) || sibling.edad;
          await upsert(next);
        }
      }
      await upsert(data);
      showLibrary();
    },
    onBack: () => showLibrary(),
    onCompare: (pKey, id) => showCompare(pKey, id),
    onPrint: (items) => printItems(items, getSessionUser()),
    getSessionUser,
  });

  initLibrary({
    getSessionUser,
    onOpenFicha: (item) => {
      fillForm(item, loadAll());
      showForm(0);
    },
    onNewSessionFicha: (copy) => {
      fillForm(copy, loadAll());
      showForm(0);
    },
    onPdfFicha: (items) => printItems(items, getSessionUser()),
    onDeleteFicha: async (item) => {
      try {
        await remove(item.id);
      } catch (error) {
        if (!error.auth) dialogAlert(error.message);
      }
    },
    onDeleteBatchFichas: async (items) => {
      await Promise.allSettled(items.map((item) => api(`fichas.php?id=${encodeURIComponent(item.id)}`, { method: "DELETE" })));
      try {
        await refresh();
      } catch (error) {
        if (!error.auth) dialogAlert(error.message);
      }
    },
    onComparePatient: (pk) => showCompare(pk),
    onNewFichaBlank: () => {
      fillForm(blank(), loadAll());
      showForm(0);
    },
    upsertFn: upsert,
    blankFn: blank,
    fillFormFn: (d) => fillForm(d, loadAll()),
    showFormFn: (targetStep = 0) => showForm(targetStep),
    todayStr: todayISO(),
  });

  initCompare({
    getAllFichas: loadAll,
    getSessionUser,
    onBackToLibrary: () => showLibrary(),
    onBackToForm: () => showForm(0),
  });

  fillForm(blank(), loadAll());
  initPacientesModule();
  initHorariosModule();
  initHonorariosModule();
  initAdminModule();
  initConfiguracionModule({
    onClaraToggled: (active) => updateDashboardClara(active),
    onBookingToggled: (active) => updateDashboardBooking(active),
  });
  initDashboardModule({
    onNavigate: (tab, subtab) => switchTab(tab, subtab),
    onNewFicha: () => {
      switchTab("fichas");
      fillForm(blank(), loadAll());
      showForm(0);
    },
    onNewPaciente: () => {
      switchTab("pacientes");
      document.querySelector("#btn-nuevo-paciente")?.click();
    },
  });
  initInteraccionesModule();
}
