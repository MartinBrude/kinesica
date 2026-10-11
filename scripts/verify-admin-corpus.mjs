/**
 * Corpus grande del admin de fichas ATM.
 * Genera cientos de pacientes y sesiones con combinaciones de documento,
 * nombre, clínica y fechas, y comprueba que la identidad, el orden, la
 * validación y la comparativa no se rompen.
 * Uso: node scripts/verify-admin-corpus.mjs
 */
import assert from "node:assert/strict";
import {
  ageOn,
  coerceFicha,
  compareFichas,
  emptyFicha,
  getSessionIndex,
  getUniquePatients,
  matchFichaSearch,
  nextSession,
  normalizeDni,
  patientKey,
  validateFicha,
  validateStep,
} from "../admin/ficha-rules.mjs";

const NAMES = [
  ["Lucía", "Fernández"],
  ["Mateo", "Ruiz"],
  ["Sofía", "Álvarez"],
  ["Benjamín", "Castro"],
  ["Valentina", "Díaz"],
  ["Joaquín", "Romero"],
  ["Martina", "Giménez"],
  ["Thiago", "Acuña"],
  ["Catalina", "Benítez"],
  ["Bautista", "Pereyra"],
  ["Elena", "Núñez"],
  ["Iván", "Sosa"],
];
const MOTIVOS = ["Traumático", "No Traumático", "Pos Quirúrgico", ""];
const SIDES = [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
];
const CDI = ["I.a", "I.b", "II.a", "II.b", "II.c", "III.a", "III.b", "III.c"];
const ANSWERS = ["Sí", "No", ""];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261011);
const pick = (list) => list[Math.floor(rand() * list.length)];
const dniFormats = (digits) => [
  digits,
  digits.replace(/(\d{2})(\d{3})(\d{3})/, "$1.$2.$3"),
  ` ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)} `,
];

function nameVariant(first, last, n) {
  const full = `${first} ${last}`;
  if (n % 4 === 1) return full.toUpperCase();
  if (n % 4 === 2) return `  ${full.toLowerCase()}  `;
  if (n % 4 === 3) return full.normalize("NFC");
  return full;
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeSession(base, index, total) {
  const fecha = addDays(base.nacimiento, 18 * 365 + index * 21);
  const [izq, der] = SIDES[index % SIDES.length];
  const answer = ANSWERS[index % ANSWERS.length];
  const habits = index % 16;
  const ficha = coerceFicha({
    ...emptyFicha(),
    id: `${base.id}-s${index}`,
    nombre: nameVariant(base.first, base.last, index),
    dni: base.formats[index % base.formats.length],
    fechaSesion: fecha,
    nacimiento: base.nacimiento,
    lugarNac: index % 2 === 0 ? "Córdoba" : " córdoba ",
    motivo: MOTIVOS[index % MOTIVOS.length],
    antecedentes: index === 0 ? "" : `Sesión ${index + 1} de ${base.first}. Dolor ${index}.`,
    habitoApretamiento: Boolean(habits & 1),
    habitoBruxismo: Boolean(habits & 2),
    habitoMasticacionUni: Boolean(habits & 4),
    habitoOnicofagia: Boolean(habits & 8),
    ruidos: answer,
    ruidosIzq: answer === "Sí" && izq,
    ruidosDer: answer === "Sí" && der,
    dolorCondilar: ANSWERS[(index + 1) % ANSWERS.length],
    condilarIzq: izq,
    condilarDer: der,
    desviacion: ANSWERS[(index + 2) % ANSWERS.length],
    desvIzq: der,
    desvDer: izq,
    aperturaLibre: String(30 + (index % 15)),
    aperturaDolor: `${35 + index},5 mm`,
    protrusion: String(index % 9),
    latIzq: String(6 + (index % 5)),
    latDer: String(7 + (index % 4)),
    eva: (index * 3) % 11,
    cdi: CDI.filter((_, i) => (index + i) % (3 + (total % 3)) === 0),
    zona: index % 2 === 0 ? "Sien izquierda" : "Oído derecho",
    profesional: index % 2 === 0 ? "norberto" : "maria",
  });
  ficha.edad = ageOn(ficha.nacimiento, ficha.fechaSesion);
  if (ficha.dolorCondilar === "Sí" && !ficha.condilarIzq && !ficha.condilarDer) ficha.condilarIzq = true;
  if (ficha.desviacion === "Sí" && !ficha.desvIzq && !ficha.desvDer) ficha.desvDer = true;
  if (ficha.ruidos === "Sí" && !ficha.ruidosIzq && !ficha.ruidosDer) ficha.ruidosIzq = true;
  return ficha;
}

const patients = [];
for (let i = 0; i < 100; i += 1) {
  const [first, last] = NAMES[i % NAMES.length];
  const digits = String(30000000 + i * 137).padStart(8, "0");
  patients.push({
    id: `p${i}`,
    first: i % 17 === 0 ? `${first} José` : first,
    last,
    nacimiento: `19${70 + (i % 30)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
    formats: dniFormats(digits),
    sessions: 1 + (i % 5),
    kind: "dni",
  });
}
for (let i = 0; i < 16; i += 1) {
  const [first, last] = NAMES[i % NAMES.length];
  const passport = `AB${100000 + i}`;
  patients.push({
    id: `pass${i}`,
    first,
    last: `${last} Pass`,
    nacimiento: `198${i % 10}-06-15`,
    formats: [passport, passport.toLowerCase()],
    sessions: 2,
    kind: "passport",
  });
}
for (let i = 0; i < 10; i += 1) {
  const [first, last] = NAMES[i % NAMES.length];
  patients.push({
    id: `noname${i}`,
    first,
    last: `SinDoc${i}`,
    nacimiento: "2000-01-15",
    formats: ["", "   "],
    sessions: 2,
    kind: "nombre",
  });
}

const fichas = [];
for (const patient of patients) {
  for (let s = 0; s < patient.sessions; s += 1) {
    fichas.push(makeSession(patient, s, patient.sessions));
  }
}
fichas.push(coerceFicha(null), coerceFicha({}), coerceFicha({ nombre: "", dni: "" }));

const shuffled = [...fichas];
for (let i = shuffled.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rand() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}

let checks = 0;
function check(cond, message) {
  checks += 1;
  assert.ok(cond, message);
}

const groups = new Map();
for (const ficha of shuffled) {
  const key = patientKey(ficha);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(ficha);
}

check(fichas.length > 300, `se esperaban más de 300 fichas, hay ${fichas.length}`);
check(patients.length === 126, "el corpus tiene DNI, pasaporte y pacientes sin documento");

for (const patient of patients) {
  const own = fichas.filter((f) => f.id?.startsWith(`${patient.id}-`));
  check(own.length === patient.sessions, `${patient.id} no tiene ${patient.sessions} sesiones`);
  const keys = new Set(own.map((f) => patientKey(f)));
  check(keys.size === 1, `${patient.id} se partió en ${keys.size} personas por el nombre o el formato del documento`);
  if (patient.kind === "dni") {
    check([...keys][0] === `doc:${normalizeDni(patient.formats[0])}`, `${patient.id} no quedó identificado por el documento`);
  }
  const ordered = [...own].sort((a, b) => a.fechaSesion.localeCompare(b.fechaSesion));
  ordered.forEach((ficha, index) => {
    check(getSessionIndex(ficha, shuffled) === index + 1, `índice de sesión incorrecto en ${ficha.id}`);
    check(ageOn(ficha.nacimiento, ficha.fechaSesion) === ficha.edad, `edad incoherente en ${ficha.id}`);
  });
  if (ordered.length > 1) {
    const follow = nextSession(ordered[0], ordered[1].fechaSesion);
    check(patientKey(follow) === patientKey(ordered[0]), "la sesión siguiente cambió de persona");
    check(follow.eva === emptyFicha().eva, "la sesión siguiente copió el dolor clínico");
    check(follow.ruidos === "", "la sesión siguiente copió los ruidos");
    check(follow.nombre.trim().toLowerCase() === ordered[0].nombre.trim().toLowerCase(), "la sesión siguiente perdió el nombre");
    const compared = compareFichas(ordered[0], ordered[ordered.length - 1]);
    check(compared.daysBetween > 0, `comparativa sin intervalo en ${patient.id}`);
    check(Number.isInteger(compared.totalChanged), "la comparativa no contó cambios");
    check(compared.kpis.eva.current.startsWith(String(ordered[ordered.length - 1].eva)), "el KPI de EVA no usa la última sesión");
  }
}

const unique = getUniquePatients(shuffled);
const withIdentity = shuffled.filter((f) => patientKey(f));
const expectedPeople = new Set(withIdentity.map((f) => patientKey(f))).size;
check(unique.length === expectedPeople, `pacientes únicos ${unique.length} contra ${expectedPeople}`);
check(unique.every((p, i) => i === 0 || p.nombre.localeCompare(unique[i - 1].nombre, "es", { sensitivity: "base" }) >= 0), "el listado de pacientes no está ordenado");
check(getUniquePatients([{}, { nombre: "", dni: "" }, null]).length === 0, "fichas sin identidad entraron al listado");

for (const person of unique) {
  const key = person.key;
  check(person.sessions.every((f) => patientKey(f) === key), "una sesión quedó en el paciente equivocado");
  const queryName = person.nombre.split(" ")[0];
  if (queryName) {
    check(person.sessions.every((f) => matchFichaSearch(f, queryName)), `la búsqueda por nombre falló en ${person.nombre}`);
  }
  if (person.dni && !/[a-z]/i.test(person.dni)) {
    const digits = normalizeDni(person.dni);
    check(person.sessions.every((f) => matchFichaSearch(f, digits.slice(0, 4))), `la búsqueda por DNI falló en ${person.dni}`);
  }
}

const sameName = patients.filter((p) => p.kind === "dni" && p.first === "Lucía" && p.last === "Fernández");
check(sameName.length > 1, "faltan homónimos para probar que el documento los separa");
check(new Set(sameName.map((p) => patientKey(fichas.find((f) => f.id === `${p.id}-s0`)))).size === sameName.length, "dos homónimos compartieron paciente");

const noDoc = patients.filter((p) => p.kind === "nombre");
check(new Set(noDoc.map((p) => patientKey({ nombre: `${p.first} ${p.last}`, dni: "" }))).size === noDoc.length, "pacientes sin documento se mezclaron");

for (let step = 0; step <= 4; step += 1) {
  for (const ficha of fichas.filter((f) => f.id).slice(0, 40)) {
    const result = validateStep(step, ficha);
    check(typeof result.isValid === "boolean", `validateStep ${step} no devolvió estado`);
  }
}

const withId = fichas.filter((f) => f.id);
let valid = 0;
for (const ficha of withId) {
  const full = {
    ...ficha,
    motivo: ficha.motivo || "No Traumático",
    antecedentes: ficha.antecedentes || "Dolor de 6 meses.",
    ruidos: "No",
    dolorCondilar: "No",
    desviacion: "No",
    aperturaLibre: ficha.aperturaLibre || "40",
    aperturaDolor: ficha.aperturaDolor || "42",
    protrusion: ficha.protrusion || "5",
    latIzq: ficha.latIzq || "8",
    latDer: ficha.latDer || "8",
  };
  const ok = validateFicha(full);
  const broken = validateFicha({ ...full, dni: "", eva: 99, ruidos: "Sí", ruidosIzq: false, ruidosDer: false });
  if (ok.isValid) valid += 1;
  else {
    check(ok.firstError, `ficha completa sin mensaje de error (${ficha.id})`);
  }
  check(!broken.isValid, `una ficha sin documento y con EVA fuera de rango pasó la validación (${ficha.id})`);
  const hostile = coerceFicha({ ...full, __proto__: { polluted: true }, extra: "no", eva: "ocho" });
  check(hostile.polluted === undefined && hostile.eva === 0 && hostile.extra === undefined, "coerceFicha dejó pasar basura");
}

check(valid > 200, `pocas fichas válidas en el corpus: ${valid} de ${withId.length}`);
check(validateFicha(null).isValid === false, "null no debe ser una ficha válida");
check(compareFichas(null, {}).totalChanged >= 0, "comparar fichas vacías lanzó o no contó");

console.log(`admin corpus: ok (${fichas.length} fichas, ${unique.length} pacientes, ${checks} comprobaciones, ${valid} válidas)`);
