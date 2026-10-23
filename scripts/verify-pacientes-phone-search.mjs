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
const html = readFileSync("admin/index.html", "utf8");
assert.ok(!html.includes("(A, B, D)"), "el subtítulo no debe decir (A, B, D)");
assert.ok(html.includes("respuestas automáticas (A, B, C y D)"));
assert.match(html, /app\.js\?v=\d+/);
console.log("pacientes (búsqueda por teléfono) y subtítulo del admin: ok");
