/**
 * Kinésica Admin - Aplicación Principal y Orquestador Modular
 *
 * Módulo de administración de historias clínicas de ATM (CDI-TTM).
 * Arquitectura modular dividida en:
 * - api.js: Cliente HTTP con cabecera anti-CSRF y manejo de credenciales.
 * - dom.js: Primitivas DOM, saneamiento de XSS (escapeHtml) y debounce.
 * - auth.js: Autenticación, segundo factor TOTP 2FA, reseteo de claves y Gate.
 * - form.js: Formulario de ficha clínica en 5 pasos, cálculo de edad y escala EVA.
 * - library.js: Biblioteca de pacientes, agrupación de sesiones, búsqueda y paginación.
 * - print.js: Reportes clínicos institucionales en formato A4 con sellos y firmas digitales.
 * - compare.js: Comparador de evolución clínica sesión a sesión (KPIs y transiciones).
 */

import {
  exampleFicha,
  missingFields,
  missingFieldKeys,
  emptyFicha,
  ownsFicha,
  nextSession,
  ageOn,
  REQUIRED_FIELDS,
  CLINICIAN_DETAILS,
  patientKey,
  PATIENT_FIELDS,
  coerceFicha,
  compareFichas,
  daysBetween,
  matchFichaSearch,
} from "./ficha-rules.mjs?v=90";

import {
  api,
  setAuthRequiredHandler,
  formatDate,
} from "./modules/api.js?v=77";

import {
  escapeHtml,
  node,
  field,
  side,
  section,
  grid,
  prose,
  formatParts,
  add,
  debounce,
  dialogAlert,
  dialogConfirm,
} from "./modules/dom.js?v=78";

import {
  getSessionUser,
  setSessionUser,
  showGate,
  hideGate,
  setGateMessage,
  initAuth,
} from "./modules/auth.js?v=80";

import {
  todayISO,
  blank,
  readForm,
  fillForm,
  formState,
  syncAge,
  updateStepValidation,
  highlightMissingFields,
  evaMeta,
  syncEva,
  syncFollowups,
  showStep,
  showForm,
  getCurrentId,
  setCurrentId,
  initForm,
} from "./modules/form.js?v=87";

import {
  loadAll,
  setCache,
  resetLibrary,
  showLibrary,
  visibleFichas,
  renderLibrary,
  fichaRow,
  patientGroupRow,
  sessionRow,
  pageWindow,
  syncMineButton,
  downloadJSON,
  initLibrary,
} from "./modules/library.js?v=93";

import {
  buildSheet,
  printItems,
} from "./modules/print.js?v=82";

import {
  showCompare,
  populateCompareSessions,
  renderCompareContent,
  renderCompareTab,
  buildComparePrintSheet,
  printCompare,
  initCompare,
} from "./modules/compare.js?v=79";

import {
  initPacientesModule,
  showPacientesView,
  hidePacientesView,
} from "./modules/pacientes.js?v=3";

import {
  initDashboardModule,
  showDashboardView,
  hideDashboardView,
  updateDashboardClara,
  updateDashboardBooking,
  updateDashboardState,
} from "./modules/dashboard.js?v=8";

import {
  initHorariosModule,
  showHorariosView,
  hideHorariosView,
  applyHoursToRuntime,
} from "./modules/horarios.js?v=3";

import {
  initHonorariosModule,
  showHonorariosView,
  hideHonorariosView,
} from "./modules/honorarios.js?v=2";

import {
  initConfiguracionModule,
  showConsultorioView,
  hideConsultorioView,
  showClaraView,
  hideClaraView,
  showConfiguracionView,
  hideConfiguracionView,
} from "./modules/configuracion.js?v=24";

import {
  initAdminModule,
  showAdminView,
  hideAdminView,
} from "./modules/admin-panel.js?v=4";

// Re-exportar utilidades esenciales para interoperabilidad y pruebas
export {
  api,
  blank,
  readForm,
  fillForm,
  loadAll,
  showLibrary,
  showForm,
  showCompare,
  compareFichas,
  renderCompareContent,
  renderCompareTab,
  printCompare,
  downloadJSON,
  escapeHtml,
  formatDate,
  todayISO,
  upsert,
  refresh,
  patientGroupRow,
  sessionRow,
};

/**
 * Guarda o actualiza una ficha en el backend.
 * @param {object} data Datos de la ficha
 * @returns {Promise<object>} Ficha persistida devuelta por la API
 */
let refreshSeq = 0;
let localWrites = 0;

async function upsert(data) {
  const saved = await api("fichas.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
  localWrites += 1;
  const currentCache = loadAll();
  const idx = currentCache.findIndex((f) => f.id === saved.id);
  if (idx >= 0) {
    currentCache[idx] = saved;
  } else {
    currentCache.unshift(saved);
  }
  setCache(currentCache);
  renderLibrary();
  return saved;
}

/**
 * Elimina una ficha clínica del servidor.
 * @param {string} id ID único de la ficha
 */
async function remove(id) {
  await api(`fichas.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  await refresh();
}

/**
 * Sincroniza el estado del usuario y la biblioteca completa desde el backend.
 */
async function refresh() {
  const seq = ++refreshSeq;
  const writes = localWrites;
  const me = await api("me.php");
  setSessionUser(me);
  hideGate();
  mountAdminChannels();

  const formView = document.querySelector("#view-form");
  const compareView = document.querySelector("#view-compare");
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem("kinesica_admin_view") || "null");
  } catch {}

  if ((!formView || formView.hidden) && (!compareView || compareView.hidden)) {
    if (saved?.view === "compare" && saved.pKey) {
      showCompare(saved.pKey, saved.xId, saved.yId);
    } else if (saved?.view === "pacientes") {
      switchTab("pacientes");
    } else if (saved?.view === "consultorio" || saved?.view === "horarios" || saved?.view === "honorarios") {
      switchTab("consultorio");
    } else if (saved?.view === "clara" || saved?.view === "configuracion") {
      switchTab("clara");
    } else if (saved?.view === "fichas" || saved?.view === "library") {
      switchTab("fichas");
    } else if (saved?.view !== "form") {
      switchTab("inicio");
    }
  }

  const items = await api("fichas.php");
  if (seq !== refreshSeq || writes !== localWrites) return;
  setCache(items);

  if (formView && !formView.hidden) {
    if (saved?.view === "form" && saved.id) {
      const ficha = items.find((f) => f.id === saved.id);
      if (ficha) fillForm(ficha, items);
    }
    return;
  }
  if (compareView && !compareView.hidden) {
    renderCompareContent();
    return;
  }

  if (saved?.view === "form" && saved.id) {
    const ficha = items.find((f) => f.id === saved.id);
    if (ficha) {
      fillForm(ficha, items);
      showForm(0);
      return;
    }
  }

  if (saved?.view === "pacientes") {
    switchTab("pacientes");
  } else if (saved?.view === "consultorio" || saved?.view === "horarios" || saved?.view === "honorarios") {
    switchTab("consultorio");
  } else if (saved?.view === "clara" || saved?.view === "configuracion") {
    switchTab("clara");
  } else if (saved?.view === "fichas" || saved?.view === "library") {
    switchTab("fichas");
  } else {
    switchTab("inicio");
  }
}

// Configurar manejador de sesión expirada (HTTP 401)
setAuthRequiredHandler((data) => {
  unmountAdminChannels();
  setSessionUser(null);
  showGate(data);
});

// Inicializar el controlador de autenticación
initAuth({
  onSuccess: async () => {
    await refresh();
    switchTab("inicio");
    mountAdminChannels();
  },
  onLogout: () => {
    unmountAdminChannels();
    resetLibrary();
    try {
      sessionStorage.removeItem("kinesica_admin_view");
    } catch {}
  },
});

// Inicializar el controlador del formulario clínico
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
  onBack: () => {
    showLibrary();
  },
  onCompare: (pKey, id) => {
    showCompare(pKey, id);
  },
  onPrint: (items) => {
    printItems(items, getSessionUser());
  },
  getSessionUser,
});

// Inicializar la biblioteca de historias clínicas
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
  onPdfFicha: (items) => {
    printItems(items, getSessionUser());
  },
  onDeleteFicha: async (item) => {
    try {
      await remove(item.id);
    } catch (error) {
      if (!error.auth) dialogAlert(error.message);
    }
  },
  onDeleteBatchFichas: async (items) => {
    const results = await Promise.allSettled(
      items.map((item) =>
        api(`fichas.php?id=${encodeURIComponent(item.id)}`, { method: "DELETE" })
      )
    );
    const failed = results.filter((result) => result.status === "rejected");
    try {
      await refresh();
    } catch (error) {
      if (!error.auth) dialogAlert(error.message);
      return;
    }
    if (!failed.length) return;
    const authError = failed.find((result) => result.reason && result.reason.auth);
    if (authError) return;
    const message = failed[0].reason && failed[0].reason.message;
    dialogAlert(
      failed.length === items.length
        ? message || "No se pudieron eliminar las fichas."
        : `Se eliminaron ${items.length - failed.length} de ${items.length}. ${message || ""}`.trim()
    );
  },
  onComparePatient: (patientKey) => {
    showCompare(patientKey);
  },
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

// Inicializar la vista comparativa
initCompare({
  getAllFichas: loadAll,
  getSessionUser,
  onBackToLibrary: () => {
    showLibrary();
  },
  onBackToForm: () => {
    showForm(0);
  },
});

function switchTab(tab) {
  const btnInicio = document.querySelector("#nav-btn-inicio");
  const btnFichas = document.querySelector("#nav-btn-fichas");
  const btnPacientes = document.querySelector("#nav-btn-pacientes");
  const btnConsultorio = document.querySelector("#nav-btn-consultorio");
  const btnClara = document.querySelector("#nav-btn-clara");
  const btnAdmin = document.querySelector("#nav-btn-admin");

  btnInicio?.classList.remove("is-active");
  btnFichas?.classList.remove("is-active");
  btnPacientes?.classList.remove("is-active");
  btnConsultorio?.classList.remove("is-active");
  btnClara?.classList.remove("is-active");
  btnAdmin?.classList.remove("is-active");

  if (tab === "inicio") {
    btnInicio?.classList.add("is-active");
    hidePacientesView();
    hideConsultorioView();
    hideClaraView();
    hideAdminView();
    showDashboardView();
  } else if (tab === "pacientes") {
    btnPacientes?.classList.add("is-active");
    hideDashboardView();
    hideConsultorioView();
    hideClaraView();
    hideAdminView();
    showPacientesView();
  } else if (tab === "consultorio" || tab === "horarios" || tab === "honorarios") {
    btnConsultorio?.classList.add("is-active");
    hideDashboardView();
    hidePacientesView();
    hideClaraView();
    hideAdminView();
    showConsultorioView();
  } else if (tab === "clara" || tab === "configuracion") {
    btnClara?.classList.add("is-active");
    hideDashboardView();
    hidePacientesView();
    hideConsultorioView();
    hideAdminView();
    showClaraView();
  } else if (tab === "admin") {
    btnAdmin?.classList.add("is-active");
    hideDashboardView();
    hidePacientesView();
    hideConsultorioView();
    hideClaraView();
    showAdminView();
  } else {
    btnFichas?.classList.add("is-active");
    hideDashboardView();
    hidePacientesView();
    hideConsultorioView();
    hideClaraView();
    hideAdminView();
    showLibrary();
  }
}

/**
 * Desmonta y remueve del DOM los botones de features para que no existan
 * antes de iniciar sesión ni queden visibles tras cerrar sesión.
 */
function unmountAdminChannels() {
  const nav = document.getElementById("admin-nav");
  if (nav) nav.hidden = true;
}

/**
 * Activa la navegación interna cuando el usuario está debidamente autenticado
 * y sincroniza la configuración con settings.php para el Dashboard.
 */
function mountAdminChannels() {
  const user = getSessionUser();
  if (!user) {
    unmountAdminChannels();
    return;
  }

  const adminNav = document.getElementById("admin-nav");
  if (adminNav) {
    adminNav.hidden = false;
    const btnAdmin = document.getElementById("nav-btn-admin");
    if (btnAdmin) {
      btnAdmin.hidden = user.role !== "admin";
    }

    if (!adminNav.dataset.bound) {
      adminNav.dataset.bound = "1";
      document.getElementById("nav-btn-inicio")?.addEventListener("click", () => switchTab("inicio"));
      document.getElementById("nav-btn-fichas")?.addEventListener("click", () => switchTab("fichas"));
      document.getElementById("nav-btn-pacientes")?.addEventListener("click", () => switchTab("pacientes"));
      document.getElementById("nav-btn-consultorio")?.addEventListener("click", () => switchTab("consultorio"));
      document.getElementById("nav-btn-clara")?.addEventListener("click", () => switchTab("clara"));
      document.getElementById("nav-btn-admin")?.addEventListener("click", () => switchTab("admin"));
      document.getElementById("brand-logo")?.addEventListener("click", (e) => {
        e.preventDefault();
        switchTab("inicio");
      });
    }
  }

  // Sincronizar estado inicial de Clara, Reservas y Horarios con el servidor
  api("settings.php")
    .then((data) => {
      if (!data) return;
      if (typeof data.clara_active === "boolean") {
        localStorage.setItem("kinesica_clara_active", data.clara_active ? "1" : "0");
        updateDashboardClara(data.clara_active);
      }
      if (typeof data.booking_active === "boolean") {
        localStorage.setItem("kinesica_booking_active", data.booking_active ? "1" : "0");
        updateDashboardBooking(data.booking_active);
      }
      if (data.practitioner_hours && typeof data.practitioner_hours === "object") {
        applyHoursToRuntime(data.practitioner_hours);
      }
    })
    .catch(() => {});
}

// Inicialización de la aplicación al cargar la página
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

const resetToken = new URLSearchParams(location.search).get("reset");
const resetFormEl = document.querySelector("#reset-form");

if (resetToken && resetFormEl) {
  resetFormEl.dataset.token = resetToken;
  showGate({ reset: true });
} else {
  refresh().catch((error) => {
    if (!error.auth) showGate({ login: true });
  });
}
