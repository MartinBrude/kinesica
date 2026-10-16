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
} from "./ficha-rules.mjs?v=86";

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
} from "./modules/auth.js?v=78";

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
} from "./modules/form.js?v=84";

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
} from "./modules/library.js?v=89";

import {
  buildSheet,
  printItems,
} from "./modules/print.js?v=80";

import {
  showCompare,
  populateCompareSessions,
  renderCompareContent,
  renderCompareTab,
  buildComparePrintSheet,
  printCompare,
  initCompare,
} from "./modules/compare.js?v=79";

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

  const formView = document.querySelector("#view-form");
  const compareView = document.querySelector("#view-compare");
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem("kinesica_admin_view") || "null");
  } catch {}

  if ((!formView || formView.hidden) && (!compareView || compareView.hidden)) {
    if (saved?.view === "compare" && saved.pKey) {
      showCompare(saved.pKey, saved.xId, saved.yId);
    } else if (saved?.view !== "form") {
      showLibrary();
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

  showLibrary();
}

// Configurar manejador de sesión expirada (HTTP 401)
setAuthRequiredHandler((data) => {
  setSessionUser(null);
  showGate(data);
});

// Inicializar el controlador de autenticación
initAuth({
  onSuccess: async () => {
    await refresh();
    showLibrary();
  },
  onLogout: () => {
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

/**
 * Inicializa los controles de canales (Clara y Botón Agendar en web) en el modo admin.
 * Ambos requieren confirmación explícita antes de cambiar el estado y sincronizan con settings.php.
 */
function initAdminChannels() {
  const claraBtn = document.getElementById("btn-toggle-clara");
  const bookingBtn = document.getElementById("btn-toggle-booking");

  let claraActive = localStorage.getItem("kinesica_clara_active") === "1";
  let bookingActive = localStorage.getItem("kinesica_booking_active") === "1";

  function renderClara(isActive) {
    if (!claraBtn) return;
    const label = claraBtn.querySelector(".clara-label");
    claraBtn.classList.toggle("is-active", isActive);
    claraBtn.classList.toggle("is-inactive", !isActive);
    claraBtn.setAttribute("aria-pressed", String(isActive));
    if (label) {
      label.textContent = isActive ? "Clara: Activa" : "Clara: Desactivada";
    }
    claraBtn.title = isActive
      ? "Clara está activa (tocá para desactivar)"
      : "Clara está desactivada (tocá para activar)";
  }

  function renderBooking(isActive) {
    if (!bookingBtn) return;
    const label = bookingBtn.querySelector(".clara-label");
    bookingBtn.classList.toggle("is-active", isActive);
    bookingBtn.classList.toggle("is-inactive", !isActive);
    bookingBtn.setAttribute("aria-pressed", String(isActive));
    if (label) {
      label.textContent = isActive ? "Agendar en web: Activo" : "Agendar en web: Desactivado";
    }
    bookingBtn.title = isActive
      ? "Botón Agendar visible en la web (tocá para desactivar)"
      : "Botón Agendar oculto en la web (tocá para activar)";
  }

  renderClara(claraActive);
  renderBooking(bookingActive);

  // Sincronizar con el backend
  api("settings.php")
    .then((data) => {
      if (!data) return;
      if (typeof data.clara_active === "boolean") {
        claraActive = data.clara_active;
        localStorage.setItem("kinesica_clara_active", claraActive ? "1" : "0");
        renderClara(claraActive);
      }
      if (typeof data.booking_active === "boolean") {
        bookingActive = data.booking_active;
        localStorage.setItem("kinesica_booking_active", bookingActive ? "1" : "0");
        renderBooking(bookingActive);
      }
    })
    .catch(() => {});

  if (claraBtn) {
    claraBtn.addEventListener("click", async () => {
      const willDeactivate = claraActive;
      const question = willDeactivate
        ? "¿Estás seguro de que querés desactivar a Clara? En la web pública los botones de contacto volverán a abrir el WhatsApp del consultorio en vez del de Clara."
        : "¿Estás seguro de que querés activar a Clara? En la web pública los botones de contacto abrirán el WhatsApp de Clara.";

      const confirmed = await dialogConfirm(question, {
        danger: willDeactivate,
        okText: willDeactivate ? "Desactivar" : "Activar",
        cancelText: "Cancelar",
      });

      if (!confirmed) return;

      claraActive = !claraActive;
      localStorage.setItem("kinesica_clara_active", claraActive ? "1" : "0");
      renderClara(claraActive);

      api("settings.php", {
        method: "POST",
        body: JSON.stringify({ clara_active: claraActive }),
      }).catch((err) => {
        if (!err.auth) dialogAlert("No se pudo guardar la configuración en el servidor.");
      });

      window.dispatchEvent(
        new CustomEvent("clara:status-change", { detail: { active: claraActive } })
      );
    });
  }

  if (bookingBtn) {
    bookingBtn.addEventListener("click", async () => {
      const willDeactivate = bookingActive;
      const question = willDeactivate
        ? "¿Estás seguro de que querés desactivar el botón 'Agendar' en la web? Los pacientes ya no verán el botón para reservar turnos en la portada."
        : "¿Estás seguro de que querés activar el botón 'Agendar' en la web? Los pacientes verán el botón destacado para reservar turnos en la portada.";

      const confirmed = await dialogConfirm(question, {
        danger: willDeactivate,
        okText: willDeactivate ? "Desactivar" : "Activar",
        cancelText: "Cancelar",
      });

      if (!confirmed) return;

      bookingActive = !bookingActive;
      localStorage.setItem("kinesica_booking_active", bookingActive ? "1" : "0");
      renderBooking(bookingActive);

      api("settings.php", {
        method: "POST",
        body: JSON.stringify({ booking_active: bookingActive }),
      }).catch((err) => {
        if (!err.auth) dialogAlert("No se pudo guardar la configuración en el servidor.");
      });

      window.dispatchEvent(
        new CustomEvent("booking:status-change", { detail: { active: bookingActive } })
      );
    });
  }
}

initAdminChannels();

// Inicialización de la aplicación al cargar la página
fillForm(blank(), loadAll());

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
