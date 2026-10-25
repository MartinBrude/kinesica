export const REQUIRED_FIELDS = [
  ["nombre", "el nombre completo"],
  ["dni", "el DNI / Pasaporte"],
  ["fechaSesion", "la fecha de la sesión"],
  ["nacimiento", "la fecha de nacimiento"],
  ["edad", "la edad"],
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
    titulo: "Kinesiólogo Fisiatra",
    matricula: "M.N. 11816",
    signatureFile: "/admin/signatures/norberto.png?v=2",
  },
  maria: {
    nombre: "Lic. María Gulin",
    titulo: "Kinesióloga Fisiatra",
    matricula: "M.N. 15322 · M.P. 3112",
    signatureFile: "/admin/signatures/maria.png?v=2",
  },
};

export function missingFieldKeys(data) {
  return REQUIRED_FIELDS
    .filter(([key]) => {
      if (key === "dni" && data?.sinDocumento) return false;
      return !String(data?.[key] ?? "").trim();
    })
    .map(([key]) => key);
}

export function missingFields(data) {
  return REQUIRED_FIELDS
    .filter(([key]) => {
      if (key === "dni" && data?.sinDocumento) return false;
      return !String(data?.[key] ?? "").trim();
    })
    .map(([, label]) => label);
}

/**
 * Valida tipos y rangos de un campo individual según las reglas clínicas de Kinésica.
 * @param {string} key Nombre del campo
 * @param {*} value Valor a verificar
 * @param {object} [allData={}] Contexto completo de la ficha para correlaciones
 * @returns {string|null} Mensaje de error o null si es válido
 */
export function validateField(key, value, allData = {}) {
  const str = String(value ?? "").trim();

  switch (key) {
    case "edad": {
      if (!str) return "Falta completar la edad";
      if (!/^\d+$/.test(str)) {
        return "La edad no permite texto: debe ser un número entero entre 1 y 120";
      }
      const n = Number(str);
      if (!Number.isInteger(n) || n < 1 || n > 120) {
        return "La edad debe ser un número entero entre 1 y 120";
      }
      return null;
    }
    case "nombre": {
      if (!str) return "Falta completar el nombre completo";
      if (/\d/.test(str)) return "El nombre no puede contener números";
      if (str.length < 2) return "El nombre completo debe tener al menos 2 letras";
      return null;
    }
    case "dni": {
      if (allData?.sinDocumento) return null;
      if (!str) return "Falta completar el DNI / Pasaporte";
      const alphanum = str.replace(/[^a-zA-Z0-9]/g, "");
      if (alphanum.length < 3) return "El DNI / Pasaporte debe tener al menos 3 caracteres";
      return null;
    }
    case "fechaSesion": {
      if (!str) return "Falta completar la fecha de la sesión";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return "La fecha de la sesión debe ser válida (AAAA-MM-DD)";
      return null;
    }
    case "nacimiento": {
      if (!str) return "Falta completar la fecha de nacimiento";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return "La fecha de nacimiento debe ser válida (AAAA-MM-DD)";
      const session = String(allData.fechaSesion || "").slice(0, 10);
      if (session && /^\d{4}-\d{2}-\d{2}$/.test(session) && str > session) {
        return "La fecha de nacimiento no puede ser posterior a la fecha de la sesión";
      }
      return null;
    }
    case "lugarNac":
    case "anotaciones":
    case "fotoUrl":
    case "fotosUrls": {
      return null;
    }
    case "motivo": {
      if (!str) return "Falta seleccionar el motivo de consulta";
      return null;
    }
    case "antecedentes": {
      if (!str) return "Falta completar los antecedentes clínicos";
      return null;
    }
    case "aperturaLibre":
    case "aperturaDolor":
    case "aperturaLibrePost":
    case "aperturaDolorPost": {
      if (!str) return null;
      const clean = str.replace(",", ".");
      if (/[a-zA-Z]/.test(clean) || !/^\d+(\.\d+)?$/.test(clean)) {
        return "Este campo no permite texto: debe ser un número en milímetros";
      }
      const n = Number(clean);
      if (Number.isNaN(n) || n < 0 || n > 500) {
        return "El valor de apertura debe estar entre 0 y 500 mm";
      }
      return null;
    }
    case "protrusion":
    case "latIzq":
    case "latDer":
    case "protrusionPost":
    case "latIzqPost":
    case "latDerPost": {
      if (!str) return null;
      const clean = str.replace(",", ".");
      if (/[a-zA-Z]/.test(clean) || !/^\d+(\.\d+)?$/.test(clean)) {
        return "Este campo no permite texto: debe ser un número en milímetros";
      }
      const n = Number(clean);
      if (Number.isNaN(n) || n < 0 || n > 500) {
        return "El valor debe estar entre 0 y 500 mm";
      }
      return null;
    }
    case "ruidos":
    case "ruidosIzq":
    case "ruidosDer": {
      const isSi = str === "Sí" || allData.ruidos === "Sí";
      if (isSi && !allData.ruidosIzq && !allData.ruidosDer) {
        return "Debe indicar el lado (izquierdo y/o derecho) en los ruidos articulares";
      }
      return null;
    }
    case "dolorCondilar":
    case "condilarIzq":
    case "condilarDer": {
      const isSi = str === "Sí" || allData.dolorCondilar === "Sí";
      if (isSi && !allData.condilarIzq && !allData.condilarDer) {
        return "Debe indicar el lado (izquierdo y/o derecho) en el dolor condilar a la palpación";
      }
      return null;
    }
    case "desviacion":
    case "desvIzq":
    case "desvDer": {
      const isSi = str === "Sí" || allData.desviacion === "Sí";
      if (isSi && !allData.desvIzq && !allData.desvDer) {
        return "Debe indicar el lado (izquierdo y/o derecho) en la desviación lateral de la trayectoria";
      }
      return null;
    }
    case "desviacionPost":
    case "desvIzqPost":
    case "desvDerPost": {
      const isSi = str === "Sí" || allData.desviacionPost === "Sí";
      if (isSi && !allData.desvIzqPost && !allData.desvDerPost) {
        return "Debe indicar el lado (izquierdo y/o derecho) en la desviación lateral al finalizar la sesión";
      }
      return null;
    }
    case "eva": {
      if (value === "" || value === null || value === undefined) return null;
      const n = Number(value);
      if (Number.isNaN(n) || n < 0 || n > 10) return "La escala EVA debe ser un valor entre 0 y 10";
      return null;
    }
    default:
      return null;
  }
}

/**
 * Valida integralmente la ficha clínica y retorna mapa de errores y estado.
 * @param {object} data Datos de la ficha
 * @returns {{isValid: boolean, errors: Object<string, string>, errorList: string[], firstErrorKey: string|null, firstError: string|null}}
 */
export function validateFicha(data = {}) {
  data = data || {};
  const errors = {};
  const errorList = [];
  const fieldsToCheck = [
    "nombre",
    "dni",
    "fechaSesion",
    "nacimiento",
    "edad",
    "lugarNac",
    "motivo",
    "antecedentes",
    "ruidos",
    "dolorCondilar",
    "aperturaLibre",
    "aperturaDolor",
    "desviacion",
    "protrusion",
    "latIzq",
    "latDer",
    "aperturaLibrePost",
    "aperturaDolorPost",
    "desviacionPost",
    "protrusionPost",
    "latIzqPost",
    "latDerPost",
    "eva",
  ];

  for (const field of fieldsToCheck) {
    const err = validateField(field, data[field], data);
    if (err) {
      errors[field] = err;
      errorList.push(err);
    }
  }

  return {
    isValid: errorList.length === 0,
    errors,
    errorList,
    firstErrorKey: Object.keys(errors)[0] || null,
    firstError: errorList[0] || null,
  };
}

/**
 * Valida los campos correspondientes a un paso específico del formulario.
 * @param {number} stepNumber Número de paso (0 a 4)
 * @param {object} data Datos del formulario
 * @returns {{isValid: boolean, errors: Object<string, string>, errorList: string[], firstErrorKey: string|null, firstError: string|null}}
 */
export function validateStep(stepNumber, data = {}) {
  data = data || {};
  const stepFields = {
    0: ["nombre", "dni", "fechaSesion", "nacimiento", "edad", "motivo", "antecedentes"],
    1: [
      "ruidos",
      "dolorCondilar",
      "aperturaLibre",
      "aperturaDolor",
      "desviacion",
      "protrusion",
      "latIzq",
      "latDer",
      "aperturaLibrePost",
      "aperturaDolorPost",
      "desviacionPost",
      "protrusionPost",
      "latIzqPost",
      "latDerPost",
    ],
    2: [],
    3: ["eva"],
    4: [],
    5: ["anotaciones", "fotoUrl", "fotosUrls"],
  };
  const fields = stepFields[stepNumber] || [];
  const errors = {};
  const errorList = [];
  for (const f of fields) {
    const err = validateField(f, data[f], data);
    if (err) {
      errors[f] = err;
      errorList.push(err);
    }
  }
  return {
    isValid: errorList.length === 0,
    errors,
    errorList,
    firstErrorKey: Object.keys(errors)[0] || null,
    firstError: errorList[0] || null,
  };
}

export function normalizeDni(dni) {
  const digits = String(dni || "").replace(/\D/g, "");
  if (digits.length >= 4 && !/[a-zA-Z]/.test(String(dni || ""))) {
    return digits;
  }
  return String(dni || "").trim().toLowerCase();
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
  if (dni) return `doc:${dni}`;
  const nombre = String(item?.nombre || "").trim().toLowerCase();
  if (!nombre) return "";
  return `nombre:${nombre}`;
}

export function personNameKey(nombre) {
  return stripAccents(nombre).replace(/\s+/g, " ").trim();
}

/**
 * El documento ya está usado por otra persona si el nombre no coincide.
 * ownKey es la clave del paciente que se está editando: sus sesiones no cuentan.
 * @returns {object|null} Ficha existente en conflicto
 */
export function dniNameConflict(data, allFichas = [], ownKey = "") {
  const key = patientKey(data);
  if (!key.startsWith("doc:")) return null;
  const incoming = personNameKey(data?.nombre);
  if (!incoming) return null;
  const other = (allFichas || []).find((ficha) => {
    if (!ficha || ficha.id === data?.id) return false;
    if (ownKey && patientKey(ficha) === ownKey) return false;
    if (patientKey(ficha) !== key) return false;
    const name = personNameKey(ficha.nombre);
    return Boolean(name) && name !== incoming;
  });
  return other || null;
}

export function ownsFicha(item, username) {
  return (item?.profesional || "") === username;
}

function isRealDate([y, m, d]) {
  if (!y || !m || !d || m > 12 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function ageOn(nacimiento, onDate) {
  const birth = String(nacimiento || "").slice(0, 10).split("-").map(Number);
  const on = String(onDate || "").slice(0, 10).split("-").map(Number);
  if (birth.length !== 3 || on.length !== 3 || !isRealDate(birth) || !isRealDate(on)) return "";
  let age = on[0] - birth[0];
  if (on[1] < birth[1] || (on[1] === birth[1] && on[2] < birth[2])) age -= 1;
  return age >= 0 ? String(age) : "";
}

export const PATIENT_FIELDS = [
  "nombre",
  "dni",
  "nacimiento",
  "lugarNac",
  "motivo",
  "antecedentes",
  "habitoApretamiento",
  "habitoBruxismo",
  "habitoMasticacionUni",
  "habitoOnicofagia",
];

export function nextSession(item, fechaSesion) {
  const copy = emptyFicha();
  for (const key of PATIENT_FIELDS) copy[key] = item?.[key] ?? copy[key];
  copy.sinDocumento = Boolean(item?.sinDocumento);
  copy.fechaSesion = fechaSesion || "";
  copy.edad = ageOn(item?.nacimiento, fechaSesion);
  if (CLINICIANS[item?.profesional]) copy.profesional = item.profesional;
  return copy;
}

export function getUniquePatients(allFichas = []) {
  const map = new Map();
  for (const f of allFichas) {
    const key = patientKey(f);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        key,
        nombre: f.nombre || "Sin nombre",
        dni: f.dni || "",
        nacimiento: f.nacimiento || "",
        lugarNac: f.lugarNac || "",
        motivo: f.motivo || "",
        habitoApretamiento: Boolean(f.habitoApretamiento),
        habitoBruxismo: Boolean(f.habitoBruxismo),
        habitoMasticacionUni: Boolean(f.habitoMasticacionUni),
        habitoOnicofagia: Boolean(f.habitoOnicofagia),
        antecedentes: f.antecedentes || "",
        sessions: [f],
      });
    } else {
      const p = map.get(key);
      p.sessions.push(f);
      if (!p.nacimiento && f.nacimiento) p.nacimiento = f.nacimiento;
      if (!p.lugarNac && f.lugarNac) p.lugarNac = f.lugarNac;
      if (!p.motivo && f.motivo) p.motivo = f.motivo;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  );
}

export function getSessionIndex(item, allFichas = []) {
  if (!item) return 1;
  const key = patientKey(item);
  const pSessions = (allFichas || [])
    .filter((f) => patientKey(f) === key)
    .sort((a, b) => (a.fechaSesion || "").localeCompare(b.fechaSesion || ""));
  if (!pSessions.length) return 1;
  const idx = pSessions.findIndex((s) => s.id === item.id);
  if (idx >= 0) return idx + 1;
  return pSessions.length + 1;
}

export function formatSessionBadgeText(sessionIndex = 1, totalSessions = 1) {
  if (sessionIndex === 1 && totalSessions === 1) return "Evaluación inicial";
  return `Sesión N° ${sessionIndex}${totalSessions > 1 ? ` de ${totalSessions}` : ""}`;
}

export function shouldOmitInvariableFields(sessionIndex = 1, totalSessions = 1) {
  return totalSessions > 1 && sessionIndex > 1;
}

export function assignProfesional(username, previous, requested) {
  if (username === "martin" && requested && CLINICIANS[requested]) {
    return requested;
  }
  if (previous) return String(previous);
  if (username === "maria") return "maria";
  return "norberto";
}

export function emptyFicha() {
  return {
    nombre: "",
    dni: "",
    sinDocumento: false,
    fechaSesion: "",
    nacimiento: "",
    edad: "",
    lugarNac: "",
    anotaciones: "",
    fotoUrl: "",
    fotosUrls: [],
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
    aperturaLibrePost: "",
    aperturaDolorPost: "",
    desviacionPost: "",
    desvIzqPost: false,
    desvDerPost: false,
    // FEATURE-OPTIONAL: patron-desviacion
    desvCorregidaPost: false,
    deflexionPost: false,
    // /FEATURE-OPTIONAL: patron-desviacion
    protrusionPost: "",
    latIzqPost: "",
    latDerPost: "",
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

  // Sanitizar edad como entero entre 1 y 120 (sin texto)
  if (out.edad) {
    const cleanEdad = String(out.edad).replace(/\D/g, "");
    const edadNum = parseInt(cleanEdad, 10);
    out.edad = Number.isInteger(edadNum) && edadNum >= 1 && edadNum <= 120 ? String(edadNum) : "";
  }

  // Sanitizar mediciones de ATM: números no negativos en milímetros (sin texto)
  for (const mKey of [
    "aperturaLibre", "aperturaDolor", "protrusion", "latIzq", "latDer",
    "aperturaLibrePost", "aperturaDolorPost", "protrusionPost", "latIzqPost", "latDerPost",
  ]) {
    if (out[mKey]) {
      const cleanVal = String(out[mKey]).replace(",", ".").replace(/[^\d.]/g, "");
      const numVal = Number(cleanVal);
      out[mKey] = Number.isFinite(numVal) && numVal >= 0 ? cleanVal : "";
    }
  }

  if (input?.id) out.id = String(input.id);
  if (input?.savedAt) out.savedAt = String(input.savedAt);
  if (input?.profesional) out.profesional = String(input.profesional);
  if (input?.profesionalNombre) out.profesionalNombre = String(input.profesionalNombre);

  // Compatibilidad bidireccional fotoUrl <-> fotosUrls
  if (out.fotoUrl && out.fotosUrls.length === 0) {
    out.fotosUrls = [out.fotoUrl];
  } else if (!out.fotoUrl && out.fotosUrls.length > 0) {
    out.fotoUrl = out.fotosUrls[0];
  }

  return out;
}

export function exampleFicha() {
  return {
    nombre: "Carolina Méndez",
    dni: "34.205.109",
    sinDocumento: false,
    fechaSesion: "2026-10-10",
    nacimiento: "1992-03-14",
    edad: "34",
    lugarNac: "Córdoba",
    anotaciones: "Paciente refiere alivio tras terapia manual descompresiva. Mejoría en el rango de apertura.",
    fotoUrl: "/admin/api/foto.php?file=0123456789abcdef0123456789abcdef.jpg",
    fotosUrls: ["/admin/api/foto.php?file=0123456789abcdef0123456789abcdef.jpg"],
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
    aperturaLibrePost: "42",
    aperturaDolorPost: "48",
    desviacionPost: "No",
    desvIzqPost: false,
    desvDerPost: false,
    // FEATURE-OPTIONAL: patron-desviacion
    desvCorregidaPost: false,
    deflexionPost: false,
    // /FEATURE-OPTIONAL: patron-desviacion
    protrusionPost: "9",
    latIzqPost: "11",
    latDerPost: "11",
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


// Re-exportar utilidades de comparación desde ficha-compare.mjs para retrocompatibilidad total
export {
  sideText,
  formatSide,
  daysBetween,
  compareFichas,
} from "./ficha-compare.mjs";
