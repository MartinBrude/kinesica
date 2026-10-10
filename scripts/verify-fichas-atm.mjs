import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLINICIANS,
  REQUIRED_FIELDS,
  assignProfesional,
  emptyFicha,
  ageOn,
  exampleFicha,
  missingFields,
  missingFieldKeys,
  nextSession,
  ownsFicha,
  coerceFicha,
  normalizeDni,
  patientKey,
  compareFichas,
  daysBetween,
  matchFichaSearch,
} from "../admin/ficha-rules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "admin/index.html"), "utf8");
const php = fs.readFileSync(path.join(root, "admin/api/fichas.php"), "utf8");
function loadAdminJs(entryPath) {
  const content = fs.readFileSync(entryPath, "utf8");
  const modulesDir = path.join(path.dirname(entryPath), "modules");
  if (!fs.existsSync(modulesDir)) return content;
  const order = [
    "dom.js",
    "print.js",
    "compare.js",
    "form.js",
    "library.js",
    "auth.js",
    "api.js",
  ];
  const moduleContents = order
    .map((file) => path.join(modulesDir, file))
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, "utf8"));
  return [content, ...moduleContents].join("\n");
}
const app = loadAdminJs(path.join(root, "admin/app.js"));
function loadCss(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content.replace(/@import\s+["'](\.[^"']+)["'];/g, (_, rel) => {
    return loadCss(path.resolve(path.dirname(filePath), rel));
  });
}
const css = loadCss(path.join(root, "admin/styles.css"));

const empty = missingFields({});
assert.deepEqual(
  empty,
  REQUIRED_FIELDS.map(([, label]) => label),
  "Una ficha vacía debe listar todos los campos obligatorios",
);
assert.equal(missingFields({
  nombre: "Ana",
  dni: "1",
  fechaSesion: "2026-10-10",
  nacimiento: "1990-01-01",
  edad: "36",
  lugarNac: "CABA",
  motivo: "Traumático",
  antecedentes: "Golpe",
}).length, 0);

const partial = missingFields({ nombre: "  ", dni: "1" });
assert.ok(partial.includes("el nombre completo"));
assert.ok(!partial.includes("el DNI"));
assert.ok(partial.length > 1, "Debe informar cada campo que falta");

assert.equal(assignProfesional("maria", ""), "maria");
assert.equal(assignProfesional("norberto", ""), "norberto");
assert.equal(assignProfesional("martin", ""), "norberto");
assert.equal(assignProfesional("otro", ""), "norberto");
assert.equal(assignProfesional("martin", "maria"), "maria", "Editar no cambia el profesional por defecto");
assert.equal(assignProfesional("martin", "", "maria"), "maria", "El admin puede crear ficha asignada a María");
assert.equal(assignProfesional("martin", "", "norberto"), "norberto", "El admin puede crear ficha asignada a Norberto");
assert.equal(assignProfesional("martin", "norberto", "maria"), "maria", "El admin puede reasignar profesional");
assert.equal(assignProfesional("maria", "", "norberto"), "maria", "Un profesional no-admin no puede reasignar");
assert.match(html, /id="field-profesional"/);
assert.match(html, /name="profesional"/);
assert.equal(ownsFicha({ profesional: "maria" }, "maria"), true);
assert.equal(ownsFicha({ profesional: "norberto" }, "maria"), false);
assert.match(html, /id="btn-mine"/);
assert.match(html, /Ver solo mis pacientes/);
assert.match(html, /id="pdf-patient"/);
assert.doesNotMatch(html, /Paciente para el PDF/);
assert.doesNotMatch(html, /id="btn-demo"/);
assert.match(html, /id="btn-group"/);
assert.match(html, /Agrupar por paciente/);
assert.equal(ageOn("1992-03-14", "2026-03-13"), "33");
assert.equal(ageOn("1992-03-14", "2026-03-14"), "34");
assert.equal(ageOn("", "2026-03-14"), "");
const followUp = nextSession({ id: "old", savedAt: "x", nombre: "Ana", dni: "30111222", nacimiento: "1992-03-14", lugarNac: "Córdoba", edad: "30", motivo: "Dolor", ruidos: "Sí", cdi: ["I.a"] }, "2026-03-14");
assert.equal(followUp.edad, "34");
assert.equal(followUp.fechaSesion, "2026-03-14");
assert.equal(followUp.nombre, "Ana");
assert.equal(followUp.dni, "30111222");
assert.equal(followUp.lugarNac, "Córdoba");
assert.equal(followUp.motivo, "");
assert.equal(followUp.ruidos, "");
assert.deepEqual(followUp.cdi, []);
assert.equal(followUp.id, undefined);
assert.match(html, /id="btn-export"/);
assert.match(app, /function downloadJSON/);
assert.match(app, /textContent = "JSON"/);
assert.match(html, /id="btn-seed" hidden/);
assert.match(html, /id="btn-example"/);
assert.doesNotMatch(html, /id="btn-example" hidden/);
assert.match(app, /sessionUser.username !== "martin"/);
assert.match(app, /textContent = "Nueva ficha"/);
assert.match(app, /nextSession\(item, todayISO\(\)\)/);
assert.match(app, /¿Quitar la ficha/);
assert.match(app, /onlyMine = sessionUser\.username === "norberto" \|\| sessionUser\.username === "maria"/);
assert.match(app, /Ver todos los pacientes/);
assert.equal(CLINICIANS.martin, undefined);

const sample = exampleFicha();
const blank = emptyFicha();
for (const [key, value] of Object.entries(blank)) {
  assert.ok(Object.hasOwn(sample, key), `El ejemplo no trae ${key}`);
  if (typeof value === "string") {
    assert.equal(typeof sample[key], "string");
    assert.ok(String(sample[key]).trim(), `El ejemplo deja vacío ${key}`);
  } else if (typeof value === "boolean") {
    assert.equal(typeof sample[key], "boolean");
  } else if (Array.isArray(value)) {
    assert.ok(sample[key].length > 0, `El ejemplo deja vacío ${key}`);
  } else if (typeof value === "number") {
    assert.ok(sample[key] > 0, `El ejemplo deja en cero ${key}`);
  }
}
assert.equal(missingFields(sample).length, 0);

assert.match(html, /<form id="ficha"[^>]*novalidate/);
assert.doesNotMatch(html, /data-single="profesional"/);
assert.doesNotMatch(html, /data-value="martin"/);
for (const name of ["nombre", "dni", "fechaSesion", "nacimiento", "edad", "lugarNac", "antecedentes"]) {
  assert.match(html, new RegExp(`name="${name}"[^>]*required|name="${name}" required`));
}
assert.match(html, /type="module" src="\/admin\/app\.js/);
assert.match(app, /missingFields/);
assert.match(app, /exampleFicha/);
const openHandler = app.slice(app.indexOf("#file-open"));
const openUntilLogin = openHandler.slice(0, openHandler.indexOf("login-form"));
const arrayAt = openUntilLogin.indexOf("Array.isArray");
assert.match(openHandler, /fillForm\(data\)/);
assert.ok(arrayAt > 0);
assert.doesNotMatch(openUntilLogin.slice(0, arrayAt), /upsert\(/);
assert.match(openUntilLogin.slice(arrayAt), /upsert\(/);
assert.match(openHandler, /missingFields\(data\)/);

for (const [key] of REQUIRED_FIELDS) {
  assert.match(php, new RegExp(`'${key}' =>`));
}
assert.match(php, /\$auth\['username'\] === 'maria'/);
assert.match(php, /\$auth\['username'\] === 'martin'/);
assert.match(php, /\$profesional = 'norberto'/);
assert.doesNotMatch(php, /'martin' => 'Martín'/);
assert.match(php, /implode\(', ', \$missing\)/);

// Verificación de las 4 features opcionales y etiquetas
assert.match(html, /<!-- FEATURE-OPTIONAL: habitos-bruxismo -->/);
assert.match(html, /<!-- FEATURE-OPTIONAL: tipo-ruido -->/);
assert.match(html, /<!-- FEATURE-OPTIONAL: patron-desviacion -->/);
assert.match(html, /<!-- FEATURE-OPTIONAL: correlacion-cervical -->/);

assert.match(app, /\/\/ FEATURE-OPTIONAL: habitos-bruxismo/);
assert.match(app, /\/\/ FEATURE-OPTIONAL: tipo-ruido/);
assert.match(app, /\/\/ FEATURE-OPTIONAL: patron-desviacion/);
assert.match(app, /\/\/ FEATURE-OPTIONAL: correlacion-cervical/);

// Verificación de autocálculo de edad y validación suave
assert.match(app, /syncAge/);
assert.match(app, /updateStepValidation/);
assert.match(app, /syncEva/);
assert.match(html, /class="step-dot"/);

// Verificación de bloque de firma profesional
assert.match(app, /pf-signature/);
assert.match(app, /CLINICIAN_DETAILS/);

// Verificación de tipado estricto y normalización
const coerced = coerceFicha({
  nombre: "  Juan Pérez  ",
  dni: "34.111.222",
  eva: "15", // fuera de rango
  ruidosIzq: "verdad", // string en vez de boolean
  cdi: ["I.a", 123, null], // array con valores invalidos
});
assert.equal(coerced.nombre, "Juan Pérez");
assert.equal(coerced.eva, 10, "EVA debe estar acotado entre 0 y 10");
assert.equal(coerced.ruidosIzq, true, "Booleano debe ser estricto");
assert.deepEqual(coerced.cdi, ["I.a"], "CDI solo debe admitir strings");

assert.equal(normalizeDni("34.205.109"), "34205109");
assert.equal(normalizeDni(" 34 205 109 "), "34205109");
assert.equal(
  patientKey({ nombre: " Carolina Méndez ", dni: "34.205.109" }),
  patientKey({ nombre: "carolina méndez", dni: "34205109" }),
  "La clave de paciente debe ser independiente del formato de DNI y mayúsculas"
);

// Verificación de filtrado y búsqueda con DNI con/sin puntos y acentos
const fichaPuntos = { nombre: "Carolina Méndez", dni: "34.205.109" };
const fichaSinPuntos = { nombre: "Carolina Méndez", dni: "34205109" };

assert.equal(matchFichaSearch(fichaSinPuntos, "34.205.109"), true, "DNI con puntos en filtro debe encontrar ficha sin puntos");
assert.equal(matchFichaSearch(fichaPuntos, "34205109"), true, "DNI sin puntos en filtro debe encontrar ficha con puntos");
assert.equal(matchFichaSearch(fichaSinPuntos, "34.205"), true, "DNI parcial con puntos debe coincidir");
assert.equal(matchFichaSearch(fichaPuntos, "34.205"), true, "DNI parcial con puntos debe coincidir con ficha formateada");
assert.equal(matchFichaSearch(fichaPuntos, "34205"), true, "DNI parcial sin puntos debe coincidir");
assert.equal(matchFichaSearch(fichaPuntos, "34 205 109"), true, "DNI con espacios debe coincidir");
assert.equal(matchFichaSearch(fichaPuntos, "40.111.222"), false, "DNI diferente no debe coincidir");
assert.equal(matchFichaSearch(fichaPuntos, "carolina mendez"), true, "Nombre sin tilde debe encontrar paciente");
assert.equal(matchFichaSearch(fichaPuntos, "Carolina 34.205.109"), true, "Búsqueda combinada nombre + DNI con puntos");
assert.equal(matchFichaSearch(fichaPuntos, ""), true, "Búsqueda vacía debe devolver true");

const missingKeys = missingFieldKeys({});
assert.deepEqual(missingKeys, REQUIRED_FIELDS.map(([k]) => k));

// Verificación de Comparador de Sesiones (Feature sesión a sesión)
assert.equal(daysBetween("2026-09-01", "2026-09-15"), 14);
assert.equal(daysBetween("2026-09-15", "2026-09-01"), 14);
assert.equal(daysBetween("", "2026-09-15"), null);

const sesion1 = {
  id: "ses-1",
  nombre: "Carolina Méndez",
  dni: "34.205.109",
  fechaSesion: "2026-09-01",
  eva: 8,
  aperturaLibre: 28,
  aperturaDolor: 38,
  ruidos: "Sí",
  ruidosDer: true,
  contacto: "Prematuro anterior",
  desviacion: "Sí",
  desvDer: true,
  cdi: ["I.a", "II.a"],
};

const sesion2 = {
  id: "ses-2",
  nombre: "Carolina Méndez",
  dni: "34205109",
  fechaSesion: "2026-09-15",
  eva: 3,
  aperturaLibre: 38,
  aperturaDolor: 44,
  ruidos: "No",
  contacto: "Prematuro anterior",
  desviacion: "No",
  cdi: ["I.a"],
};

const diffRes = compareFichas(sesion1, sesion2);
assert.equal(diffRes.daysBetween, 14);
assert.equal(diffRes.kpis.eva.delta, -5);
assert.equal(diffRes.kpis.eva.trend, "better", "Dolor EVA en baja es mejoría clínica");
assert.equal(diffRes.kpis.aperturaLibre.delta, 10);
assert.equal(diffRes.kpis.aperturaLibre.trend, "better", "Mayor apertura libre es mejoría clínica");
assert.equal(diffRes.kpis.ruidos.changed, true);
assert.equal(diffRes.kpis.ruidos.trend, "better", "Cesación de ruidos es mejoría");
assert.equal(diffRes.sections.length, 5, "Debe tener las 5 secciones clínicas");

const seccionDolor = diffRes.sections.find((s) => s.id === "dolor");
assert.ok(seccionDolor, "Debe existir sección dolor y oclusión");
const campoContacto = seccionDolor.fields.find((f) => f.label === "Contacto dentario");
assert.ok(campoContacto);
assert.equal(campoContacto.changed, false, "Contacto dentario no cambió");
assert.equal(campoContacto.current, "Prematuro anterior", "Debe mantener el valor actual");

// Verificación de interfaz y componentes
assert.match(html, /id="view-compare"/);
assert.match(html, /id="compare-select-x"/);
assert.match(html, /id="compare-select-y"/);
assert.match(html, /id="btn-compare-swap"/);
assert.match(html, /id="btn-compare-pdf"/);
assert.match(html, /class="steps compare-steps"/);
assert.match(html, /data-compare-tab="summary"/);
assert.match(html, /id="compare-panels-wrap"/);
assert.match(html, /id="btn-compare-form"/);

assert.match(css, /\.compare-sheet/);
assert.match(css, /\.compare-session-picker/);
assert.match(css, /\.cmp-kpi-card/);
assert.match(css, /\.cmp-panel/);
assert.match(css, /\.cmp-field-box/);
assert.match(css, /\.pf-compare/);

assert.match(app, /compareFichas/);
assert.match(app, /showCompare/);
assert.match(app, /renderCompareContent/);
assert.match(app, /renderCompareTab/);
assert.match(app, /printCompare/);
assert.match(app, /btn-compare-swap/);

// Verificación de integridad estructural del DOM
const openSections = (html.match(/<section/g) || []).length;
const closeSections = (html.match(/<\/section>/g) || []).length;
assert.equal(openSections, closeSections, "Todas las secciones deben estar correctamente balanceadas");

const formClosePos = html.indexOf('</section>\n\n    <section id="view-compare"');
assert.ok(formClosePos > 0, "#view-form debe cerrarse antes de iniciar #view-compare");

console.log("fichas ATM: ok");

