// Verifica la opción C editable del menú sin IA (admin ↔ workflow n8n).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_OPT_C_TEXT, renderOptCText } from "../admin/modules/menu-texts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
let n = 0;
const test = (name, fn) => { fn(); n += 1; };

test("placeholders de honorarios se reemplazan", () => {
  const out = renderOptCText("ATM {honorario_atm} / resto {honorario_general} / {medios_pago} / {honorario_atm}",
    { atm: 70000, general: 80000, payment_methods: "Efectivo o Transferencia" });
  assert.equal(out, "ATM $70.000 / resto $80.000 / efectivo o transferencia / $70.000");
});

test("texto vacío usa el default sin placeholders sueltos", () => {
  for (const t of [undefined, "", "   "]) {
    const out = renderOptCText(t, {});
    assert.match(out, /Honorarios y Cobertura/);
    assert.match(out, /\$65\.000/);
    assert.match(out, /\$75\.000/);
    assert.ok(!out.includes("{"));
  }
});

test("index.html tiene el campo cfg-opt-c", () => {
  assert.match(read("admin/index.html"), /<textarea id="cfg-opt-c"/);
});

test("configuracion.js carga, guarda y previsualiza opt_c_text", () => {
  const js = read("admin/modules/configuracion.js");
  assert.match(js, /querySelector\("#cfg-opt-c"\)/);
  assert.match(js, /opt_c_text: inputOptC\?\.value\?\.trim\(\)/);
  assert.match(js, /renderOptCText\(optC/);
});

test("settings.php acepta opt_c_text y horarios.php tiene default", () => {
  assert.match(read("admin/api/settings.php"), /'opt_c_text'/);
  assert.match(read("admin/api/horarios.php"), /'opt_c_text' =>/);
});

const wfPath = path.join(root, "..", "kinesica-bot", "workflow_live.json");
if (fs.existsSync(wfPath)) {
  test("el default de C coincide con el del workflow de n8n", () => {
    const wf = JSON.parse(fs.readFileSync(wfPath, "utf8"));
    const code = wf.nodes.find((x) => x.name === "Filter & Parse Message").parameters.jsCode;
    const m = code.match(/const DEFAULT_OPT_C_TEXT = `([\s\S]*?)`;/);
    assert.ok(m, "DEFAULT_OPT_C_TEXT no encontrado en el workflow");
    assert.equal(m[1].replace(/\\n/g, "\n"), DEFAULT_OPT_C_TEXT);
  });
}

test("el admin no tiene 'Restaurar por defecto' (botones, handlers ni acción reset)", () => {
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === "data" ? [] : walk(rel);
    return /\.(html|js|mjs|php|css)$/.test(e.name) ? [rel] : [];
  });
  const files = walk("admin");
  assert.ok(files.includes(path.join("admin", "index.html")));
  for (const rel of files) {
    const src = read(rel);
    assert.ok(!/Restaurar por defecto/i.test(src), `${rel} contiene "Restaurar por defecto"`);
    assert.ok(!/btn-reset-(horarios|honorarios|clara-texts)|btnResetTexts/.test(src), `${rel} conserva un botón/handler de restaurar`);
  }
  assert.ok(!/action:\s*"reset"/.test(read("admin/modules/horarios.js")), "horarios.js todavía envía action reset");
  assert.match(read("admin/api/horarios.php"), /=== 'reset'\) \{\n\s*json_out\(400/, "horarios.php debe rechazar action reset");
});

console.log(`admin menú C: ok (${n} pruebas)`);
