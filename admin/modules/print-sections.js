/**
 * Kinésica Admin - Secciones Clínicas para Impresión (ATM, Músculos, Postural, Dolor, CDI)
 * Construye los bloques semánticos .pf-section para el reporte impreso A4.
 */

import {
  node,
  side,
  section,
  grid,
  prose,
  formatParts,
  add,
} from "./dom.js";

export const CDI_LABELS = {
  "I.a": "I.a) Dolor miofascial sin limitación de apertura",
  "I.b": "I.b) Dolor miofascial con limitación de apertura",
  "II.a": "II.a) Desplazamiento discal con recaptura",
  "II.b": "II.b) Desplazamiento discal sin recaptura con limitación de apertura",
  "II.c": "II.c) Desplazamiento discal sin recaptura sin limitación de apertura",
  "III.a": "III.a) Artralgia",
  "III.b": "III.b) Artrosis de la ATM",
  "III.c": "III.c) Osteoartritis de la ATM",
};

export function buildAtmSection(item) {
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

  const hasPostMediciones = Boolean(
    item.aperturaLibrePost ||
    item.aperturaDolorPost ||
    item.desviacionPost ||
    item.protrusionPost ||
    item.latIzqPost ||
    item.latDerPost
  );

  const atmFields = [
    [
      "Ruidos articulares",
      item.ruidos === "Sí"
        ? formatParts([
            item.ruidos,
            side(item.ruidosIzq, item.ruidosDer),
            fases && `en ${fases}`,
            tiposRuido && `(${tiposRuido})`,
          ])
        : (item.ruidos === "No" ? "No" : ""),
    ],
    [
      "Dolor condilar",
      item.dolorCondilar === "Sí"
        ? formatParts([item.dolorCondilar, side(item.condilarIzq, item.condilarDer)])
        : (item.dolorCondilar === "No" ? "No" : ""),
    ],
    [hasPostMediciones ? "Apertura libre (antes)" : "Apertura libre de dolor", item.aperturaLibre ? `${item.aperturaLibre} mm` : ""],
    [hasPostMediciones ? "Apertura con dolor (antes)" : "Apertura con dolor", item.aperturaDolor ? `${item.aperturaDolor} mm` : ""],
    [
      hasPostMediciones ? "Desviación (antes)" : "Desviación de trayectoria",
      item.desviacion === "Sí"
        ? formatParts([
            item.desviacion,
            side(item.desvIzq, item.desvDer),
            patronDesv && `(${patronDesv})`,
          ])
        : (item.desviacion === "No" ? "No" : ""),
    ],
    [hasPostMediciones ? "Protrusión (antes)" : "Protrusión", item.protrusion ? `${item.protrusion} mm` : ""],
    [
      hasPostMediciones ? "Lateralidades (antes)" : "Lateralidades",
      formatParts([
        item.latIzq ? `Izq ${item.latIzq} mm` : "",
        item.latDer ? `Der ${item.latDer} mm` : "",
      ]),
    ],
  ];

  if (hasPostMediciones) {
    const patronDesvPost = [item.desvCorregidaPost ? "corregida en S" : "", item.deflexionPost ? "deflexión" : ""]
      .filter(Boolean)
      .join(" · ");

    atmFields.push(
      ["Apertura libre (al finalizar)", item.aperturaLibrePost ? `${item.aperturaLibrePost} mm` : ""],
      ["Apertura dolor (al finalizar)", item.aperturaDolorPost ? `${item.aperturaDolorPost} mm` : ""],
      [
        "Desviación (al finalizar)",
        item.desviacionPost === "Sí"
          ? formatParts([
              item.desviacionPost,
              side(item.desvIzqPost, item.desvDerPost),
              patronDesvPost && `(${patronDesvPost})`,
            ])
          : (item.desviacionPost === "No" ? "No" : ""),
      ],
      ["Protrusión (al finalizar)", item.protrusionPost ? `${item.protrusionPost} mm` : ""],
      [
        "Lateralidades (al finalizar)",
        formatParts([
          item.latIzqPost ? `Izq ${item.latIzqPost} mm` : "",
          item.latDerPost ? `Der ${item.latDerPost} mm` : "",
        ]),
      ]
    );
  }

  add(atm, grid(atmFields));
  return atm;
}

export function buildMusclesSection(item) {
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
  return mus;
}

export function buildCervicalSection(item) {
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
  return cerv;
  // /FEATURE-OPTIONAL: correlacion-cervical
}

export function buildPainSection(item) {
  const pain = section("Dolor y oclusión");
  const evaNum = Number(item.eva);
  const hasEva = Number.isFinite(evaNum) && evaNum > 0;
  const painGrid = grid([
    ["Zona", item.zona],
    ["Características", item.caracteristicas],
    ["Contacto dentario", item.contacto],
    ["Estabilidad oclusal", item.estabilidad],
    ["Clasificación de Angle", item.angle],
    ["Configuración esqueletal", item.esqueletal],
  ]);
  const painProse = prose("Factores que modifican el dolor", item.factores);

  if (hasEva || painGrid || painProse) {
    const eva = Math.max(0, Math.min(10, Math.round(evaNum || 0)));
    const evaBox = node("div", "pf-eva");
    evaBox.append(node("span", "pf-k", "Valoración EVA"));
    const track = node("div", "pf-eva-track");
    const fill = node("div", "pf-eva-fill");
    fill.style.width = `${eva * 10}%`;
    const evaLevel = eva === 0 ? "zero" : (eva <= 3 ? "mild" : (eva <= 6 ? "moderate" : "severe"));
    const evaLabel = eva === 0 ? "Sin dolor" : (eva <= 3 ? "Dolor leve" : (eva <= 6 ? "Dolor moderado" : "Dolor severo"));
    fill.classList.add(`pf-eva-${evaLevel}`);
    track.append(fill);
    const scoreBox = node("div", "pf-eva-score");
    scoreBox.append(
      node("strong", "", `${eva} / 10`),
      node("span", "pf-eva-tag", evaLabel)
    );
    evaBox.append(track, scoreBox);
    pain.append(evaBox);
    add(pain, painGrid);
    add(pain, painProse);
  }
  return pain;
}

export function buildCdiSection(item) {
  const cdi = section("Criterios diagnósticos CDI-TTM");
  const selected = item.cdi || [];
  const obs = prose("Observaciones clínicas", item.observaciones);
  const plan = prose("Plan de tratamiento", item.plan);
  const notesSession = prose("Anotaciones de la sesión", item.anotaciones);

  const fotosList = Array.isArray(item.fotosUrls) && item.fotosUrls.length > 0
    ? item.fotosUrls
    : (item.fotoUrl ? [item.fotoUrl] : []);

  if (selected.length > 0 || obs || plan || notesSession || fotosList.length > 0) {
    const chips = node("div", "pf-chips");
    if (selected.length) {
      for (const id of selected) chips.append(node("span", "pf-chip", CDI_LABELS[id] || id));
    } else {
      chips.append(node("span", "pf-empty", "Sin criterios marcados"));
    }
    cdi.append(chips);
    const notes = node("div", "pf-notes");
    if (obs) notes.append(obs);
    if (plan) notes.append(plan);
    if (notes.childElementCount) cdi.append(notes);
    if (notesSession) cdi.append(notesSession);
    if (fotosList.length > 0) {
      const safeFotoPattern = /^(\/admin\/)?api\/foto\.php\?file=[a-f0-9]{32,64}\.(jpe?g|png|webp)$/i;
      const validFotos = fotosList.filter((f) => safeFotoPattern.test(String(f).trim()));
      if (validFotos.length > 0) {
        const fotoWrap = node("div", "pf-foto-box");
        fotoWrap.append(node("span", "pf-subhead", validFotos.length === 1 ? "Foto clínica adjunta" : `Fotos clínicas adjuntas (${validFotos.length})`));
        const gridEl = node("div", "pf-attached-photos-grid");
        for (const fUrl of validFotos) {
          const img = document.createElement("img");
          img.className = "pf-attached-photo";
          img.src = fUrl;
          img.alt = "Foto clínica de la sesión";
          gridEl.append(img);
        }
        fotoWrap.append(gridEl);
        cdi.append(fotoWrap);
      }
    }
  }
  return cdi;
}
