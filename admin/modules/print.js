/**
 * Kinésica Admin - Motor de Impresión y Generación de PDF Clínico
 * Construye la hoja institucional A4 (.pf-sheet) con datos del paciente,
 * examen articular, rangos de apertura, correlación cervical y bloque de firma digital.
 */

import {
  CLINICIAN_DETAILS,
  patientKey,
  ageOn,
  formatSessionBadgeText,
  shouldOmitInvariableFields,
} from "../ficha-rules.mjs?v=90";
import { formatDate } from "./api.js?v=77";
import {
  node,
  grid,
  prose,
  formatParts,
  add,
} from "./dom.js";
import {
  CDI_LABELS,
  buildAtmSection,
  buildMusclesSection,
  buildCervicalSection,
  buildPainSection,
  buildCdiSection,
} from "./print-sections.js";

export { CDI_LABELS };

/**
 * Genera el elemento DOM correspondiente a una hoja impresa individual A4.
 * @param {object} item Datos clínicos de la ficha
 * @param {object|null} [sessionUser=null] Profesional en sesión activa
 * @param {object} [meta={}] Metadatos contextuales (sessionIndex, totalSessions, initialMotivo)
 * @returns {HTMLElement} Elemento article.print-sheet
 */
export function buildSheet(item, sessionUser = null, meta = {}) {
  const sheet = node("article", "print-sheet");
  const sIdx = meta.sessionIndex || 1;
  const sTotal = meta.totalSessions || 1;
  const isFollowUp = shouldOmitInvariableFields(sIdx, sTotal);

  if (isFollowUp) {
    sheet.classList.add("pf-sheet-followup");
  }

  const head = node("header", isFollowUp ? "pf-head pf-head-followup" : "pf-head");
  const brand = node("div", "pf-brand");
  const logo = document.createElement("img");
  logo.src = document.querySelector(".brand img")?.currentSrc || "/admin/logo.png";
  logo.alt = "Kinésica";
  const titles = node("div", "pf-titles");
  titles.append(
    node("h1", "", isFollowUp ? "Ficha clínica de ATM · Evolución" : "Ficha clínica de ATM"),
    node("p", "pf-sub", "Evaluación según criterios CDI-TTM")
  );
  brand.append(logo, titles);

  const session = node("div", "pf-session");
  const sessionBadgeText = formatSessionBadgeText(sIdx, sTotal);
  session.append(
    node("span", "pf-session-badge", sessionBadgeText),
    node("span", "pf-session-label", "Fecha de sesión"),
    node("strong", "pf-session-date", formatDate(item.fechaSesion))
  );
  head.append(brand, session);

  let who;
  if (!isFollowUp) {
    who = node("section", "pf-who");
    who.append(node("h2", "pf-name", item.nombre || "Sin nombre"));
    const computedAge = item.edad || ageOn(item.nacimiento, item.fechaSesion);
    add(
      who,
      grid([
        ["Documento", item.dni],
        ["Edad", computedAge ? `${computedAge} años` : ""],
        ["Nacimiento", formatParts([item.nacimiento ? formatDate(item.nacimiento) : "", item.lugarNac])],
        ["Motivo de consulta", item.motivo],
      ])
    );

    // FEATURE-OPTIONAL: habitos-bruxismo
    const habitosList = formatParts(
      [
        item.habitoApretamiento ? "Apretamiento diurno" : "",
        item.habitoBruxismo ? "Bruxismo nocturno" : "",
        item.habitoMasticacionUni ? "Masticación unilateral" : "",
        item.habitoOnicofagia ? "Onicofagia / mordisqueo" : "",
      ],
      ", "
    );
    if (habitosList) add(who, grid([["Hábitos / bruxismo", habitosList]]));
    // /FEATURE-OPTIONAL: habitos-bruxismo

    add(who, prose("Antecedentes clínicos", item.antecedentes));
  } else {
    who = node("section", "pf-who pf-who-followup");
    const followupBar = node("div", "pf-followup-bar");
    const patientIdentity = node("div", "pf-followup-identity");
    patientIdentity.append(
      node("span", "pf-k", "Paciente"),
      node("h2", "pf-name pf-name-compact", item.nombre || "Sin nombre"),
      node("span", "pf-followup-doc", `DNI ${item.dni || "—"}`)
    );
    followupBar.append(patientIdentity);

    const initialMotivo = (meta.initialMotivo || "").trim();
    const currentMotivo = (item.motivo || "").trim();
    const hasSpecificEvolution = currentMotivo && currentMotivo !== initialMotivo;

    if (hasSpecificEvolution) {
      followupBar.append(node("span", "pf-followup-note", "Antecedentes e historia basal en Sesión N° 1"));
      who.append(followupBar);
      const evoBox = node("div", "pf-followup-evo");
      evoBox.append(
        node("span", "pf-k", "Evolución clínica / Motivo de consulta"),
        node("p", "", currentMotivo)
      );
      who.append(evoBox);
    } else {
      followupBar.append(node("span", "pf-followup-note", "Datos filiatorios y antecedentes registrados en Sesión N° 1"));
      who.append(followupBar);
    }
  }

  const atm = buildAtmSection(item);
  const mus = buildMusclesSection(item);
  const cerv = buildCervicalSection(item);
  const pain = buildPainSection(item);
  const cdi = buildCdiSection(item);

  const profKey = item.profesional || (sessionUser?.username === "maria" ? "maria" : "norberto");
  const details = CLINICIAN_DETAILS[profKey] || {
    nombre: item.profesionalNombre || "Profesional actuante",
    titulo: "Kinesiólogo/a Fisiatra",
    matricula: "",
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
    node("span", "", "Documento clínico confidencial · Kinésica"),
    node("span", "", "Charcas 3889, Palermo, CABA · +54 (11) 6156-4311")
  );

  sheet.append(head, who);
  for (const block of [atm, mus, cerv, pain, cdi]) {
    if (block.querySelector(".pf-grid, .pf-prose, .pf-eva, .pf-chip, .pf-empty")) {
      sheet.append(block);
    }
  }
  sheet.append(sigBox, foot);
  return sheet;
}

/**
 * Prepara el contenedor de impresión e invoca el diálogo de impresión del navegador.
 * @param {Array<object>} items Lista de fichas a imprimir
 * @param {object|null} [sessionUser=null]
 */
export async function printItems(items, sessionUser = null) {
  const root = document.querySelector("#print-root");
  if (!root || !items.length) return;
  root.replaceChildren();

  const groups = new Map();
  for (const item of items) {
    const key = patientKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => (a.fechaSesion || "").localeCompare(b.fechaSesion || ""));
    const initialMotivo = (group[0]?.motivo || "").trim();
    group.forEach((item, idx) => {
      root.append(
        buildSheet(item, sessionUser, {
          sessionIndex: idx + 1,
          totalSessions: group.length,
          initialMotivo,
        })
      );
    });
  }

  const previousTitle = document.title;
  const names = [...new Set(items.map((item) => (item.nombre || "Paciente").trim()))];
  const dates = items
    .map((item) => formatDate(item.fechaSesion))
    .filter((date) => Boolean(date) && date !== "—" && date !== "Sin fecha");
  const who = names.length === 1 ? names[0] : "Fichas ATM";
  const when = dates.length
    ? (dates.length === 1
        ? dates[0].replaceAll("/", "-")
        : `${dates[0].replaceAll("/", "-")} a ${dates[dates.length - 1].replaceAll("/", "-")}`)
    : "";

  const isFullHistory = groups.size === 1 && items.length > 1;
  document.title = [who, when, isFullHistory ? "Historial Completo" : ""].filter(Boolean).join(" - ");

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
