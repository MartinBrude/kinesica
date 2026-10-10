export const REQUIRED_FIELDS = [
  ["nombre", "el nombre completo"],
  ["dni", "el DNI"],
  ["fechaSesion", "la fecha de la sesión"],
  ["nacimiento", "la fecha de nacimiento"],
  ["edad", "la edad"],
  ["lugarNac", "el lugar de nacimiento"],
  ["motivo", "el motivo de consulta"],
  ["antecedentes", "los antecedentes clínicos"],
];

export const CLINICIANS = {
  norberto: "Norberto",
  maria: "María",
};

export const CLINICIAN_DETAILS = {
  norberto: {
    nombre: "Lic. Norberto Brude",
    titulo: "Kinesiólogo Fisiatra · Osteopatía",
    matricula: "M.N. 4930 · M.P. 518",
    signatureFile: "/admin/signatures/norberto.png",
  },
  maria: {
    nombre: "Lic. María Gulín",
    titulo: "Kinesióloga Fisiatra",
    matricula: "M.N. · M.P.",
    signatureFile: "/admin/signatures/maria.png",
  },
};

export function missingFieldKeys(data) {
  return REQUIRED_FIELDS
    .filter(([key]) => !String(data?.[key] ?? "").trim())
    .map(([key]) => key);
}

export function missingFields(data) {
  return REQUIRED_FIELDS
    .filter(([key]) => !String(data?.[key] ?? "").trim())
    .map(([, label]) => label);
}

export function normalizeDni(dni) {
  const digits = String(dni || "").replace(/\D/g, "");
  return digits.length >= 4 ? digits : String(dni || "").trim().toLowerCase();
}

export function stripAccents(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchFichaSearch(item, query) {
  const q = String(query || "").trim();
  if (!q) return true;

  const rawNombre = String(item?.nombre || "");
  const normNombre = stripAccents(rawNombre);
  const rawDni = String(item?.dni || "");
  const dniDigits = rawDni.replace(/\D/g, "");

  const normQ = stripAccents(q);
  // Coincidencia de texto continuo en nombre o DNI tal como se guardó
  if (normNombre.includes(normQ) || rawDni.toLowerCase().includes(normQ)) {
    return true;
  }

  // Búsqueda orientada a DNI: tolera puntos, espacios y guiones en el filtro o en el registro
  const qDigits = q.replace(/\D/g, "");
  if (/^[\d.\s-]+$/.test(q) && qDigits.length > 0) {
    return dniDigits.includes(qDigits);
  }

  // Búsqueda combinada por términos (ej: "Carolina 34.205" o "Méndez 34.205.109")
  const terms = q.split(/\s+/).filter(Boolean);
  return terms.every((term) => {
    const normTerm = stripAccents(term);
    if (normNombre.includes(normTerm)) return true;
    if (rawDni.toLowerCase().includes(normTerm)) return true;
    const termDigits = term.replace(/\D/g, "");
    if (termDigits.length > 0 && dniDigits.includes(termDigits)) {
      return true;
    }
    return false;
  });
}

export function patientKey(item) {
  const dni = normalizeDni(item?.dni);
  const nombre = String(item?.nombre || "").trim().toLowerCase();
  return `${nombre}|${dni}`;
}

export function ownsFicha(item, username) {
  return (item?.profesional || "") === username;
}

export function ageOn(nacimiento, onDate) {
  const birth = String(nacimiento || "").slice(0, 10).split("-").map(Number);
  const on = String(onDate || "").slice(0, 10).split("-").map(Number);
  if (birth.length !== 3 || on.length !== 3 || birth.some((n) => !n) || on.some((n) => !n)) return "";
  let age = on[0] - birth[0];
  if (on[1] < birth[1] || (on[1] === birth[1] && on[2] < birth[2])) age -= 1;
  return age >= 0 ? String(age) : "";
}

const PATIENT_FIELDS = ["nombre", "dni", "nacimiento", "lugarNac"];

export function nextSession(item, fechaSesion) {
  const copy = emptyFicha();
  for (const key of PATIENT_FIELDS) copy[key] = item?.[key] || "";
  copy.fechaSesion = fechaSesion || "";
  copy.edad = ageOn(item?.nacimiento, fechaSesion);
  return copy;
}

export function assignProfesional(username, previous) {
  if (previous) return String(previous);
  if (username === "maria") return "maria";
  return "norberto";
}

export function emptyFicha() {
  return {
    nombre: "",
    dni: "",
    fechaSesion: "",
    nacimiento: "",
    edad: "",
    lugarNac: "",
    motivo: "",
    // FEATURE-OPTIONAL: habitos-bruxismo
    habitoApretamiento: false,
    habitoBruxismo: false,
    habitoMasticacionUni: false,
    habitoOnicofagia: false,
    // /FEATURE-OPTIONAL: habitos-bruxismo
    antecedentes: "",
    ruidos: "",
    ruidosIzq: false,
    ruidosDer: false,
    faseApertura: false,
    faseCierre: false,
    // FEATURE-OPTIONAL: tipo-ruido
    ruidoClic: false,
    ruidoCrep: false,
    // /FEATURE-OPTIONAL: tipo-ruido
    dolorCondilar: "",
    condilarIzq: false,
    condilarDer: false,
    aperturaLibre: "",
    aperturaDolor: "",
    desviacion: "",
    desvIzq: false,
    desvDer: false,
    // FEATURE-OPTIONAL: patron-desviacion
    desvCorregida: false,
    deflexion: false,
    // /FEATURE-OPTIONAL: patron-desviacion
    protrusion: "",
    latIzq: "",
    latDer: "",
    maseteroIzq: false,
    maseteroDer: false,
    temporalIzq: false,
    temporalDer: false,
    pterMedIzq: false,
    pterMedDer: false,
    pterLatIzq: false,
    pterLatDer: false,
    discoConIzq: false,
    discoConDer: false,
    discoSinIzq: false,
    discoSinDer: false,
    // FEATURE-OPTIONAL: correlacion-cervical
    trapecioIzq: false,
    trapecioDer: false,
    ecomIzq: false,
    ecomDer: false,
    suboccipitalIzq: false,
    suboccipitalDer: false,
    obsCervical: "",
    // /FEATURE-OPTIONAL: correlacion-cervical
    eva: 0,
    zona: "",
    caracteristicas: "",
    factores: "",
    contacto: "",
    estabilidad: "",
    angle: "",
    esqueletal: "",
    cdi: [],
    observaciones: "",
    plan: "",
  };
}

export function coerceFicha(input = {}) {
  const template = emptyFicha();
  const out = {};
  for (const [key, defaultVal] of Object.entries(template)) {
    const val = input?.[key];
    if (typeof defaultVal === "boolean") {
      out[key] = Boolean(val);
    } else if (typeof defaultVal === "number") {
      const num = Number(val);
      out[key] = Number.isFinite(num) ? num : defaultVal;
    } else if (Array.isArray(defaultVal)) {
      out[key] = Array.isArray(val) ? val.filter((x) => typeof x === "string") : [];
    } else {
      out[key] = val != null ? String(val).trim() : "";
    }
  }
  out.eva = Math.max(0, Math.min(10, Math.round(out.eva || 0)));
  if (input?.id) out.id = String(input.id);
  if (input?.savedAt) out.savedAt = String(input.savedAt);
  if (input?.profesional) out.profesional = String(input.profesional);
  if (input?.profesionalNombre) out.profesionalNombre = String(input.profesionalNombre);
  return out;
}

export function exampleFicha() {
  return {
    nombre: "Carolina Méndez",
    dni: "34.205.109",
    fechaSesion: "2026-10-10",
    nacimiento: "1992-03-14",
    edad: "34",
    lugarNac: "Córdoba",
    motivo: "No Traumático",
    // FEATURE-OPTIONAL: habitos-bruxismo
    habitoApretamiento: true,
    habitoBruxismo: true,
    habitoMasticacionUni: true,
    habitoOnicofagia: false,
    // /FEATURE-OPTIONAL: habitos-bruxismo
    antecedentes: "Dolor en la sien y delante del oído desde hace 8 meses, sin golpe ni cirugía. Apretamiento nocturno y masticación unilateral. Empeora con chicle y pan duro.",
    ruidos: "Sí",
    ruidosIzq: true,
    ruidosDer: false,
    faseApertura: true,
    faseCierre: false,
    // FEATURE-OPTIONAL: tipo-ruido
    ruidoClic: true,
    ruidoCrep: false,
    // /FEATURE-OPTIONAL: tipo-ruido
    dolorCondilar: "Sí",
    condilarIzq: false,
    condilarDer: true,
    aperturaLibre: "35",
    aperturaDolor: "46",
    desviacion: "Sí",
    desvIzq: true,
    desvDer: false,
    // FEATURE-OPTIONAL: patron-desviacion
    desvCorregida: true,
    deflexion: false,
    // /FEATURE-OPTIONAL: patron-desviacion
    protrusion: "8",
    latIzq: "10",
    latDer: "10",
    maseteroIzq: true,
    maseteroDer: true,
    temporalIzq: true,
    temporalDer: false,
    pterMedIzq: false,
    pterMedDer: true,
    pterLatIzq: true,
    pterLatDer: false,
    discoConIzq: true,
    discoConDer: false,
    discoSinIzq: false,
    discoSinDer: false,
    // FEATURE-OPTIONAL: correlacion-cervical
    trapecioIzq: true,
    trapecioDer: false,
    ecomIzq: true,
    ecomDer: false,
    suboccipitalIzq: true,
    suboccipitalDer: true,
    obsCervical: "Rectificación cervical con sobrecarga bilateral suboccipital.",
    // /FEATURE-OPTIONAL: correlacion-cervical
    eva: 6,
    zona: "Fosa temporal anterior e intraauricular",
    caracteristicas: "Sordo, opresivo, continuo, punzante",
    factores: "Aumenta al masticar chicles, pan duro. Disminuye al usar calor local o relajación muscular.",
    contacto: "Prematuro",
    estabilidad: "Irregular",
    angle: "Clase II",
    esqueletal: "Retrognata",
    cdi: ["I.a", "II.a"],
    observaciones: "Dolor miofascial con clic recíproco a la apertura del lado izquierdo. Sin limitación marcada de la apertura.",
    plan: "Terapia manual de masetero y temporal, ejercicios de control motor y pauta de no masticar chicle. Valorar férula y control en 4 semanas.",
  };
}

export function sideText(left, right) {
  if (left && right) return "Bilateral";
  if (left) return "Izquierdo";
  if (right) return "Derecho";
  return "Sin afectación";
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
