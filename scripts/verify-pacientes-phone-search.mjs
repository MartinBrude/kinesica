import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { phoneMatches, phoneQueryVariants } from "../admin/modules/phone-search.js";

const stored = "5491161164311";
for (const q of ["(+54) 9 11 6116 4311", "6116 4311", "6116-4311", "011 6116 4311", "15 6116 4311", "+5491161164311", "4311"]) {
  assert.ok(phoneMatches(stored, q), `debe encontrar ${q}`);
}
for (const q of ["6116 4312", "12", "Lucas", ""]) assert.ok(!phoneMatches(stored, q), `no debe encontrar ${q}`);
assert.deepEqual(phoneQueryVariants("ab"), []);
assert.ok(!phoneMatches("", "1234"));
const pac = readFileSync("admin/modules/pacientes.js", "utf8");
assert.match(pac, /phoneMatches\(p\.telefono, query\)/);
assert.match(pac, /phoneMatches\(p\.contacto_telefono, query\)/);
const html = readFileSync("admin/index.html", "utf8");
assert.ok(!html.includes("(A, B, D)"), "el subtítulo no debe decir (A, B, D)");
assert.ok(html.includes("respuestas automáticas (A, B, C y D)"));
assert.match(html, /app\.js\?v=134/);
console.log("pacientes (búsqueda por teléfono) y subtítulo del admin: ok");
