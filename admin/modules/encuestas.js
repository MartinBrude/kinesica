/**
 * Kinésica Admin - Módulo de Encuestas de Satisfacción Anónimas
 * Visualización de métricas (calificación promedio, % recomendación, evolución del tratamiento)
 * y listado de respuestas recibidas desde /encuesta.html.
 */

import { api, formatDate } from "./api.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import { escapeHtml, dialogAlert, dialogConfirm, switchActiveView } from "./dom.js?v=79";
import { setListControlsEnabled } from "./list-controls.js?v=1";

let cachedEncuestas = [];
let currentFilter = "todas"; // 'todas' | 'comentarios' | 'positivas' | 'mejorar'

const TRATAMIENTO_LABELS = {
  excelente: "Muy bien, gran mejoría",
  bien: "Bien, avances progresivos",
  reciente: "Recién empieza",
  poco: "Pocos cambios por ahora",
  sin_cambios: "Sin mejoría aún",
};

const RECOMENDARIA_LABELS = {
  si: "Sí, totalmente",
  tal_vez: "Tal vez",
  no: "Por ahora no",
};

export function showEncuestasView() {
  const view = switchActiveView("view-encuestas");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "encuestas" }));
    } catch { /* ignore */ }
    loadEncuestasData();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

export function hideEncuestasView() {
  const view = document.getElementById("view-encuestas");
  if (view) view.hidden = true;
}

function renderStarsBadge(score) {
  const n = Math.max(1, Math.min(5, Number(score) || 0));
  const stars = "★".repeat(n) + "☆".repeat(5 - n);
  const color = n >= 4 ? "#047857" : n === 3 ? "#b45309" : "#b91c1c";
  const bg = n >= 4 ? "#ecfdf5" : n === 3 ? "#fffbeb" : "#fef2f2";
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-weight:600;font-size:13px;background:${bg};color:${color};"><span style="color:#f59e0b;letter-spacing:1px;">${stars}</span> ${n}/5</span>`;
}

function renderRecBadge(rec) {
  const label = RECOMENDARIA_LABELS[rec] || rec || "—";
  if (rec === "si") {
    return `<span class="error-badge badge-resolved">👍 ${escapeHtml(label)}</span>`;
  }
  if (rec === "tal_vez") {
    return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#fef3c7;color:#92400e;">🤔 ${escapeHtml(label)}</span>`;
  }
  return `<span class="error-badge badge-pending">👎 ${escapeHtml(label)}</span>`;
}

export function renderEncuestas() {
  const kpiAvgEl = document.getElementById("encuestas-kpi-avg");
  const kpiAvgSubEl = document.getElementById("encuestas-kpi-avg-sub");
  const kpiRecEl = document.getElementById("encuestas-kpi-rec");
  const kpiRecSubEl = document.getElementById("encuestas-kpi-rec-sub");
  const kpiTratEl = document.getElementById("encuestas-kpi-trat");
  const kpiTratSubEl = document.getElementById("encuestas-kpi-trat-sub");
  const countPillEl = document.getElementById("encuestas-count-label");
  const tbody = document.getElementById("encuestas-tbody");

  const total = cachedEncuestas.length;
  const sumExp = cachedEncuestas.reduce((acc, item) => acc + (Number(item.experiencia) || 0), 0);
  const avg = total > 0 ? (sumExp / total).toFixed(1) : "—";
  const recSi = cachedEncuestas.filter((i) => i.recomendaria === "si").length;
  const recTalVez = cachedEncuestas.filter((i) => i.recomendaria === "tal_vez").length;
  const recNo = cachedEncuestas.filter((i) => i.recomendaria === "no").length;
  const pctRec = total > 0 ? Math.round((recSi / total) * 100) : 0;
  const tratPositivos = cachedEncuestas.filter(
    (i) => i.tratamiento_resultado === "excelente" || i.tratamiento_resultado === "bien"
  ).length;
  const pctTrat = total > 0 ? Math.round((tratPositivos / total) * 100) : 0;

  if (kpiAvgEl) kpiAvgEl.textContent = total > 0 ? `${avg} / 5 ★` : "—";
  if (kpiAvgSubEl) {
    kpiAvgSubEl.textContent =
      total === 0
        ? "Sin respuestas registradas aún"
        : `Promedio sobre ${total} encuesta${total === 1 ? "" : "s"} anónima${total === 1 ? "" : "s"}`;
  }

  if (kpiRecEl) kpiRecEl.textContent = total > 0 ? `${pctRec}% Sí` : "—";
  if (kpiRecSubEl) {
    kpiRecSubEl.textContent =
      total === 0
        ? "Sin datos de recomendación"
        : `Sí: ${recSi} · Tal vez: ${recTalVez} · No: ${recNo}`;
  }

  if (kpiTratEl) kpiTratEl.textContent = total > 0 ? `${pctTrat}% Evolución positiva` : "—";
  if (kpiTratSubEl) {
    kpiTratSubEl.textContent =
      total === 0
        ? "Sin datos de evolución clínica"
        : `${tratPositivos} de ${total} notan gran mejoría o avances progresivos`;
  }

  if (countPillEl) {
    countPillEl.textContent = `${total} respuesta${total === 1 ? "" : "s"}`;
  }

  if (!tbody) return;

  const filtered = cachedEncuestas.filter((item) => {
    if (currentFilter === "comentarios") {
      return Boolean(item.comentarios && String(item.comentarios).trim() !== "");
    }
    if (currentFilter === "positivas") {
      return Number(item.experiencia) >= 4;
    }
    if (currentFilter === "mejorar") {
      return Number(item.experiencia) <= 3 || item.recomendaria !== "si";
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:32px 16px;">
      ${
        total === 0
          ? "Todavía no se recibieron encuestas de satisfacción. Podés compartir el enlace /encuesta.html con tus pacientes."
          : "No hay encuestas que coincidan con el filtro seleccionado."
      }
    </td></tr>`;
    return;
  }

  const isColaborador = getSessionUser()?.role === "colaborador";

  tbody.replaceChildren(
    ...filtered.map((item) => {
      const tr = document.createElement("tr");

      // 1. Fecha
      const tdFecha = document.createElement("td");
      const dateStr = item.created_at ? formatDate(String(item.created_at).slice(0, 10)) : "—";
      const langBadge = item.lang && item.lang !== "es" ? ` · ${String(item.lang).toUpperCase()}` : "";
      tdFecha.innerHTML = `<div style="font-weight:500;">${escapeHtml(dateStr)}</div><div style="font-size:12px;color:var(--muted);">Anónima${escapeHtml(langBadge)}</div>`;

      // 2. Experiencia (1-5)
      const tdExp = document.createElement("td");
      tdExp.innerHTML = renderStarsBadge(item.experiencia);

      // 3. Resultado del tratamiento
      const tdTrat = document.createElement("td");
      const tratText =
        TRATAMIENTO_LABELS[item.tratamiento_resultado] ||
        item.tratamiento_label ||
        item.tratamiento_resultado ||
        "—";
      tdTrat.innerHTML = `<strong>${escapeHtml(tratText)}</strong>`;

      // 4. ¿Nos recomendaría?
      const tdRec = document.createElement("td");
      tdRec.innerHTML = renderRecBadge(item.recomendaria);

      // 5. Comentarios para mejorar
      const tdCom = document.createElement("td");
      const com = String(item.comentarios || "").trim();
      tdCom.innerHTML = com
        ? `<div style="max-width:420px;white-space:pre-wrap;line-height:1.45;color:var(--navy);">${escapeHtml(com)}</div>`
        : '<span style="color:var(--muted);font-style:italic;">Sin comentarios</span>';

      // 6. Acciones
      const tdActions = document.createElement("td");
      tdActions.className = "prof-actions-td";
      if (!isColaborador) {
        const cell = document.createElement("div");
        cell.className = "prof-actions-cell";
        const btnDelete = document.createElement("button");
        btnDelete.type = "button";
        btnDelete.className = "btn ghost btn-prof-toggle btn-gasto-delete btn-sm";
        btnDelete.textContent = "Eliminar";
        btnDelete.addEventListener("click", () => handleDeleteEncuesta(item));
        cell.appendChild(btnDelete);
        tdActions.appendChild(cell);
      }

      tr.append(tdFecha, tdExp, tdTrat, tdRec, tdCom, tdActions);
      return tr;
    })
  );
}

async function handleDeleteEncuesta(item) {
  const ok = await dialogConfirm("¿Seguro que querés eliminar esta respuesta de encuesta?");
  if (!ok) return;

  try {
    await api("encuestas.php", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: item.id }),
    });
    await loadEncuestasData();
  } catch (err) {
    dialogAlert("No se pudo eliminar la encuesta: " + (err.message || "Error desconocido"));
  }
}

let encuestasLoading = false;

export async function loadEncuestasData() {
  if (encuestasLoading) return;
  encuestasLoading = true;
  const tbody = document.getElementById("encuestas-tbody");
  if (tbody && (!cachedEncuestas || !cachedEncuestas.length)) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando respuestas de encuestas…</span></td></tr>`;
  }
  const filterRoot = document.querySelector("#view-encuestas .admin-errores-filters");
  setListControlsEnabled(filterRoot, false);
  try {
    const data = await api("encuestas.php");
    if (data && Array.isArray(data.encuestas)) {
      cachedEncuestas = data.encuestas;
    }
  } catch (_) {
    // Modo offline o sin red
  } finally {
    encuestasLoading = false;
    setListControlsEnabled(filterRoot, true);
  }
  renderEncuestas();
}

export function setEncuestasFilter(filter) {
  if (encuestasLoading) return;
  currentFilter = filter;
  document.querySelectorAll(".encuestas-filter-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === filter);
  });
  renderEncuestas();
}

export function initEncuestasModule() {
  const btnRefresh = document.getElementById("btn-refresh-encuestas");
  btnRefresh?.addEventListener("click", () => loadEncuestasData());

  const btnCopyLink = document.getElementById("btn-copy-encuesta-link");
  btnCopyLink?.addEventListener("click", async () => {
    const url = "https://www.kinesica.com.ar/encuesta.html";
    try {
      await navigator.clipboard.writeText(url);
      const orig = btnCopyLink.textContent;
      btnCopyLink.textContent = "✓ Enlace copiado";
      setTimeout(() => {
        btnCopyLink.textContent = orig;
      }, 2000);
    } catch (_) {
      dialogAlert("Enlace público de la encuesta: " + url);
    }
  });

  document.querySelectorAll(".encuestas-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => setEncuestasFilter(btn.dataset.filter || "todas"));
  });
}
