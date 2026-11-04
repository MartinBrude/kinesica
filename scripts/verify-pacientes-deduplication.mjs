import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  canonicalPatientNameKey,
  cleanPatientDni,
  isPlaceholderPhone,
  deduplicatePatientsInMemory,
} from "../admin/modules/pacientes.js";
import { inferPractitionerFromSlot } from "../admin/modules/horarios-validator.js";
import { CONTACT } from "./site-contact.mjs";

console.log("— Iniciando verificación de deduplicación de pacientes —");

// 1. Clave canónica de nombres de pacientes
assert.equal(
  canonicalPatientNameKey("Florencia González"),
  canonicalPatientNameKey("González, Florencia"),
  "Debe normalizar primer nombre y apellido sin importar el orden"
);
assert.equal(
  canonicalPatientNameKey("Lic. Florencia Gonzalez"),
  canonicalPatientNameKey("Florencia González"),
  "Debe omitir títulos como Lic."
);
assert.equal(
  canonicalPatientNameKey("Dra. María Laura Gómez"),
  canonicalPatientNameKey("Gómez, Maria Laura"),
  "Debe coincidir nombres compuestos y acentos"
);
assert.equal(
  canonicalPatientNameKey("Juan Carlos Pérez"),
  canonicalPatientNameKey("Pérez, Juan Carlos"),
  "Debe coincidir orden de Juan Carlos Pérez"
);
assert.equal(
  canonicalPatientNameKey("De la Vega, María"),
  canonicalPatientNameKey("Maria De La Vega"),
  "Debe coincidir nombres con partículas"
);

// 2. Limpieza de DNI
assert.equal(cleanPatientDni("38.123.456"), "38123456");
assert.equal(cleanPatientDni(" 38 123 456 "), "38123456");
assert.equal(cleanPatientDni("No provisto"), "");
assert.equal(cleanPatientDni("null"), "");
assert.equal(cleanPatientDni(null), "");

// 3. Detección de teléfonos placeholder
assert.ok(isPlaceholderPhone("sin-tel-f-123456789"));
assert.ok(isPlaceholderPhone("sin-tel-dni-38123456"));
assert.ok(isPlaceholderPhone("sin-telefono-abc"));
assert.ok(isPlaceholderPhone("ficha-123456"));
assert.ok(!isPlaceholderPhone("5491161234567"));
assert.ok(!isPlaceholderPhone("+34658444935"));

// 4. Reglas de deduplicación en memoria (JavaScript)
// Regla 1: "si uno dice con review y otro sin, queda que si"
const testReviews1 = [
  { id: 1, nombre_completo: "Ana Gómez", telefono: "sin-tel-f-1", dejo_review: 0, profesional_habitual: "indistinto" },
  { id: 2, nombre_completo: "Gómez, Ana", telefono: "5491111111111", dejo_review: 1, profesional_habitual: "indistinto" },
];
const resReviews1 = deduplicatePatientsInMemory(testReviews1);
assert.equal(resReviews1.length, 1);
assert.equal(resReviews1[0].dejo_review, 1, "Si uno dice con review y otro sin, queda que sí");
assert.equal(resReviews1[0].telefono, "5491111111111", "Debe conservar el teléfono real");

const testReviews2 = [
  { id: 1, nombre_completo: "Carlos Pérez", telefono: "sin-tel-f-1", dejo_review: 1, profesional_habitual: "indistinto" },
  { id: 2, nombre_completo: "Pérez, Carlos", telefono: "5491122222222", dejo_review: 0, profesional_habitual: "indistinto" },
];
const resReviews2 = deduplicatePatientsInMemory(testReviews2);
assert.equal(resReviews2.length, 1);
assert.equal(resReviews2[0].dejo_review, 1, "Si el primer registro tenía review, queda que sí");

const testReviewsNone = [
  { id: 1, nombre_completo: "Lucas Varela", telefono: "sin-tel-f-1", dejo_review: 0, profesional_habitual: "indistinto" },
  { id: 2, nombre_completo: "Varela, Lucas", telefono: "5491133333333", dejo_review: 0, profesional_habitual: "indistinto" },
];
const resReviewsNone = deduplicatePatientsInMemory(testReviewsNone);
assert.equal(resReviewsNone.length, 1);
assert.equal(resReviewsNone[0].dejo_review, 0, "Si ninguno tenía review, queda 0");

// Regla 2: "si uno dice indistinto y otro dice con tal, queda tal"
const testProf1 = [
  { id: 1, nombre_completo: "Florencia López", telefono: "sin-tel-f-1", profesional_habitual: "maria", dejo_review: 0 },
  { id: 2, nombre_completo: "López, Florencia", telefono: "5491144444444", profesional_habitual: "indistinto", dejo_review: 0 },
];
const resProf1 = deduplicatePatientsInMemory(testProf1);
assert.equal(resProf1.length, 1);
assert.equal(resProf1[0].profesional_habitual, "maria", "Si uno dice indistinto y otro maría, queda maría");

const testProf2 = [
  { id: 1, nombre_completo: "Mariano Díaz", telefono: "5491155555555", profesional_habitual: "indistinto", dejo_review: 0 },
  { id: 2, nombre_completo: "Díaz, Mariano", telefono: "sin-tel-f-2", profesional_habitual: "norberto", dejo_review: 0 },
];
const resProf2 = deduplicatePatientsInMemory(testProf2);
assert.equal(resProf2.length, 1);
assert.equal(resProf2[0].profesional_habitual, "norberto", "Si uno dice indistinto y otro norberto, queda norberto");

const testProfBothIndistinto = [
  { id: 1, nombre_completo: "Pedro Ramos", telefono: "sin-tel-f-1", profesional_habitual: "indistinto", dejo_review: 0 },
  { id: 2, nombre_completo: "Ramos, Pedro", telefono: "5491166666666", profesional_habitual: "indistinto", dejo_review: 0 },
];
const resProfBoth = deduplicatePatientsInMemory(testProfBothIndistinto);
assert.equal(resProfBoth.length, 1);
assert.equal(resProfBoth[0].profesional_habitual, "indistinto", "Si ambos son indistintos, queda indistinto");

// Pacientes distintos no se mezclan
const testDistinct = [
  { id: 1, nombre_completo: "Ana Gómez", telefono: "5491111111111", profesional_habitual: "maria", dejo_review: 1 },
  { id: 2, nombre_completo: "Carlos Pérez", telefono: "5491122222222", profesional_habitual: "norberto", dejo_review: 0 },
];
const resDistinct = deduplicatePatientsInMemory(testDistinct);
assert.equal(resDistinct.length, 2, "Pacientes distintos no se deben mezclar");

// 5. Inferencia de profesional por horario (JS)
assert.equal(inferPractitionerFromSlot("2026-11-11", "14:00"), "norberto", "Miércoles 14:00 -> Norberto");
assert.equal(inferPractitionerFromSlot("2026-11-04", "11:15"), "norberto", "Miércoles 11:15 -> Norberto");
assert.equal(inferPractitionerFromSlot("2026-11-12", "16:00"), "norberto", "Jueves 16:00 -> Norberto");
assert.equal(inferPractitionerFromSlot("2026-11-16", "10:00"), "maria", "Lunes 10:00 -> María");
assert.equal(inferPractitionerFromSlot("2026-11-16", "11:00"), "maria", "Lunes 11:00 -> María");
assert.equal(inferPractitionerFromSlot("2026-11-16", "12:00"), "maria", "Lunes 12:00 -> María");
assert.equal(inferPractitionerFromSlot("2026-11-16", "17:30"), "norberto", "Lunes 17:30 -> Norberto");
assert.equal(inferPractitionerFromSlot("2026-10-13", "18:00"), "norberto", "Martes 18:00 -> Norberto");
assert.equal(inferPractitionerFromSlot("2026-10-13", "10:00"), "maria", "Martes 10:00 -> María");
assert.equal(inferPractitionerFromSlot("2026-11-20", "10:00"), "maria", "Viernes 10:00 -> María");
assert.equal(inferPractitionerFromSlot("2026-11-20", "15:00"), "norberto", "Viernes 15:00 -> Norberto");
assert.equal(inferPractitionerFromSlot("", "", CONTACT.email), "norberto", "Creator Norberto");
assert.equal(inferPractitionerFromSlot("", "", "manosmagicas7116@gmail.com"), "maria", "Creator María");

console.log("✓ Pruebas en memoria JS: OK");

// 5. Pruebas backend PHP con SQLite en memoria
const phpOut = execSync("php scripts/verify-pacientes-deduplication.php", {
  cwd: process.cwd(),
  encoding: "utf8",
});
assert.ok(phpOut.includes("OK_PHP_TESTS"), "El backend PHP debe pasar todas las pruebas de deduplicación");

console.log("✓ Pruebas en base de datos PHP: OK");
console.log("pacientes deduplicación y prevención: ok");
