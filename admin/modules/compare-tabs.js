/**
 * Kinésica Admin - Renderizado de Pestañas Comparativas
 * Genera el marcado interactivo para la vista resumen ("Lo que cambió") y paneles por sección (0..4 o all).
 */

import { formatDate } from "./api.js?v=77";
import { escapeHtml } from "./dom.js?v=78";
import { patientKey } from "../ficha-rules.mjs?v=90";

/**
 * Renderiza el contenido de la pestaña comparativa activa (resumen o secciones 0..4 o all).
 * @param {string} tabKey "summary", "0", "1", "2", "3", "4" o "all"
 * @param {object} res Resultado de compareFichas
 * @param {HTMLElement} comparePanelsWrap
 */
export function renderCompareTab(tabKey, res, comparePanelsWrap) {
  if (!comparePanelsWrap) return;
  comparePanelsWrap.innerHTML = "";

  if (tabKey === "summary") {
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

export function setupCompareOptions(patientSessions, selectX, selectY, preferredXId, preferredYId) {
  if (!selectX || !selectY) return;
  selectX.innerHTML = "";
  selectY.innerHTML = "";

  patientSessions.forEach((s, idx) => {
    const label = `Sesión ${idx + 1} (${formatDate(s.fechaSesion)}) - ${s.profesionalNombre || "Sin prof."}`;
    const optX = document.createElement("option");
    optX.value = s.id;
    optX.textContent = label;
    selectX.append(optX);

    const optY = document.createElement("option");
    optY.value = s.id;
    optY.textContent = label;
    selectY.append(optY);
  });

  if (patientSessions.length >= 2) {
    if (preferredXId && preferredYId) {
      selectX.value = preferredXId;
      selectY.value = preferredYId;
    } else if (preferredXId) {
      const idx = patientSessions.findIndex((s) => s.id === preferredXId);
      if (idx > 0) {
        selectX.value = patientSessions[idx - 1].id;
        selectY.value = preferredXId;
      } else {
        selectX.value = preferredXId;
        selectY.value = patientSessions[patientSessions.length - 1].id;
      }
    } else {
      selectX.value = patientSessions[0].id;
      selectY.value = patientSessions[patientSessions.length - 1].id;
    }
  } else {
    selectX.value = patientSessions[0].id;
    selectY.value = patientSessions[0].id;
  }
}

export function updateCompareBanner(compareBanner, isSame, sessionX, sessionY, res, allFichas) {
  if (!compareBanner) return;
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
    return;
  }
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
      <span class="compare-tag-pill ${res.totalChanged > 0 ? "accent" : ""}">⚡ ${countText}</span>
    </div>
  `;
}
