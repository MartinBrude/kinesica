/**
 * Kinésica Admin - Motor de Comparación Clínica Sesión a Sesión
 * Analiza la evolución de un paciente entre dos sesiones (Sesión X vs. Y):
 * - KPIs (EVA, apertura libre/dolor, ruidos)
 * - Transiciones por sección (Filiación, ATM, Músculos, Oclusión, CDI)
 * - Identificación de tendencias (mejora, empeoramiento, igual)
 */

import { coerceFicha } from "./ficha-rules.mjs";

export function sideText(left, right) {
  if (left && right) return "Bilateral";
  if (left) return "Izquierdo";
  if (right) return "Derecho";
  return "Sin afectación";
}

export function formatSide(left, right) {
  const isLeft = Boolean(left && left !== "No" && left !== "0" && left !== "false");
  const isRight = Boolean(right && right !== "No" && right !== "0" && right !== "false");
  if (isLeft && isRight) return "Bilateral";
  if (isLeft) return "Izquierda";
  if (isRight) return "Derecha";
  return "";
}

export function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return null;
  const tA = new Date(String(dateA).slice(0, 10)).getTime();
  const tB = new Date(String(dateB).slice(0, 10)).getTime();
  if (Number.isNaN(tA) || Number.isNaN(tB)) return null;
  return Math.abs(Math.round((tB - tA) / (1000 * 60 * 60 * 24)));
}

function diffText(label, valA, valB) {
  const a = String(valA || "").trim();
  const b = String(valB || "").trim();
  const changed = a !== b;
  return {
    label,
    changed,
    current: b || "—",
    previous: a || "—",
    trend: "same",
    display: changed ? `${a || "—"} ➔ ${b || "—"}` : (b || "—"),
  };
}

function diffNumber(label, valA, valB, unit = "", lowerIsBetter = false) {
  const hasA = valA !== "" && valA != null && !Number.isNaN(Number(valA));
  const hasB = valB !== "" && valB != null && !Number.isNaN(Number(valB));
  const numA = hasA ? Number(valA) : null;
  const numB = hasB ? Number(valB) : null;
  const changed = numA !== numB;
  let delta = null;
  let trend = "same";
  if (numA != null && numB != null) {
    const diff = numB - numA;
    if (diff !== 0) {
      delta = diff;
      const isPositive = diff > 0;
      trend = (isPositive && !lowerIsBetter) || (!isPositive && lowerIsBetter) ? "better" : "worse";
    }
  }
  const deltaText = delta != null ? (delta > 0 ? `+${delta}` : `${delta}`) + (unit ? ` ${unit}` : "") : "";
  const curStr = numB != null ? `${numB}${unit ? ` ${unit}` : ""}` : "—";
  const prevStr = numA != null ? `${numA}${unit ? ` ${unit}` : ""}` : "—";
  return {
    label,
    changed,
    current: curStr,
    previous: prevStr,
    delta,
    deltaText,
    unit,
    trend,
    display: changed && numA != null && numB != null ? `${prevStr} ➔ ${curStr}` : curStr,
  };
}

function diffSide(label, aLeft, aRight, bLeft, bRight) {
  const strA = sideText(aLeft, aRight);
  const strB = sideText(bLeft, bRight);
  const changed = strA !== strB;
  let trend = "same";
  if (changed) {
    if (strB === "Sin afectación") trend = "better";
    else if (strA === "Sin afectación") trend = "worse";
    else if (strA === "Bilateral" && strB !== "Bilateral") trend = "better";
    else if (strA !== "Bilateral" && strB === "Bilateral") trend = "worse";
  }
  return {
    label,
    changed,
    current: strB,
    previous: strA,
    trend,
    display: changed ? `${strA} ➔ ${strB}` : strB,
  };
}

export function compareFichas(sourceA, sourceB) {
  const a = coerceFicha(sourceA);
  const b = coerceFicha(sourceB);

  const days = daysBetween(a.fechaSesion, b.fechaSesion);

  const summarizeRuidos = (item) => {
    if (item.ruidos !== "Sí") return item.ruidos ? "No" : "Sin registrar";
    const parts = [
      sideText(item.ruidosIzq, item.ruidosDer),
      [item.faseApertura ? "apertura" : "", item.faseCierre ? "cierre" : ""].filter(Boolean).join(" y "),
      [item.ruidoClic ? "clic" : "", item.ruidoCrep ? "crepitación" : ""].filter(Boolean).join(" y "),
    ].filter((p) => p && p !== "Sin afectación");
    return parts.length ? `Sí (${parts.join(" · ")})` : "Sí";
  };
  const ruidosA = summarizeRuidos(a);
  const ruidosB = summarizeRuidos(b);
  const ruidosDiff = {
    label: "Ruidos articulares",
    changed: ruidosA !== ruidosB,
    current: ruidosB,
    previous: ruidosA,
    trend: a.ruidos === "Sí" && b.ruidos === "No" ? "better" : (a.ruidos === "No" && b.ruidos === "Sí" ? "worse" : "same"),
    display: ruidosA !== ruidosB ? `${ruidosA} ➔ ${ruidosB}` : ruidosB,
  };

  const summarizeDesv = (item) => {
    if (item.desviacion !== "Sí") return item.desviacion ? "No" : "Sin registrar";
    const parts = [
      sideText(item.desvIzq, item.desvDer),
      [item.desvCorregida ? "corregida en S" : "", item.deflexion ? "deflexión" : ""].filter(Boolean).join(" · "),
    ].filter((p) => p && p !== "Sin afectación");
    return parts.length ? `Sí (${parts.join(" · ")})` : "Sí";
  };
  const desvA = summarizeDesv(a);
  const desvB = summarizeDesv(b);
  const desvDiff = {
    label: "Desviación lateral de trayectoria",
    changed: desvA !== desvB,
    current: desvB,
    previous: desvA,
    trend: a.desviacion === "Sí" && b.desviacion === "No" ? "better" : (a.desviacion === "No" && b.desviacion === "Sí" ? "worse" : "same"),
    display: desvA !== desvB ? `${desvA} ➔ ${desvB}` : desvB,
  };

  const listHabits = (item) => [
    item.habitoApretamiento ? "Apretamiento diurno" : "",
    item.habitoBruxismo ? "Bruxismo nocturno" : "",
    item.habitoMasticacionUni ? "Masticación unilateral" : "",
    item.habitoOnicofagia ? "Onicofagia / mordisqueo" : "",
  ].filter(Boolean);
  const habA = listHabits(a);
  const habB = listHabits(b);
  const habChanged = JSON.stringify(habA) !== JSON.stringify(habB);
  const habDiff = {
    label: "Hábitos parafuncionales y bruxismo",
    changed: habChanged,
    current: habB.length ? habB.join(", ") : "Sin hábitos registrados",
    previous: habA.length ? habA.join(", ") : "Sin hábitos registrados",
    trend: habB.length < habA.length ? "better" : (habB.length > habA.length ? "worse" : "same"),
    display: habChanged ? `${habA.join(", ") || "Ninguno"} ➔ ${habB.join(", ") || "Ninguno"}` : (habB.join(", ") || "Ninguno"),
  };

  const cdiA = (a.cdi || []).sort();
  const cdiB = (b.cdi || []).sort();
  const cdiChanged = JSON.stringify(cdiA) !== JSON.stringify(cdiB);
  const cdiDiff = {
    label: "Criterios diagnósticos CDI-TTM",
    changed: cdiChanged,
    current: cdiB.join(", ") || "Sin criterios marcados",
    previous: cdiA.join(", ") || "Sin criterios marcados",
    trend: cdiB.length < cdiA.length ? "better" : (cdiB.length > cdiA.length ? "worse" : "same"),
    display: cdiChanged ? `${cdiA.join(", ") || "Ninguno"} ➔ ${cdiB.join(", ") || "Ninguno"}` : (cdiB.join(", ") || "Ninguno"),
  };

  const evaDiff = diffNumber("Dolor (EVA)", a.eva, b.eva, "/ 10", true);
  const aperturaLibreDiff = diffNumber("Apertura libre de dolor", a.aperturaLibre, b.aperturaLibre, "mm", false);
  const aperturaDolorDiff = diffNumber("Apertura máxima con dolor", a.aperturaDolor, b.aperturaDolor, "mm", false);

  const desvPostA = a.desviacionPost === "Sí"
    ? `Sí (${[sideText(a.desvIzqPost, a.desvDerPost), [a.desvCorregidaPost ? "corregida en S" : "", a.deflexionPost ? "deflexión" : ""].filter(Boolean).join(" · ")].filter((p) => p && p !== "Sin afectación").join(" · ") || "Sí"})`
    : (a.desviacionPost ? "No" : "Sin registrar");
  const desvPostB = b.desviacionPost === "Sí"
    ? `Sí (${[sideText(b.desvIzqPost, b.desvDerPost), [b.desvCorregidaPost ? "corregida en S" : "", b.deflexionPost ? "deflexión" : ""].filter(Boolean).join(" · ")].filter((p) => p && p !== "Sin afectación").join(" · ") || "Sí"})`
    : (b.desviacionPost ? "No" : "Sin registrar");
  const desvPostDiff = {
    label: "Desviación lateral (al finalizar)",
    changed: desvPostA !== desvPostB,
    current: desvPostB,
    previous: desvPostA,
    trend: a.desviacionPost === "Sí" && b.desviacionPost === "No" ? "better" : (a.desviacionPost === "No" && b.desviacionPost === "Sí" ? "worse" : "same"),
    display: desvPostA !== desvPostB ? `${desvPostA} ➔ ${desvPostB}` : desvPostB,
  };

  const sections = [
    {
      id: "filiacion",
      title: "1. Filiación y Antecedentes",
      fields: [
        diffText("Motivo de consulta", a.motivo, b.motivo),
        habDiff,
        diffText("Antecedentes clínicos", a.antecedentes, b.antecedentes),
      ],
    },
    {
      id: "atm",
      title: "2. ATM: Ruidos, Dolor Condilar y Rangos",
      fields: [
        ruidosDiff,
        diffSide("Dolor condilar a la palpación", a.condilarIzq, a.condilarDer, b.condilarIzq, b.condilarDer),
        aperturaLibreDiff,
        aperturaDolorDiff,
        desvDiff,
        diffNumber("Protrusión mandibular", a.protrusion, b.protrusion, "mm", false),
        diffNumber("Lateralidad izquierda", a.latIzq, b.latIzq, "mm", false),
        diffNumber("Lateralidad derecha", a.latDer, b.latDer, "mm", false),
        diffNumber("Apertura libre (al finalizar)", a.aperturaLibrePost, b.aperturaLibrePost, "mm", false),
        diffNumber("Apertura dolor (al finalizar)", a.aperturaDolorPost, b.aperturaDolorPost, "mm", false),
        desvPostDiff,
        diffNumber("Protrusión (al finalizar)", a.protrusionPost, b.protrusionPost, "mm", false),
        diffNumber("Lateralidad izq (al finalizar)", a.latIzqPost, b.latIzqPost, "mm", false),
        diffNumber("Lateralidad der (al finalizar)", a.latDerPost, b.latDerPost, "mm", false),
      ],
    },
    {
      id: "musculos",
      title: "3. Músculos Craneales, Cervicales y Disco",
      fields: [
        diffSide("Músculo masetero", a.maseteroIzq, a.maseteroDer, b.maseteroIzq, b.maseteroDer),
        diffSide("Músculo temporal anterior", a.temporalIzq, a.temporalDer, b.temporalIzq, b.temporalDer),
        diffSide("Músculo pterigoideo medial", a.pterMedIzq, a.pterMedDer, b.pterMedIzq, b.pterMedDer),
        diffSide("Estructura pterigoideo lateral", a.pterLatIzq, a.pterLatDer, b.pterLatIzq, b.pterLatDer),
        diffSide("Desplazamiento con recaptura", a.discoConIzq, a.discoConDer, b.discoConIzq, b.discoConDer),
        diffSide("Desplazamiento sin recaptura", a.discoSinIzq, a.discoSinDer, b.discoSinIzq, b.discoSinDer),
        diffSide("Trapecio superior (cervical)", a.trapecioIzq, a.trapecioDer, b.trapecioIzq, b.trapecioDer),
        diffSide("Esternocleidomastoideo (ECOM)", a.ecomIzq, a.ecomDer, b.ecomIzq, b.ecomDer),
        diffSide("Musculatura suboccipital", a.suboccipitalIzq, a.suboccipitalDer, b.suboccipitalIzq, b.suboccipitalDer),
        diffText("Observaciones cervicales/postura", a.obsCervical, b.obsCervical),
      ],
    },
    {
      id: "dolor",
      title: "4. Dolor (EVA) y Relaciones Oclusales",
      fields: [
        evaDiff,
        diffText("Zona / localización del dolor", a.zona, b.zona),
        diffText("Características del dolor", a.caracteristicas, b.caracteristicas),
        diffText("Factores modificadores", a.factores, b.factores),
        diffText("Contacto dentario", a.contacto, b.contacto),
        diffText("Estabilidad oclusal", a.estabilidad, b.estabilidad),
        diffText("Clasificación de Angle", a.angle, b.angle),
        diffText("Configuración esqueletal", a.esqueletal, b.esqueletal),
      ],
    },
    {
      id: "cdi",
      title: "5. Diagnóstico CDI-TTM y Plan de Tratamiento",
      fields: [
        cdiDiff,
        diffText("Observaciones clínicas", a.observaciones, b.observaciones),
        diffText("Plan de tratamiento / recomendaciones", a.plan, b.plan),
      ],
    },
    {
      id: "anotaciones",
      title: "6. Anotaciones de la sesión",
      fields: [
        diffText("Anotaciones de la sesión", a.anotaciones, b.anotaciones),
        diffText("Foto clínica adjunta", a.fotoUrl ? "Con foto adjunta" : "Sin foto", b.fotoUrl ? "Con foto adjunta" : "Sin foto"),
      ],
    },
  ];

  const allFields = sections.flatMap((s) => s.fields);
  const totalChanged = allFields.filter((f) => f.changed).length;

  return {
    patient: {
      nombre: b.nombre || a.nombre,
      dni: b.dni || a.dni,
    },
    sessionX: {
      id: a.id,
      fechaSesion: a.fechaSesion,
      profesionalNombre: a.profesionalNombre,
      edad: a.edad,
    },
    sessionY: {
      id: b.id,
      fechaSesion: b.fechaSesion,
      profesionalNombre: b.profesionalNombre,
      edad: b.edad,
    },
    daysBetween: days,
    totalChanged,
    kpis: {
      eva: evaDiff,
      aperturaLibre: aperturaLibreDiff,
      aperturaDolor: aperturaDolorDiff,
      ruidos: ruidosDiff,
    },
    sections,
  };
}
