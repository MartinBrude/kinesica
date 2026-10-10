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
    nombre: "Lic. María",
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
