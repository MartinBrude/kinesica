/**
 * Kinésica Admin - Comparador de Evolución Sesión a Sesión
 * Permite contrastar dos sesiones cualesquiera de un paciente, calculando variaciones (Δ),
 * tendencias clínicas (mejoría/empeoramiento), tarjetas de KPIs e informe comparativo A4 en PDF.
 */

import {
  compareFichas,
  patientKey,
  CLINICIAN_DETAILS,
} from "../ficha-rules.mjs?v=55";
import { formatDate } from "./api.js?v=55";
import { escapeHtml, node } from "./dom.js?v=55";

const compareView = document.querySelector("#view-compare");
const libraryView = document.querySelector("#view-library");
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

/**
 * Muestra la vista comparativa para un paciente dado.
 * @param {string|object} pKey Clave del paciente o ficha
 * @param {string} [preferredXId] ID preferido para la sesión base X
 * @param {string} [preferredYId] ID preferido para la sesión comparada Y
 * @param {string} [fromView] Vista de procedencia ("library" o "form")
 */
export function showCompare(pKey, preferredXId, preferredYId, fromView = null) {
  comparePreviousView = fromView || (formView && !formView.hidden ? "form" : "library");
  const gateView = document.querySelector("#view-gate");
  if (gateView) gateView.hidden = true;
  if (libraryView) libraryView.hidden = true;
  if (formView) formView.hidden = true;
  if (compareView) compareView.hidden = false;

  const allFichas = typeof activeAllFichasGetter === "function" ? activeAllFichasGetter() : [];
  let resolvedKey = pKey;
  if (typeof pKey === "object" && pKey !== null) {
    resolvedKey = patientKey(pKey);
  } else if (pKey && allFichas.some((f) => f.id === pKey)) {
    const found = allFichas.find((f) => f.id === pKey);
    resolvedKey = patientKey(found);
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

/**
 * Llena los selectores de sesión (X e Y) con todas las sesiones registradas del paciente.
 * @param {string} pKey Clave del paciente
 * @param {string} [preferredXId]
 * @param {string} [preferredYId]
 */
export function populateCompareSessions(pKey, preferredXId, preferredYId) {
  const allFichas = typeof activeAllFichasGetter === "function" ? activeAllFichasGetter() : [];
  const patientSessions = allFichas
    .filter((f) => patientKey(f) === pKey)
    .sort((a, b) => (a.fechaSesion || "").localeCompare(b.fechaSesion || ""));

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

  if (compareSelectX) compareSelectX.innerHTML = "";
  if (compareSelectY) compareSelectY.innerHTML = "";

  patientSessions.forEach((s, idx) => {
    const label = `Sesión ${idx + 1} (${formatDate(s.fechaSesion)}) - ${s.profesionalNombre || "Sin prof."}`;
    const optX = document.createElement("option");
    optX.value = s.id;
    optX.textContent = label;
    if (compareSelectX) compareSelectX.append(optX);

    const optY = document.createElement("option");
    optY.value = s.id;
    optY.textContent = label;
    if (compareSelectY) compareSelectY.append(optY);
  });

  if (patientSessions.length >= 2) {
    if (preferredXId && preferredYId) {
      if (compareSelectX) compareSelectX.value = preferredXId;
      if (compareSelectY) compareSelectY.value = preferredYId;
    } else if (preferredXId) {
      const idx = patientSessions.findIndex((s) => s.id === preferredXId);
      if (idx > 0) {
        if (compareSelectX) compareSelectX.value = patientSessions[idx - 1].id;
        if (compareSelectY) compareSelectY.value = preferredXId;
      } else {
        if (compareSelectX) compareSelectX.value = preferredXId;
        if (compareSelectY) compareSelectY.value = patientSessions[patientSessions.length - 1].id;
      }
    } else {
      if (compareSelectX) compareSelectX.value = patientSessions[0].id;
      if (compareSelectY) compareSelectY.value = patientSessions[patientSessions.length - 1].id;
    }
  } else {
    if (compareSelectX) compareSelectX.value = patientSessions[0].id;
    if (compareSelectY) compareSelectY.value = patientSessions[0].id;
  }

  renderCompareContent();
}

/**
 * Lee las dos sesiones seleccionadas, ejecuta compareFichas y actualiza los indicadores.
 */
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

  if (compareBanner) {
    if (isSame) {
      const patientSessions = allFichas.filter((f) => patientKey(f) === patientKey(sessionX));
      if (patientSessions.length <= 1) {
        compareBanner.className = "compare-banner is-same-session";
        compareBanner.innerHTML = `<span><strong>Solo hay 1 sesión registrada (${formatDate(
          sessionX.fechaSesion
        )}):</strong> Se necesitan al menos 2 sesiones para contrastar la evolución. Abajo podés ver todos los valores registrados.</span>`;
      } else {
        compareBanner.className = "compare-banner is-same-session";
        compareBanner.innerHTML = `<span><strong>Misma sesión seleccionada (${formatDate(
          sessionX.fechaSesion
        )}):</strong> Elegí una sesión distinta en «Sesión base» o «Sesión comparada» para ver la evolución.</span>`;
      }
    } else {
      compareBanner.className = "compare-banner";
      const daysText = res.daysBetween != null ? `${res.daysBetween} días de diferencia` : "Sin fechas";
      const countText =
        res.totalChanged === 1 ? "1 cambio registrado" : `${res.totalChanged} cambios registrados`;
      compareBanner.innerHTML = `
        <div class="compare-banner-meta" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span>Comparando <strong>Sesión del ${formatDate(
            sessionX.fechaSesion
          )}</strong> vs <strong>Sesión del ${formatDate(sessionY.fechaSesion)}</strong></span>
        </div>
        <div class="compare-banner-tags" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="compare-tag-pill">📅 ${daysText}</span>
          <span class="compare-tag-pill ${res.totalChanged > 0 ? 'accent' : ''}">⚡ ${countText}</span>
        </div>
      `;
    }
  }

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

/**
 * Renderiza el contenido de la pestaña comparativa activa (resumen o secciones 0..4 o all).
 * @param {string} tabKey "summary", "0", "1", "2", "3", "4" o "all"
 * @param {object} res Resultado de compareFichas
 */
export function renderCompareTab(tabKey, res) {
  if (!comparePanelsWrap) return;
  comparePanelsWrap.innerHTML = "";

  if (tabKey === "summary") {
    // LO CENTRAL: Únicamente los parámetros que SÍ cambiaron
    const allChanged = res.sections.flatMap((sec) =>
      sec.fields
        .filter((f) => f.changed)
        .map((f) => ({
          ...f,
          sectionTitle: sec.title.replace(/^\d+\.\s*/, ""),
        }))
    );

    if (allChanged.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cmp-summary-empty";
      empty.innerHTML = `
        <h3>Sin modificaciones registradas</h3>
        <p>Todos los parámetros clínicos evaluados mantuvieron el mismo estado entre ambas sesiones. Podés navegar por las pestañas superiores para revisar cada sección de la ficha.</p>
      `;
      comparePanelsWrap.append(empty);
      return;
    }

    const block = document.createElement("div");
    block.className = "cmp-changes-block";
    block.innerHTML = `
      <div class="cmp-changes-block-head">
        <h3><span class="bar"></span>Parámetros que cambiaron (${allChanged.length})</h3>
      </div>
      <div class="cmp-changes-grid"></div>
    `;

    const gridEl = block.querySelector(".cmp-changes-grid");
    const dateXStr = formatDate(res.sessionX.fechaSesion);
    const dateYStr = formatDate(res.sessionY.fechaSesion);

    allChanged.forEach((f) => {
      const item = document.createElement("div");
      item.className = "cmp-change-item";

      let trendClass = "same";
      let trendLabel = "Modificado";
      if (f.trend === "better") {
        trendClass = "better";
        trendLabel = "Mejoría clínica";
      } else if (f.trend === "worse") {
        trendClass = "worse";
        trendLabel = "Empeoramiento";
      }

      const deltaHtml = f.deltaText
        ? `<span class="cmp-delta-badge ${trendClass}">${escapeHtml(f.deltaText)}</span>`
        : "";

      item.innerHTML = `
        <div class="cmp-change-header">
          <span class="cmp-change-sec-tag">${escapeHtml(f.sectionTitle)}</span>
          <div class="cmp-change-tags">
            ${deltaHtml}
            <span class="cmp-trend-tag ${trendClass}">${trendLabel}</span>
          </div>
        </div>
        <div class="cmp-change-label">${escapeHtml(f.label)}</div>
        <div class="cmp-change-transition">
          <div class="cmp-trans-col cmp-trans-prev">
            <span class="cmp-trans-meta">Sesión inicial (${escapeHtml(dateXStr)})</span>
            <span class="cmp-trans-val">${escapeHtml(f.previous || "—")}</span>
          </div>
          <div class="cmp-trans-arrow" aria-hidden="true">➔</div>
          <div class="cmp-trans-col cmp-trans-curr">
            <span class="cmp-trans-meta">Sesión de control (${escapeHtml(dateYStr)})</span>
            <span class="cmp-trans-val">${escapeHtml(f.current || "—")}</span>
          </div>
        </div>
      `;
      gridEl.append(item);
    });

    comparePanelsWrap.append(block);
    return;
  }

  // Si es una sección específica (0..4) o "all"
  const sectionsToRender =
    tabKey === "all" ? res.sections : [res.sections[Number(tabKey)]].filter(Boolean);

  sectionsToRender.forEach((sec) => {
    const panel = document.createElement("div");
    panel.className = "cmp-panel";
    panel.innerHTML = `
      <h2><span class="bar"></span>${escapeHtml(sec.title)}</h2>
      <div class="cmp-panel-grid"></div>
    `;

    const gridEl = panel.querySelector(".cmp-panel-grid");

    sec.fields.forEach((f) => {
      const box = document.createElement("div");
      box.className = `cmp-field-box ${f.changed ? "is-changed" : "is-same"}`;

      if (f.changed) {
        let trendClass = "same";
        let trendLabel = "Cambió";
        if (f.trend === "better") {
          trendClass = "better";
          trendLabel = "Mejora";
        } else if (f.trend === "worse") {
          trendClass = "worse";
          trendLabel = "Empeoró";
        }

        const deltaHtml = f.deltaText
          ? `<span class="cmp-delta-badge ${trendClass}">${escapeHtml(f.deltaText)}</span>`
          : "";

        box.innerHTML = `
          <div class="cmp-field-top">
            <span class="cmp-field-title">${escapeHtml(f.label)}</span>
            <div class="cmp-field-badges" style="display:flex; align-items:center; gap:6px;">
              <span class="cmp-pill-changed">Cambió</span>
              <span class="cmp-trend-tag ${trendClass}">${trendLabel}</span>
            </div>
          </div>
          <div class="cmp-field-val-box">
            <span class="cmp-field-prev" title="Sesión inicial">${escapeHtml(f.previous || "—")}</span>
            <span class="cmp-field-arrow">➔</span>
            <span class="cmp-field-curr" title="Sesión de control">${escapeHtml(f.current || "—")}</span>
            ${deltaHtml}
          </div>
        `;
      } else {
        box.innerHTML = `
          <div class="cmp-field-top">
            <span class="cmp-field-title">${escapeHtml(f.label)}</span>
            <span class="cmp-pill-same">Sin cambios</span>
          </div>
          <div class="cmp-field-static">${escapeHtml(f.current || "—")}</div>
        `;
      }

      gridEl.append(box);
    });

    comparePanelsWrap.append(panel);
  });
}

/**
 * Genera el documento impreso A4 para la comparativa de evolución.
 * @param {object} res Resultado de compareFichas
 * @returns {HTMLElement} Elemento article.print-sheet
 */
export function buildComparePrintSheet(res) {
  const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
  const sheet = node("article", "print-sheet pf-compare");

  const head = node("header", "pf-head");
  const brand = node("div", "pf-brand");
  const logo = document.createElement("img");
  logo.src = document.querySelector(".brand img")?.currentSrc || "/admin/logo.png";
  logo.alt = "Kinésica";
  const titles = node("div", "pf-titles");
  titles.append(
    node("h1", "", "Evolución clínica de ATM"),
    node("p", "pf-sub", "Comparativa cuantitativa y cualitativa entre sesiones")
  );
  brand.append(logo, titles);

  const sessionMeta = node("div", "pf-session");
  const diffDays = res.daysBetween != null ? `${res.daysBetween} días` : "—";
  sessionMeta.append(
    node("span", "", "Lapso evaluado"),
    node("strong", "", `${formatDate(res.sessionX.fechaSesion)} ➔ ${formatDate(res.sessionY.fechaSesion)}`),
    node("span", "", `Intervalo: ${diffDays}`)
  );
  head.append(brand, sessionMeta);

  const who = node("section", "pf-who");
  who.append(node("h2", "pf-name", res.patient.nombre || "Paciente"));
  const whoGrid = node("div", "pf-grid");
  whoGrid.append(
    node("div", "pf-field", `Documento: ${res.patient.dni || "—"}`),
    node("div", "pf-field", `Edad: ${res.patient.edad ? `${res.patient.edad} años` : "—"}`),
    node("div", "pf-field", `Total cambios registrados: ${res.totalChanged}`)
  );
  who.append(whoGrid);

  const kpiSection = node("section", "pf-section");
  kpiSection.append(node("h2", "", "Indicadores clave de evolución"));
  const kpiGrid = node("div", "pf-compare-kpi-grid");

  const kpiDefs = [
    { title: "Dolor (EVA)", data: res.kpis.eva },
    { title: "Apertura libre", data: res.kpis.aperturaLibre },
    { title: "Apertura con dolor", data: res.kpis.aperturaDolor },
    { title: "Ruidos articulares", data: res.kpis.ruidos },
  ];

  kpiDefs.forEach((k) => {
    const card = node("div", "pf-compare-kpi");
    card.append(node("span", "", k.title));
    const trendText = k.data.trend === "better" ? " (Mejora)" : (k.data.trend === "worse" ? " (Empeoró)" : "");
    const deltaStr = k.data.deltaText ? ` [${k.data.deltaText}${trendText}]` : "";
    card.append(node("strong", "", `${k.data.current ?? "—"}${deltaStr}`));
    kpiGrid.append(card);
  });
  kpiSection.append(kpiGrid);

  const tableSection = node("section", "pf-section");
  tableSection.append(node("h2", "", "Detalle comparativo por sección"));

  const table = node("table", "pf-compare-table");
  const thead = node("thead", "");
  thead.innerHTML = `<tr><th>Sección / Parámetro</th><th>Sesión base (${formatDate(
    res.sessionX.fechaSesion
  )})</th><th>Sesión actual (${formatDate(res.sessionY.fechaSesion)})</th><th>Estado</th></tr>`;
  table.append(thead);

  const tbody = node("tbody", "");
  res.sections.forEach((sec) => {
    const headerRow = node("tr", "sec-header-row");
    headerRow.innerHTML = `<td colspan="4" style="background:#f8fafc; font-weight:700; color:#031c42; padding:6px 8px;">${escapeHtml(
      sec.title
    )}</td>`;
    tbody.append(headerRow);

    sec.fields.forEach((f) => {
      const tr = node("tr", f.changed ? "is-changed" : "");
      const deltaText = f.deltaText ? ` (${f.deltaText})` : "";
      const statusText = f.changed
        ? f.trend === "better"
          ? `Mejora${deltaText}`
          : f.trend === "worse"
          ? `Empeoramiento${deltaText}`
          : `Modificado${deltaText}`
        : "Sin cambios";

      tr.innerHTML = `
        <td style="padding-left:14px;">${escapeHtml(f.label)}</td>
        <td>${escapeHtml(f.previous || "—")}</td>
        <td>${escapeHtml(f.current || "—")}</td>
        <td><strong>${escapeHtml(statusText)}</strong></td>
      `;
      tbody.append(tr);
    });
  });
  table.append(tbody);
  tableSection.append(table);

  const profKey =
    res.sessionY?.profesional || (sessionUser?.username === "maria" ? "maria" : "norberto");
  const details = CLINICIAN_DETAILS[profKey] || {
    nombre: res.sessionY?.profesionalNombre || "Lic. Norberto Brude",
    titulo: "Kinesiólogo Fisiatra · Osteopatía",
    matricula: "M.N. 4930 · M.P. 518",
    signatureFile: `/admin/signatures/${profKey}.png`,
  };

  const sigBox = node("div", "pf-signature");
  const sigImg = document.createElement("img");
  sigImg.className = "pf-sig-image";
  sigImg.alt = `Firma digital ${details.nombre}`;
  sigImg.src = details.signatureFile;
  sigImg.onerror = () => {
    sigImg.classList.add("pf-sig-missing");
  };

  const sigStamp = node("div", "pf-sig-stamp");
  sigStamp.append(
    node("span", "pf-sig-rule"),
    node("strong", "pf-sig-name", details.nombre),
    node("span", "pf-sig-title", details.titulo),
    details.matricula ? node("span", "pf-sig-mat", details.matricula) : null
  );
  sigBox.append(sigImg, sigStamp);

  const foot = node("footer", "pf-foot");
  foot.append(
    node("span", "", "Informe comparativo de evolución clínica · Kinésica ATM"),
    node("span", "", "Charcas 3889, Palermo, CABA · +54 (11) 6156-4311")
  );

  sheet.append(head, who, kpiSection, tableSection, sigBox, foot);
  return sheet;
}

/**
 * Prepara el informe comparativo para imprimir o exportar como PDF.
 * @param {object} res
 */
export async function printCompare(res) {
  if (!res) return;
  const root = document.querySelector("#print-root");
  if (!root) return;
  root.replaceChildren();
  root.append(buildComparePrintSheet(res));
  const previousTitle = document.title;
  document.title = `Evolución ATM - ${res.patient.nombre || "Paciente"} - ${formatDate(
    res.sessionX.fechaSesion
  )} vs ${formatDate(res.sessionY.fechaSesion)}`;
  await Promise.all(
    [...root.querySelectorAll("img")].map((img) =>
      img.decode ? img.decode() : Promise.resolve()
    ).map((p) => p.catch(() => {}))
  );
  window.print();
  setTimeout(() => {
    document.title = previousTitle;
  }, 1000);
}

/**
 * Inicializa los controladores de eventos para la vista comparativa.
 * @param {object} options
 */
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
      if (currentCompareResult) printCompare(currentCompareResult);
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
