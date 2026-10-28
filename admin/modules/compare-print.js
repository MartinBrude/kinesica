/**
 * Kinésica Admin - Generación de Informe Impreso Comparativo A4
 * Renderiza el reporte comparativo para imprimir o exportar a PDF con KPIs, tabla diferencial y firmas.
 */

import { CLINICIAN_DETAILS } from "../ficha-rules.mjs?v=90";
import { formatDate } from "./api.js?v=77";
import { escapeHtml, node } from "./dom.js?v=78";

/**
 * Genera el documento impreso A4 para la comparativa de evolución.
 * @param {object} res Resultado de compareFichas
 * @param {object|null} [sessionUser=null]
 * @returns {HTMLElement} Elemento article.print-sheet
 */
export function buildComparePrintSheet(res, sessionUser = null) {
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
    titulo: "Kinesiólogo Fisiatra",
    matricula: "M.N. 11816",
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
 * @param {object|null} [sessionUser=null]
 */
export async function printCompare(res, sessionUser = null) {
  if (!res) return;
  const root = document.querySelector("#print-root");
  if (!root) return;
  root.replaceChildren();
  root.append(buildComparePrintSheet(res, sessionUser));
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
