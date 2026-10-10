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
  nextSession,
  ownsFicha,
} from "../admin/ficha-rules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "admin/index.html"), "utf8");
const php = fs.readFileSync(path.join(root, "admin/api/fichas.php"), "utf8");
const app = fs.readFileSync(path.join(root, "admin/app.js"), "utf8");

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
assert.equal(assignProfesional("martin", "maria"), "maria", "Editar no cambia el profesional");
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
assert.match(php, /\$profesional = 'norberto'/);
assert.doesNotMatch(php, /'martin' => 'Martín'/);
assert.match(php, /implode\(', ', \$missing\)/);

console.log("fichas ATM: ok");
