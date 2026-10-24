// Verifica la opción C editable del menú sin IA (admin ↔ workflow n8n).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_OPT_C_TEXT, renderOptCText, REMINDER_TEMPLATE_TEXT, renderReminderPreview } from "../admin/modules/menu-texts.js";
import { CONTACT } from "./site-contact.mjs";

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

test("recordatorio: texto de la plantilla de Meta sólo lectura, igual a lo que envía n8n", () => {
  const html = read("admin/index.html");
  const ta = html.match(/<textarea id="cfg-clara-reminder-text"[^>]*>/)[0];
  assert.match(ta, /\breadonly\b/);
  assert.match(ta, /aria-readonly="true"/);
  assert.ok(html.includes("Este texto lo fija la plantilla aprobada por WhatsApp (Meta) y no se puede editar desde aquí. Lo que sí podés cambiar son las indicaciones de abajo."));
  assert.doesNotMatch(html.match(/<textarea id="cfg-clara-reminder-notes"[^>]*>/)[0], /readonly/);
  // Mismo texto que el mensaje por defecto del nodo "Parse Patients & Phones" (variables de la plantilla).
  const wfPath = path.join(root, "..", "kinesica-bot", "workflow_recordatorios.json");
  if (fs.existsSync(wfPath)) {
    const wf = JSON.parse(fs.readFileSync(wfPath, "utf8"));
    const code = wf.nodes.find((x) => x.name === "Parse Patients & Phones").parameters.jsCode;
    assert.match(code, /const tipo = 'sesión en el consultorio';/);
    const tpl = code.match(/messageBody = `(¡Hola \$\{patientFirstName\}[^`]*)`/)[1]
      .replace("${patientFirstName}", "{nombre}").replace("${tipo}", "sesión en el consultorio")
      .replace("${formattedTime}", "{horario}").replace("${indicaciones}", "{indicaciones}").replace(/\\n/g, "\n");
    assert.equal(tpl, REMINDER_TEMPLATE_TEXT);
    const send = wf.nodes.find((x) => x.name === "Send WhatsApp Reminder").parameters.jsonBody;
    assert.match(send, /name: "recordatorio_turno_kinesica"|"name": "recordatorio_turno_kinesica"/);
  }
  assert.equal(renderReminderPreview(`📍 ${CONTACT.address.streetAddress}`),
    `¡Hola Lucas! 🌿 Te escribo desde Kinésica para recordarte tu sesión en el consultorio programada para mañana a las 16:00 hs.\n\n📍 ${CONTACT.address.streetAddress}\n\nPor favor confirmá tu asistencia seleccionando una de las opciones a continuación 🙌:`);
});

test("guardar textos no envía reminder_text y los módulos se importan con una sola versión", () => {
  const js = read("admin/modules/configuracion.js");
  const form = js.slice(js.indexOf("function readFormTexts()"), js.indexOf("function rememberLoadedTexts("));
  assert.ok(form.includes("reminder_notes"));
  assert.ok(!form.includes("reminder_text"), "readFormTexts no debe incluir reminder_text");
  assert.ok(!/inputClaraReminderText\?\.addEventListener/.test(js));
  // Un mismo módulo importado con distinto ?v= crea dos instancias con estado separado.
  const versions = {};
  for (const rel of ["admin/app.js", ...fs.readdirSync(path.join(root, "admin/modules")).map((f) => `admin/modules/${f}`)]) {
    if (!rel.endsWith(".js")) continue;
    for (const m of read(rel).matchAll(/from "\.\/(?:modules\/)?([a-z-]+\.js)\?v=(\d+)"/g)) {
      (versions[m[1]] ||= new Set()).add(m[2]);
    }
  }
  for (const mod of ["horarios.js", "honorarios.js", "configuracion.js", "menu-texts.js"]) {
    assert.equal(versions[mod]?.size ?? 1, 1, `${mod} importado con versiones distintas: ${[...(versions[mod] || [])]}`);
  }
});

console.log(`admin menú C: ok (${n} pruebas)`);
