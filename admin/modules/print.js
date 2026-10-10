/**
 * Kinésica Admin - Motor de Impresión y Generación de PDF Clínico
 * Construye la hoja institucional A4 (.pf-sheet) con datos del paciente,
 * examen articular, rangos de apertura, correlación cervical y bloque de firma digital.
 */

import {
  CLINICIAN_DETAILS,
  patientKey,
} from "../ficha-rules.mjs?v=50";
import { formatDate } from "./api.js?v=50";
import {
  node,
  field,
  side,
  section,
  grid,
  prose,
  formatParts,
  add,
} from "./dom.js";

const CDI_LABELS = {
  "I.a": "I.a) Dolor miofascial sin limitación de apertura",
  "I.b": "I.b) Dolor miofascial con limitación de apertura",
  "II.a": "II.a) Desplazamiento discal con recaptura",
  "II.b": "II.b) Desplazamiento discal sin recaptura con limitación de apertura",
  "II.c": "II.c) Desplazamiento discal sin recaptura sin limitación de apertura",
  "III.a": "III.a) Artralgia",
  "III.b": "III.b) Artrosis de la ATM",
  "III.c": "III.c) Osteoartritis de la ATM",
};

/**
 * Genera el elemento DOM correspondiente a una hoja impresa individual A4.
 * @param {object} item Datos clínicos de la ficha
 * @param {object|null} [sessionUser=null] Profesional en sesión activa
 * @returns {HTMLElement} Elemento article.print-sheet
 */
export function buildSheet(item, sessionUser = null) {
  const sheet = node("article", "print-sheet");

  const head = node("header", "pf-head");
  const brand = node("div", "pf-brand");
  const logo = document.createElement("img");
  logo.src = document.querySelector(".brand img")?.currentSrc || "/admin/logo.png";
  logo.alt = "Kinésica";
  const titles = node("div", "pf-titles");
  titles.append(
    node("h1", "", "Ficha clínica de ATM"),
    node("p", "pf-sub", "Evaluación según criterios CDI-TTM")
  );
  brand.append(logo, titles);
  const session = node("div", "pf-session");
  session.append(
    node("span", "", "Fecha de sesión"),
    node("strong", "", formatDate(item.fechaSesion))
  );
  head.append(brand, session);

  const who = node("section", "pf-who");
  who.append(node("h2", "pf-name", item.nombre || "Sin nombre"));
  add(
    who,
    grid([
      ["Documento", item.dni],
      ["Edad", item.edad ? `${item.edad} años` : ""],
      ["Nacimiento", formatParts([formatDate(item.nacimiento), item.lugarNac])],
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

  const atm = section("Articulación temporomandibular");
  const fases = [item.faseApertura ? "apertura" : "", item.faseCierre ? "cierre" : ""]
    .filter(Boolean)
    .join(" y ");

  // FEATURE-OPTIONAL: tipo-ruido
  const tiposRuido = [item.ruidoClic ? "clic / chasquido" : "", item.ruidoCrep ? "crepitación" : ""]
    .filter(Boolean)
    .join(" y ");
  // /FEATURE-OPTIONAL: tipo-ruido

  // FEATURE-OPTIONAL: patron-desviacion
  const patronDesv = [item.desvCorregida ? "corregida en S" : "", item.deflexion ? "deflexión" : ""]
    .filter(Boolean)
    .join(" · ");
  // /FEATURE-OPTIONAL: patron-desviacion

  add(
    atm,
    grid([
      [
        "Ruidos articulares",
        item.ruidos === "Sí"
          ? formatParts([
              item.ruidos,
              side(item.ruidosIzq, item.ruidosDer),
              fases && `en ${fases}`,
              tiposRuido && `(${tiposRuido})`,
            ])
          : item.ruidos || "",
      ],
      [
        "Dolor condilar",
        item.dolorCondilar === "Sí"
          ? formatParts([item.dolorCondilar, side(item.condilarIzq, item.condilarDer)])
          : item.dolorCondilar || "",
      ],
      ["Apertura libre de dolor", item.aperturaLibre ? `${item.aperturaLibre} mm` : ""],
      ["Apertura con dolor", item.aperturaDolor ? `${item.aperturaDolor} mm` : ""],
      [
        "Desviación de trayectoria",
        item.desviacion === "Sí"
          ? formatParts([
              item.desviacion,
              side(item.desvIzq, item.desvDer),
              patronDesv && `(${patronDesv})`,
            ])
          : item.desviacion || "",
      ],
      ["Protrusión", item.protrusion ? `${item.protrusion} mm` : ""],
      [
        "Lateralidades",
        formatParts([
          item.latIzq ? `Izq ${item.latIzq} mm` : "",
          item.latDer ? `Der ${item.latDer} mm` : "",
        ]),
      ],
    ])
  );

  const mus = section("Músculos craneales y disco articular");
  add(
    mus,
    grid([
      ["Masetero", side(item.maseteroIzq, item.maseteroDer)],
      ["Temporal anterior", side(item.temporalIzq, item.temporalDer)],
      ["Pterigoideo medial", side(item.pterMedIzq, item.pterMedDer)],
      ["Pterigoideo lateral", side(item.pterLatIzq, item.pterLatDer)],
      ["Disco con recaptura", side(item.discoConIzq, item.discoConDer)],
      ["Disco sin recaptura", side(item.discoSinIzq, item.discoSinDer)],
    ])
  );

  // FEATURE-OPTIONAL: correlacion-cervical
  const cerv = section("Correlación cervical y postural");
  add(
    cerv,
    grid([
      ["Trapecio superior", side(item.trapecioIzq, item.trapecioDer)],
      ["ECOM", side(item.ecomIzq, item.ecomDer)],
      ["Suboccipitales", side(item.suboccipitalIzq, item.suboccipitalDer)],
    ])
  );
  add(cerv, prose("Observaciones cervicales / postura", item.obsCervical));
  // /FEATURE-OPTIONAL: correlacion-cervical

  const pain = section("Dolor y oclusión");
  const eva = Math.max(0, Math.min(10, Number(item.eva) || 0));
  const evaBox = node("div", "pf-eva");
  evaBox.append(node("span", "pf-k", "Valoración EVA"));
  const track = node("div", "pf-eva-track");
  const fill = node("div", "pf-eva-fill");
  fill.style.width = `${eva * 10}%`;
  track.append(fill);
  const score = node("strong", "", `${eva} / 10`);
  evaBox.append(track, score);
  pain.append(evaBox);
  add(
    pain,
    grid([
      ["Zona", item.zona],
      ["Características", item.caracteristicas],
      ["Contacto dentario", item.contacto],
      ["Estabilidad oclusal", item.estabilidad],
      ["Clasificación de Angle", item.angle],
      ["Configuración esqueletal", item.esqueletal],
    ])
  );
  add(pain, prose("Factores que modifican el dolor", item.factores));

  const cdi = section("Criterios diagnósticos CDI-TTM");
  const chips = node("div", "pf-chips");
  const selected = item.cdi || [];
  if (!selected.length) chips.append(node("span", "pf-empty", "Sin criterios marcados"));
  for (const id of selected) chips.append(node("span", "pf-chip", CDI_LABELS[id] || id));
  cdi.append(chips);
  const notes = node("div", "pf-notes");
  const obs = prose("Observaciones clínicas", item.observaciones);
  const plan = prose("Plan de tratamiento", item.plan);
  if (obs) notes.append(obs);
  if (plan) notes.append(plan);
  if (notes.childElementCount) cdi.append(notes);

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
    for (const item of group) root.append(buildSheet(item, sessionUser));
  }

  const previousTitle = document.title;
  const names = [...new Set(items.map((item) => (item.nombre || "Paciente").trim()))];
  const dates = items.map((item) => formatDate(item.fechaSesion)).filter((date) => date !== "Sin fecha");
  const who = names.length === 1 ? names[0] : "Fichas ATM";
  const when = dates.length
    ? (dates.length === 1
        ? dates[0].replaceAll("/", "-")
        : `${dates[0].replaceAll("/", "-")} a ${dates[dates.length - 1].replaceAll("/", "-")}`)
    : "";

  document.title = [who, when].filter(Boolean).join(" ");

  // Esperar decodificación de sellos e imágenes para evitar impresiones en blanco
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
