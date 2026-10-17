/**
 * Tests de robustez del admin de fichas ATM.
 * Cubren casos límite de las reglas puras, el cliente API (con fetch simulado)
 * y la integridad estática entre HTML, módulos JS y CSS.
 * Uso: node scripts/verify-admin-robustness.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ageOn,
  coerceFicha,
  compareFichas,
  daysBetween,
  emptyFicha,
  missingFieldKeys,
  formatSessionBadgeText,
  getSessionIndex,
  getUniquePatients,
  matchFichaSearch,
  nextSession,
  normalizeDni,
  patientKey,
  dniNameConflict,
  validateField,
  validateFicha,
  validateStep,
} from "../admin/ficha-rules.mjs";
import { api, formatDate, setAuthRequiredHandler } from "../admin/modules/api.js";
import { escapeHtml } from "../admin/modules/dom.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminDir = path.join(root, "admin");
let passed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Reglas puras: entradas inválidas o hostiles no deben romper ni contaminar datos
// ---------------------------------------------------------------------------

await test("coerceFicha tolera null, undefined y tipos erróneos", () => {
  for (const bad of [null, undefined, {}, [], "texto", 42]) {
    const out = coerceFicha(bad);
    assert.equal(typeof out.nombre, "string");
    assert.equal(typeof out.eva, "number");
    assert.ok(out.eva >= 0 && out.eva <= 10);
  }
});

await test("coerceFicha acota EVA y descarta basura numérica", () => {
  assert.equal(coerceFicha({ eva: 99 }).eva, 10);
  assert.equal(coerceFicha({ eva: -5 }).eva, 0);
  assert.equal(coerceFicha({ eva: "abc" }).eva, 0);
  assert.equal(coerceFicha({ eva: 4.6 }).eva, 5);
});

await test("coerceFicha sanea edad y mediciones", () => {
  assert.equal(coerceFicha({ edad: "37 años" }).edad, "37");
  assert.equal(coerceFicha({ edad: "0" }).edad, "");
  assert.equal(coerceFicha({ edad: "500" }).edad, "");
  assert.equal(coerceFicha({ aperturaLibre: "35,5 mm" }).aperturaLibre, "35.5");
  assert.equal(coerceFicha({ aperturaLibre: "abc" }).aperturaLibre, "");
});

await test("coerceFicha no copia propiedades ajenas al esquema (prototype pollution)", () => {
  const hostile = JSON.parse('{"__proto__":{"polluted":true},"constructor":"x","nombre":" Ana "}');
  const out = coerceFicha(hostile);
  assert.equal(out.nombre, "Ana");
  assert.equal(out.polluted, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(out, "constructor"), false);
});

await test("coerceFicha filtra arrays con elementos no string", () => {
  const template = emptyFicha();
  const arrayKey = Object.keys(template).find((k) => Array.isArray(template[k]));
  if (!arrayKey) return;
  const out = coerceFicha({ [arrayKey]: ["a", 1, null, { x: 1 }, "b"] });
  assert.deepEqual(out[arrayKey], ["a", "b"]);
});

await test("ageOn rechaza fechas imposibles, vacías o futuras", () => {
  assert.equal(ageOn("", "2026-10-11"), "");
  assert.equal(ageOn("1989-05-28", ""), "");
  assert.equal(ageOn(null, undefined), "");
  assert.equal(ageOn("1989-13-45", "2026-10-11"), "");
  assert.equal(ageOn("1989-00-10", "2026-10-11"), "");
  assert.equal(ageOn("2030-01-01", "2026-10-11"), "");
  assert.equal(ageOn("1989-05-28", "2026-10-11"), "37");
  assert.equal(ageOn("1989-10-11", "2026-10-11"), "37");
  assert.equal(ageOn("1989-10-12", "2026-10-11"), "36");
});

await test("dniNameConflict rechaza el documento de otra persona y permite corregir el propio", () => {
  const carolina = { id: "a", nombre: "Carolina Méndez", dni: "34.205.109" };
  const pedro = { id: "b", nombre: "Pedro Gómez", dni: "20.111.222" };
  const clash = dniNameConflict({ id: "nuevo", nombre: "Ana López", dni: "34.205.109" }, [carolina, pedro]);
  assert.equal(clash.nombre, "Carolina Méndez");
  assert.equal(dniNameConflict({ id: "nuevo", nombre: "carolina mendez", dni: "34205109" }, [carolina]), null);
  assert.equal(
    dniNameConflict({ id: "a", nombre: "Carolina Mendez", dni: "34.205.109" }, [carolina, { id: "a2", nombre: "Carolína Méndez", dni: "34205109" }], "doc:34205109"),
    null
  );
});

await test("sin documento, el DNI deja de ser obligatorio", () => {
  const data = { ...emptyFicha(), sinDocumento: true, nombre: "Ana", fechaSesion: "2026-10-11", nacimiento: "1990-01-01", edad: "36", motivo: "No Traumático", antecedentes: "Dolor." };
  assert.ok(!missingFieldKeys(data).includes("dni"));
  assert.equal(validateField("dni", "", data), null);
  assert.equal(validateField("dni", "", emptyFicha()), "Falta completar el DNI / Pasaporte");
});

await test("normalizeDni y patientKey son estables ante formato", () => {
  assert.equal(normalizeDni("34.534.337"), "34534337");
  assert.equal(normalizeDni(" 34 534 337 "), "34534337");
  assert.equal(normalizeDni(null), "");
  assert.equal(patientKey({ nombre: " Ana  ", dni: "1.234.567" }), patientKey({ nombre: "ana", dni: "1234567" }));
  assert.equal(patientKey({ nombre: "Ana López", dni: "1234567" }), patientKey({ nombre: "Ana", dni: "12.345.67" }));
  assert.notEqual(patientKey({ nombre: "Ana", dni: "111" }), patientKey({ nombre: "Ana", dni: "222" }));
  assert.equal(patientKey({ nombre: "Ana", dni: "" }), patientKey({ nombre: " ana ", dni: "" }));
  assert.equal(patientKey(null), "");
  assert.equal(patientKey({ nombre: "", dni: "" }), "");
});

await test("matchFichaSearch: acentos, mayúsculas, DNI con puntos y entradas nulas", () => {
  const item = { nombre: "Carolina Méndez", dni: "34534337" };
  assert.ok(matchFichaSearch(item, "mendez"));
  assert.ok(matchFichaSearch(item, "CAROLINA"));
  assert.ok(matchFichaSearch(item, "34.534"));
  assert.ok(matchFichaSearch(item, "carolina 34534"));
  assert.ok(!matchFichaSearch(item, "pedro"));
  assert.ok(matchFichaSearch(item, ""));
  assert.ok(matchFichaSearch(item, null));
  assert.ok(!matchFichaSearch(null, "ana"));
  assert.ok(!matchFichaSearch({}, "ana"));
});

await test("matchFichaSearch no interpreta la búsqueda como regex", () => {
  const item = { nombre: "Ana (López)", dni: "1" };
  assert.doesNotThrow(() => matchFichaSearch(item, "(["));
  assert.doesNotThrow(() => matchFichaSearch(item, ".*"));
  assert.ok(!matchFichaSearch(item, ".*"));
});

await test("daysBetween devuelve null ante fechas inválidas y es simétrico", () => {
  assert.equal(daysBetween("", "2026-10-11"), null);
  assert.equal(daysBetween("no-fecha", "2026-10-11"), null);
  assert.equal(daysBetween("2026-10-01", "2026-10-11"), 10);
  assert.equal(daysBetween("2026-10-11", "2026-10-01"), 10);
});

await test("getUniquePatients ignora fichas sin identidad y agrupa sesiones", () => {
  const list = getUniquePatients([
    { id: "1", nombre: "Ana", dni: "1111" },
    { id: "2", nombre: "ana", dni: "1.111" },
    { id: "3", nombre: "", dni: "" },
    {},
    { id: "4", nombre: "Beto", dni: "2222" },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].sessions.length, 2);
  assert.doesNotThrow(() => getUniquePatients(undefined));
  assert.deepEqual(getUniquePatients([]), []);
});

await test("getSessionIndex ordena por fecha y numera sesiones nuevas", () => {
  const all = [
    { id: "b", nombre: "Ana", dni: "1111", fechaSesion: "2026-10-12" },
    { id: "a", nombre: "Ana", dni: "1111", fechaSesion: "2026-10-11" },
  ];
  assert.equal(getSessionIndex(all[1], all), 1);
  assert.equal(getSessionIndex(all[0], all), 2);
  assert.equal(getSessionIndex({ id: "nuevo", nombre: "Ana", dni: "1111" }, all), 3);
  assert.equal(getSessionIndex(null, all), 1);
  assert.equal(getSessionIndex({ id: "x", nombre: "Otro", dni: "9" }, undefined), 1);
});

await test("nextSession copia solo datos del paciente, no clínicos", () => {
  const prev = { ...emptyFicha(), nombre: "Ana", dni: "1111", nacimiento: "1989-05-28", eva: 8, ruidos: "Sí", id: "abc", profesional: "maria" };
  const next = nextSession(prev, "2026-10-20");
  assert.equal(next.nombre, "Ana");
  assert.equal(next.eva, emptyFicha().eva);
  assert.equal(next.ruidos, emptyFicha().ruidos);
  assert.equal(next.id, undefined);
  assert.equal(next.edad, "37");
  assert.equal(next.profesional, "maria");
  assert.doesNotThrow(() => nextSession(null, ""));
});

await test("formatSessionBadgeText cubre inicial y seguimiento", () => {
  assert.equal(formatSessionBadgeText(1, 1), "Evaluación inicial");
  assert.equal(formatSessionBadgeText(2, 3), "Sesión N° 2 de 3");
});

await test("validateFicha y compareFichas no lanzan con datos vacíos o iguales", () => {
  assert.doesNotThrow(() => validateFicha());
  assert.doesNotThrow(() => validateFicha(null));
  assert.equal(validateFicha({}).isValid, false);
  assert.doesNotThrow(() => validateStep(0, null));
  const a = { ...emptyFicha(), nombre: "Ana", dni: "1111", fechaSesion: "2026-10-11" };
  assert.doesNotThrow(() => compareFichas(a, a));
  assert.doesNotThrow(() => compareFichas({}, null));
  const same = compareFichas(a, a);
  assert.equal(same.daysBetween, 0);
  assert.equal(same.totalChanged, 0);
});

// ---------------------------------------------------------------------------
// Utilidades DOM y fechas
// ---------------------------------------------------------------------------

await test("escapeHtml neutraliza HTML y tolera null", () => {
  assert.equal(escapeHtml('<img src=x onerror="a()">'), "&lt;img src=x onerror=&quot;a()&quot;&gt;");
  assert.equal(escapeHtml("a & b'c"), "a &amp; b&#039;c");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(0), "0");
});

await test("formatDate tolera valores vacíos y formatos inesperados", () => {
  assert.equal(formatDate("2026-10-11"), "11/10/2026");
  assert.equal(formatDate(""), "—");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("ayer"), "ayer");
  assert.equal(formatDate("2026-10-11T10:00:00"), "2026-10-11T10:00:00");
});

// ---------------------------------------------------------------------------
// Cliente API con fetch simulado
// ---------------------------------------------------------------------------

function mockFetch(responder) {
  globalThis.fetch = async (url, options) => responder(url, options);
}
function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

await test("api envía cabecera anti-CSRF y Content-Type JSON", async () => {
  let seen;
  mockFetch((url, options) => {
    seen = { url, options };
    return jsonResponse(200, { ok: true });
  });
  const data = await api("fichas.php", { method: "POST", body: JSON.stringify({ a: 1 }) });
  assert.deepEqual(data, { ok: true });
  assert.equal(seen.url, "api/fichas.php");
  assert.equal(seen.options.headers["X-Kinesica"], "1");
  assert.equal(seen.options.headers["Content-Type"], "application/json");
  assert.equal(seen.options.credentials, "same-origin");
});

await test("api avisa sesión caducada (401) y rechaza con error.auth", async () => {
  let notified = null;
  setAuthRequiredHandler((payload) => {
    notified = payload;
  });
  mockFetch(() => jsonResponse(401, { gate: true }));
  await assert.rejects(api("fichas.php"), (error) => error.auth === true && error.message === "auth");
  assert.deepEqual(notified, { gate: true });
  setAuthRequiredHandler(null);
});

await test("api propaga el mensaje del servidor en errores 4xx/5xx", async () => {
  mockFetch(() => jsonResponse(422, { error: "Datos inválidos" }));
  await assert.rejects(api("fichas.php"), (error) => error.status === 422 && error.message === "Datos inválidos");
  mockFetch(() => jsonResponse(500, {}));
  await assert.rejects(api("fichas.php"), (error) => error.status === 500 && error.message.length > 0);
});

await test("api tolera respuestas que no son JSON", async () => {
  mockFetch(() => ({ status: 200, ok: true, json: async () => { throw new SyntaxError("x"); } }));
  assert.deepEqual(await api("me.php"), {});
});

await test("api convierte un corte por tiempo en un error legible", async () => {
  mockFetch((_url, options) => {
    if (options.signal && options.signal.aborted) {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }
    return jsonResponse(200, { ok: true });
  });
  await assert.rejects(api("fichas.php", { signal: AbortSignal.abort() }), (error) => error.timeout === true && error.network === true);
});

await test("api convierte fallos de red en un error legible", async () => {
  mockFetch(() => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(api("fichas.php"), (error) => error.network === true && /conexi/i.test(error.message));
});

// ---------------------------------------------------------------------------
// Integridad estática: HTML ↔ JS ↔ CSS
// ---------------------------------------------------------------------------

const html = fs.readFileSync(path.join(adminDir, "index.html"), "utf8");
const jsFiles = [
  path.join(adminDir, "app.js"),
  path.join(adminDir, "ficha-rules.mjs"),
  ...fs.readdirSync(path.join(adminDir, "modules")).map((f) => path.join(adminDir, "modules", f)),
];

await test("todos los archivos JS del admin tienen sintaxis válida", () => {
  for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, `${path.relative(root, file)}: ${result.stderr}`);
  }
});

await test("index.html no tiene ids duplicados", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(dupes)], []);
});

await test("los ids usados por querySelector/getElementById existen en el HTML o se crean en JS", () => {
  const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const missing = [];
  for (const file of jsFiles) {
    const src = fs.readFileSync(file, "utf8");
    const created = new Set([...src.matchAll(/\.id\s*=\s*["'`]([^"'`$]+)["'`]/g)].map((m) => m[1]));
    const refs = [
      ...[...src.matchAll(/querySelector\(\s*["'`]#([\w-]+)["'`]\s*\)/g)].map((m) => m[1]),
      ...[...src.matchAll(/getElementById\(\s*["'`]([\w-]+)["'`]\s*\)/g)].map((m) => m[1]),
    ];
    for (const id of refs) {
      if (!htmlIds.has(id) && !created.has(id)) missing.push(`${path.basename(file)} → #${id}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

await test("handlers de botones eliminados no quedaron huérfanos", () => {
  const removed = ["btn-pdf-all", "btn-pdf-one", "btn-example", "btn-clear", "btn-export-one"];
  for (const file of jsFiles) {
    const src = fs.readFileSync(file, "utf8");
    for (const id of removed) {
      assert.ok(!src.includes(`#${id}`), `${path.basename(file)} aún referencia #${id}`);
    }
  }
});

await test("los imports relativos de los módulos apuntan a archivos existentes", () => {
  const broken = [];
  for (const file of jsFiles) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const target = path.resolve(path.dirname(file), m[1].split("?")[0]);
      if (!fs.existsSync(target)) broken.push(`${path.basename(file)} → ${m[1]}`);
    }
  }
  assert.deepEqual(broken, []);
});

await test("los @import de styles.css existen y las llaves CSS están balanceadas", () => {
  const stylesPath = path.join(adminDir, "styles.css");
  const styles = fs.readFileSync(stylesPath, "utf8");
  const files = [stylesPath];
  for (const m of styles.matchAll(/@import\s+["'](\.[^"']+)["']/g)) {
    const target = path.resolve(adminDir, m[1].split("?")[0]);
    assert.ok(fs.existsSync(target), `@import inexistente: ${m[1]}`);
    files.push(target);
  }
  for (const file of files) {
    const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const open = (css.match(/{/g) || []).length;
    const close = (css.match(/}/g) || []).length;
    assert.equal(open, close, `Llaves desbalanceadas en ${path.basename(file)}`);
  }
});

await test("las versiones ?v= de CSS/JS en index.html son consistentes", () => {
  const versions = [...html.matchAll(/(?:styles\.css|app\.js)\?v=(\d+)/g)].map((m) => m[1]);
  assert.ok(versions.length >= 2);
});

await test("cada página impresa, incluida la segunda, tiene margen superior", () => {
  const printCss = fs.readFileSync(path.join(adminDir, "css/print.css"), "utf8");
  assert.match(printCss, /@page\s*{[^}]*margin:\s*20mm\s+24mm/);
  assert.match(printCss, /\.print-sheet\s*{[^}]*padding:\s*0/);
});

await test("los botones de features (Clara y Booking) no existen en el HTML inicial y se crean solo autenticado", () => {
  assert.ok(!html.includes('id="btn-toggle-clara"'));
  assert.ok(!html.includes('id="btn-toggle-booking"'));

  const appJs = fs.readFileSync(path.join(adminDir, "app.js"), "utf8");
  assert.match(appJs, /\.id\s*=\s*["']btn-toggle-clara["']/);
  assert.match(appJs, /\.id\s*=\s*["']btn-toggle-booking["']/);

  const baseCss = fs.readFileSync(path.join(adminDir, "css/base.css"), "utf8");
  assert.match(baseCss, /\.clara-btn\[hidden\]/);
  assert.match(baseCss, /html:not\(\.is-authenticated\)\s+\.clara-btn/);
  assert.match(html, /html:not\(\.is-authenticated\)\s+#btn-toggle-clara/);
  assert.match(html, /html:not\(\.is-authenticated\)\s+#btn-toggle-booking/);
});

await test("soporte de adjuntar foto clínica en panel 5 (tab 6)", () => {
  // Verificación en ficha-rules.mjs
  const blank = emptyFicha();
  assert.equal(blank.fotoUrl, "");
  assert.equal(validateField("fotoUrl", ""), null);
  assert.equal(validateField("fotoUrl", "/admin/api/foto.php?file=123.jpg"), null);
  assert.equal(validateStep(5, { anotaciones: "Prueba", fotoUrl: "/admin/api/foto.php?file=123.jpg" }).isValid, true);

  const sesA = { ...blank, fotoUrl: "" };
  const sesB = { ...blank, fotoUrl: "/admin/api/foto.php?file=abc.jpg" };
  const diff = compareFichas(sesA, sesB);
  const seccionAnotaciones = diff.sections.find((s) => s.id === "anotaciones");
  assert.ok(seccionAnotaciones, "Debe existir sección de anotaciones en compareFichas");
  const fieldFoto = seccionAnotaciones.fields.find((f) => f.label === "Foto clínica adjunta");
  assert.ok(fieldFoto, "Debe existir campo de Foto clínica adjunta");
  assert.equal(fieldFoto.changed, true);

  // Verificación en HTML (Panel 5 / Tab 6)
  assert.match(html, /data-panel="5"[\s\S]*id="foto-attachment-card"/);
  assert.match(html, /id="field-foto-url"/);
  assert.match(html, /id="foto-input"/);
  assert.match(html, /id="foto-dropzone"/);
  assert.match(html, /id="foto-preview-container"/);
  assert.match(html, /id="foto-preview-img"/);
  assert.match(html, /id="btn-foto-select"/);
  assert.match(html, /id="btn-foto-view"/);
  assert.match(html, /id="btn-foto-change"/);
  assert.match(html, /id="btn-foto-remove"/);

  // Verificación de Comparar Evolución e Historial (PDF) exclusivos en la última pestaña (Panel 5)
  assert.match(html, /data-panel="5"[\s\S]*id="btn-compare-form"/);
  assert.match(html, /data-panel="5"[\s\S]*id="btn-pdf-history"/);
  assert.doesNotMatch(html, /class="sheet"[\s\S]*id="btn-compare-form"[\s\S]*data-panel="0"/);

  // Verificación de seguridad en admin/api/foto.php
  const fotoPhp = fs.readFileSync(path.join(adminDir, "api/foto.php"), "utf8");
  assert.match(fotoPhp, /require_auth\(\)/, "foto.php debe exigir autenticación en GET y POST");
  assert.match(fotoPhp, /5 \* 1024 \* 1024/, "foto.php debe limitar tamaño a 5 MB");
  assert.match(fotoPhp, /IMAGETYPE_JPEG/, "foto.php debe verificar formatos de imagen válidos");
  assert.match(fotoPhp, /IMAGETYPE_PNG/);
  assert.match(fotoPhp, /IMAGETYPE_WEBP/);
  assert.match(fotoPhp, /Content-Type/, "foto.php debe enviar cabeceras binarias");

  // Verificación de protección en directorio de uploads
  const uploadsHtaccess = fs.readFileSync(path.join(adminDir, "uploads/.htaccess"), "utf8");
  assert.match(uploadsHtaccess, /Require all denied/, "admin/uploads/.htaccess debe bloquear acceso HTTP directo");

  // Verificación en fichas.php
  const fichasPhp = fs.readFileSync(path.join(adminDir, "api/fichas.php"), "utf8");
  assert.match(fichasPhp, /'fotoUrl'/, "fichas.php debe reconocer fotoUrl");
  assert.ok(fichasPhp.includes("foto.php") || fichasPhp.includes("api/foto"), "fichas.php debe validar la URL de la foto");
});

console.log(`admin robustez: ok (${passed} pruebas)`);
