/**
 * Kinésica Admin - Comparador de Evolución Sesión a Sesión
 * Permite contrastar dos sesiones cualesquiera de un paciente, calculando variaciones (Δ),
 * tendencias clínicas (mejoría/empeoramiento), tarjetas de KPIs e informe comparativo A4 en PDF.
 */

import {
  compareFichas,
  patientKey,
  normalizeDni,
} from "../ficha-rules.mjs?v=90";
import { formatDate } from "./api.js?v=77";
import { escapeHtml, switchActiveView } from "./dom.js?v=78";
import { buildComparePrintSheet, printCompare } from "./compare-print.js";
import { renderCompareTab as renderTabContent, setupCompareOptions, updateCompareBanner } from "./compare-tabs.js";

export { buildComparePrintSheet, printCompare };

export function renderCompareTab(tabKey, res) {
  return renderTabContent(tabKey, res, comparePanelsWrap);
}

const compareView = document.querySelector("#view-compare");
const formView = document.querySelector("#view-form");

const compareSelectX = document.querySelector("#compare-select-x");
const compareSelectY = document.querySelector("#compare-select-y");
const compareSwapBtn = document.querySelector("#btn-compare-swap");
const compareBackBtn = document.querySelector("#btn-compare-back");
const comparePdfBtn = document.querySelector("#btn-compare-pdf");
const comparePatientName = document.querySelector("#compare-patient-name");
const comparePatientMeta = document.querySelector("#compare-patient-meta");
const compareBanner = document.querySelector("#compare-banner");
const compareTabCount = document.querySelector("#compare-tab-count");
const comparePanelsWrap = document.querySelector("#compare-panels-wrap");

let comparePatient = null;
let comparePreviousView = "library";
let activeCompareTab = "summary";
let currentCompareResult = null;
let activeAllFichasGetter = null;
let activeSessionUserGetter = null;

export function showCompare(pKey, preferredXId, preferredYId, fromView = null) {
  comparePreviousView = fromView || (formView && !formView.hidden ? "form" : "library");
  switchActiveView("view-compare");

  const allFichas = typeof activeAllFichasGetter === "function" ? activeAllFichasGetter() : [];
  let resolvedKey = pKey;
  if (typeof pKey === "object" && pKey !== null) {
    resolvedKey = patientKey(pKey);
  } else if (pKey && allFichas.some((f) => f.id === pKey)) {
    const found = allFichas.find((f) => f.id === pKey);
    resolvedKey = patientKey(found);
  } else if (typeof pKey === "string" && pKey.includes("|")) {
    const legacy = allFichas.find((f) => {
      const nombre = String(f?.nombre || "").trim().toLowerCase();
      return `${nombre}|${normalizeDni(f?.dni)}` === pKey;
    });
    if (legacy) resolvedKey = patientKey(legacy);
  }

  comparePatient = resolvedKey;
  try {
    sessionStorage.setItem(
      "kinesica_admin_view",
      JSON.stringify({
        view: "compare",
        pKey: resolvedKey,
        xId: preferredXId || null,
        yId: preferredYId || null,
      })
    );
  } catch {}
  populateCompareSessions(resolvedKey, preferredXId, preferredYId);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function populateCompareSessions(pKey, preferredXId, preferredYId) {
  const allFichas = typeof activeAllFichasGetter === "function" ? activeAllFichasGetter() : [];
  const patientSessions = allFichas
    .filter((f) => patientKey(f) === pKey)
    .sort((a, b) => (
      (a.fechaSesion || "").localeCompare(b.fechaSesion || "") ||
      (a.savedAt || a.id || "").localeCompare(b.savedAt || b.id || "")
    ));

  if (!patientSessions.length) {
    if (compareBanner) {
      compareBanner.className = "compare-banner is-same-session";
      compareBanner.textContent = "No se encontraron sesiones para este paciente.";
    }
    if (comparePanelsWrap) comparePanelsWrap.innerHTML = "";
    return;
  }

  const latestSession = patientSessions[patientSessions.length - 1];
  const patientName = latestSession.nombre || "Paciente";
  const patientDni = latestSession.dni || "—";
  if (comparePatientName) {
    comparePatientName.innerHTML = `<span class="bar"></span>Evolución: ${escapeHtml(patientName)}`;
  }
  if (comparePatientMeta) {
    comparePatientMeta.textContent = `DNI ${patientDni} · ${patientSessions.length} ${
      patientSessions.length === 1 ? "sesión registrada" : "sesiones registradas"
    }`;
  }

  setupCompareOptions(patientSessions, compareSelectX, compareSelectY, preferredXId, preferredYId);
  renderCompareContent();
}

export function renderCompareContent() {
  if (!compareSelectX || !compareSelectY) return;
  const idX = compareSelectX.value;
  const idY = compareSelectY.value;
  const allFichas = typeof activeAllFichasGetter === "function" ? activeAllFichasGetter() : [];
  const sessionX = allFichas.find((f) => f.id === idX);
  const sessionY = allFichas.find((f) => f.id === idY);

  if (!sessionX || !sessionY) {
    if (compareBanner) {
      compareBanner.className = "compare-banner is-same-session";
      compareBanner.textContent = "Seleccioná dos sesiones para comparar.";
    }
    if (comparePanelsWrap) comparePanelsWrap.innerHTML = "";
    return;
  }

  const isSame = idX === idY;
  const res = compareFichas(sessionX, sessionY);
  res.sessionX = sessionX;
  res.sessionY = sessionY;
  currentCompareResult = res;

  if (compareTabCount) {
    compareTabCount.textContent = res.totalChanged;
  }

  updateCompareBanner(compareBanner, isSame, sessionX, sessionY, res, allFichas);

  try {
    if (compareSelectX && compareSelectY && comparePatient) {
      sessionStorage.setItem(
        "kinesica_admin_view",
        JSON.stringify({
          view: "compare",
          pKey: comparePatient,
          xId: compareSelectX.value,
          yId: compareSelectY.value,
        })
      );
    }
  } catch {}

  renderCompareTab(activeCompareTab, res);
}

export function initCompare({ getAllFichas, getSessionUser, onBackToLibrary, onBackToForm }) {
  activeAllFichasGetter = getAllFichas;
  activeSessionUserGetter = getSessionUser;

  if (compareSwapBtn) {
    compareSwapBtn.addEventListener("click", () => {
      const curX = compareSelectX.value;
      const curY = compareSelectY.value;
      compareSelectX.value = curY;
      compareSelectY.value = curX;
      renderCompareContent();
    });
  }

  if (compareSelectX) compareSelectX.addEventListener("change", renderCompareContent);
  if (compareSelectY) compareSelectY.addEventListener("change", renderCompareContent);

  if (compareBackBtn) {
    compareBackBtn.addEventListener("click", () => {
      if (compareView) compareView.hidden = true;
      try {
        sessionStorage.setItem(
          "kinesica_admin_view",
          JSON.stringify({ view: comparePreviousView || "library" })
        );
      } catch {}
      if (comparePreviousView === "form") {
        if (typeof onBackToForm === "function") onBackToForm();
      } else {
        if (typeof onBackToLibrary === "function") onBackToLibrary();
      }
    });
  }

  if (comparePdfBtn) {
    comparePdfBtn.addEventListener("click", () => {
      const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
      if (currentCompareResult) printCompare(currentCompareResult, sessionUser);
    });
  }

  document.querySelectorAll(".compare-steps button").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCompareTab = btn.dataset.compareTab;
      document.querySelectorAll(".compare-steps button").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      if (currentCompareResult) {
        renderCompareTab(activeCompareTab, currentCompareResult);
      }
    });
  });
}
