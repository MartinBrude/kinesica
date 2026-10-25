import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { phoneMatches, phoneQueryVariants } from "../admin/modules/phone-search.js";

const stored = "5491161164311";
for (const q of ["(+54) 9 11 6116 4311", "6116 4311", "6116-4311", "011 6116 4311", "15 6116 4311", "+5491161164311", "4311"]) {
  assert.ok(phoneMatches(stored, q), `debe encontrar ${q}`);
}
assert.ok(phoneMatches("34612345678", "0034 612 345 678"), "debe encontrar número internacional buscado con prefijo 00");
assert.ok(phoneMatches("59899123456", "+598 99 123 456"), "debe encontrar número uruguayo con +598");
for (const q of ["6116 4312", "12", "Lucas", ""]) assert.ok(!phoneMatches(stored, q), `no debe encontrar ${q}`);
assert.deepEqual(phoneQueryVariants("ab"), []);
assert.ok(!phoneMatches("", "1234"));
const pac = readFileSync("admin/modules/pacientes.js", "utf8");
assert.match(pac, /phoneMatches\(p\.telefono, query\)/);
assert.match(pac, /phoneMatches\(p\.contacto_telefono, query\)/);
assert.match(pac, /formatPatientName/);

// Verificar formato de nombre Apellido, Nombre(s)
import { formatPatientName } from "../admin/modules/pacientes.js";
assert.equal(formatPatientName({ apellido: "Pérez", nombre: "Juan Carlos" }).display, "Pérez, Juan Carlos");
assert.equal(formatPatientName({ nombre_completo: "Ana Clara Gómez" }).display, "Gómez, Ana Clara");

// Verificar permisos de eliminación en pacientes.php
const pacPhp = readFileSync("admin/api/pacientes.php", "utf8");
assert.match(pacPhp, /norberto/);
assert.match(pacPhp, /maria/);

const html = readFileSync("admin/index.html", "utf8");
assert.ok(!html.includes("(A, B, D)"), "el subtítulo no debe decir (A, B, D)");
assert.ok(html.includes("respuestas automáticas (A, B, C, D y E)"));
assert.match(html, /Apellido, Nombre\(s\)/);
assert.match(html, /app\.js\?v=\d+/);
console.log("pacientes (búsqueda por teléfono, orden por apellido, permisos DELETE) y subtítulo del admin: ok");
