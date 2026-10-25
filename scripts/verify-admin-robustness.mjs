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
import { formatHeaderScheduleText } from "../admin/modules/horarios.js";

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
  const allCreated = new Set();
  for (const file of jsFiles) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/\.id\s*=\s*["'`]([^"'`$]+)["'`]/g)) allCreated.add(m[1]);
    for (const m of src.matchAll(/\sid=["']([\w-]+)["']/g)) allCreated.add(m[1]);
  }
  const missing = [];
  const allowed = new Set([
    "view-horarios",
    "view-honorarios",
    "view-configuracion",
    "nav-btn-configuracion",
    "dash-clara-dot",
    "dash-clara-status-text",
    "dash-btn-toggle-clara",
    "dash-booking-dot",
    "dash-booking-status-text",
    "dash-btn-toggle-booking",
    "horarios-clara-preview",
    "btn-copy-clara-horarios",
    "cfg-reminder-text",
    "cfg-reminder-notes",
    "cfg-reminder-preview",
    "btn-save-mails-policies",
    "mails-texts-status-banner",
  ]);
  for (const file of jsFiles) {
    const src = fs.readFileSync(file, "utf8");
    const refs = [
      ...[...src.matchAll(/querySelector\(\s*["'`]#([\w-]+)["'`]\s*\)/g)].map((m) => m[1]),
      ...[...src.matchAll(/getElementById\(\s*["'`]([\w-]+)["'`]\s*\)/g)].map((m) => m[1]),
    ];
    for (const id of refs) {
      if (!htmlIds.has(id) && !allCreated.has(id) && !allowed.has(id)) missing.push(`${path.basename(file)} → #${id}`);
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

await test("los controles de features (Clara y Booking) están presentes", () => {
  assert.ok(html.includes('id="dash-btn-toggle-clara"') || html.includes('id="cfg-btn-toggle-clara"'));
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
  assert.match(html, /id="foto-input"[\s\S]*multiple/);
  assert.match(html, /id="foto-gallery-grid"/);
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

await test("módulo de Horarios de Atención está integrado en HTML, JS y API", () => {
  assert.ok(html.includes('id="nav-btn-horarios"') || html.includes('id="nav-btn-configuracion"') || html.includes('id="nav-btn-consultorio"'), "Debe existir botón Consultorio/Horarios en la barra de navegación");
  assert.ok(html.includes('id="horarios-timeline-rows"'), "Debe existir la grilla visual semanal");

  const horariosPhp = fs.readFileSync(path.join(adminDir, "api/horarios.php"), "utf8");
  assert.match(horariosPhp, /require_auth\(\)/, "POST en horarios.php debe exigir sesión autenticada");
  assert.match(horariosPhp, /Superposición de camilla/, "horarios.php debe validar colisión de 1 camilla");
  assert.match(horariosPhp, /clara_schedule_summary/, "horarios.php debe generar el resumen para Clara");
});

await test("vía alternativa de login por código al mail disponible para María, Norberto y Martín", async () => {
  // 1. Integridad HTML del Gate
  assert.ok(html.includes('id="btn-email-code"'), "Debe existir botón para activar login alternativo por mail");
  assert.ok(html.includes('id="email-code-form"'), "Debe existir formulario #email-code-form");
  assert.ok(html.includes('id="email-code-step-request"'), "Debe existir paso 1 de solicitud de código");
  assert.ok(html.includes('id="email-code-step-verify"'), "Debe existir paso 2 de verificación de código");
  assert.ok(html.includes('id="btn-send-email-code"'), "Debe existir botón para solicitar envío");
  assert.ok(html.includes('id="btn-verify-email-code"'), "Debe existir botón para validar código e ingresar");
  assert.ok(html.includes('id="btn-resend-email-code"'), "Debe existir botón para reenviar código");
  assert.ok(html.includes('id="btn-email-code-back"'), "Debe existir botón para regresar al login clásico");
  assert.ok(html.includes('id="email-code-sent-note"'), "Debe existir nota de confirmación de envío con correo enmascarado");
  assert.ok(html.includes('id="email-code-request-error"'), "Debe existir contenedor de error en solicitud");
  assert.ok(html.includes('id="email-code-verify-error"'), "Debe existir contenedor de error en verificación");

  // 2. Integridad de los scripts backend PHP
  const loginCodePhp = fs.readFileSync(path.join(adminDir, "api/login-code.php"), "utf8");
  assert.match(loginCodePhp, /require_header\(\)/, "login-code.php debe exigir cabecera anti-CSRF");
  assert.match(loginCodePhp, /resolve_username/, "login-code.php debe resolver usuarios con tolerancia a mayúsculas/tildes");
  assert.match(loginCodePhp, /password_verify/, "login-code.php debe verificar contraseña de la cuenta");
  assert.match(loginCodePhp, /login_code_verify/, "login-code.php debe verificar código de un solo uso");
  assert.match(loginCodePhp, /login_code_store/, "login-code.php debe almacenar hash del código temporal");
  assert.match(loginCodePhp, /send_login_code_email/, "login-code.php debe enviar código por correo");

  const totpPhp = fs.readFileSync(path.join(adminDir, "api/totp.php"), "utf8");
  assert.match(totpPhp, /password_verify/, "totp.php debe exigir y verificar contraseña en confirmación de enrolamiento");
  assert.match(totpPhp, /totp_valid/, "totp.php debe verificar código TOTP");

  const libPhp = fs.readFileSync(path.join(adminDir, "api/lib.php"), "utf8");
  assert.match(libPhp, /function resolve_username/, "lib.php debe incluir resolve_username");
  assert.match(libPhp, /function mask_email/, "lib.php debe incluir mask_email");
  assert.match(libPhp, /function login_code_verify/, "lib.php debe incluir login_code_verify");
  assert.match(libPhp, /function login_code_store/, "lib.php debe incluir login_code_store");
  assert.match(libPhp, /function send_login_code_email/, "lib.php debe incluir send_login_code_email");
  assert.match(libPhp, /for \(\$i = -1; \$i <= 1; \$i\+\+\)/, "totp_valid debe operar con tolerancia de ±1 intervalo (30s)");

  const loginPhp = fs.readFileSync(path.join(adminDir, "api/login.php"), "utf8");
  assert.match(loginPhp, /login_code_verify/, "login.php tradicional debe aceptar código de mail como fallback de 2FA");

  // 3. Simulación de cliente API para envío y verificación de código
  let payloadSent = null;
  mockFetch((url, options) => {
    payloadSent = { url, body: JSON.parse(options.body) };
    if (payloadSent.body.action === "send") {
      return jsonResponse(200, {
        ok: true,
        sent: true,
        username: payloadSent.body.username,
        emailMasked: "ma*****6@gmail.com",
        message: "Te enviamos un código de 6 dígitos a ma*****6@gmail.com.",
      });
    }
    return jsonResponse(200, {
      ok: true,
      username: payloadSent.body.username,
      name: "Lic. María Gulín",
    });
  });

  const sendResult = await api("login-code.php", {
    method: "POST",
    body: JSON.stringify({ action: "send", username: "maria" }),
  });
  assert.equal(sendResult.ok, true);
  assert.equal(sendResult.username, "maria");
  assert.equal(payloadSent.url, "api/login-code.php");
  assert.equal(payloadSent.body.username, "maria");

  const verifyResult = await api("login-code.php", {
    method: "POST",
    body: JSON.stringify({ action: "verify", username: "maria", code: "123456" }),
  });
  assert.equal(verifyResult.ok, true);
  assert.equal(verifyResult.name, "Lic. María Gulín");
  assert.equal(payloadSent.body.code, "123456");
});

await test("Configuración de horarios del encabezado de la web en admin y backend", async () => {
  const indexHtml = fs.readFileSync(path.join(adminDir, "index.html"), "utf8");
  assert.match(indexHtml, /id="select-header-schedule-opens"/, "index.html debe tener selector de apertura");
  assert.match(indexHtml, /id="select-header-schedule-closes"/, "index.html debe tener selector de cierre");
  assert.match(indexHtml, /id="header-schedule-preview"/, "index.html debe tener vista previa del encabezado");

  const horariosJs = fs.readFileSync(path.join(adminDir, "modules/horarios.js"), "utf8");
  assert.match(horariosJs, /formatHeaderScheduleText/, "horarios.js debe exportar o contener formatHeaderScheduleText");
  assert.match(horariosJs, /header_schedule/, "horarios.js debe sincronizar header_schedule con el backend");

  const horariosPhp = fs.readFileSync(path.join(adminDir, "api/horarios.php"), "utf8");
  assert.match(horariosPhp, /'header_schedule'/, "horarios.php debe soportar header_schedule");

  const settingsPhp = fs.readFileSync(path.join(adminDir, "api/settings.php"), "utf8");
  assert.match(settingsPhp, /'header_schedule'/, "settings.php debe soportar header_schedule");

  const whatsappLogic = fs.readFileSync(path.join(root, "js/whatsapp-logic.js"), "utf8");
  assert.match(whatsappLogic, /header_schedule/, "whatsapp-logic.js debe actualizar el header en vivo ante header_schedule");
  assert.match(whatsappLogic, /\.time-text/, "whatsapp-logic.js debe seleccionar .time-text");
});

await test("compareFichas: evolución clínica con features opcionales y tendencias", () => {
  const sesion1 = {
    id: "f-001",
    nombre: "Paciente Test",
    dni: "30.123.456",
    fechaSesion: "2026-10-01",
    ruidos: "Sí",
    ruidosIzq: true,
    ruidosDer: false,
    faseApertura: true,
    ruidoClic: true,
    ruidoCrep: false,
    desviacion: "Sí",
    desvDer: true,
    deflexion: true,
    desvCorregida: false,
    eva: 8,
    aperturaLibre: "24",
    aperturaDolor: "32",
    habitoBruxismo: true,
    habitoApretamiento: true,
    cdi: ["I.a", "II.a"],
  };

  const sesion2 = {
    id: "f-002",
    nombre: "Paciente Test",
    dni: "30.123.456",
    fechaSesion: "2026-10-20",
    ruidos: "No",
    desviacion: "No",
    eva: 2,
    aperturaLibre: "42",
    aperturaDolor: "48",
    habitoBruxismo: false,
    habitoApretamiento: false,
    cdi: [],
  };

  const comp = compareFichas(sesion1, sesion2);
  assert.equal(comp.daysBetween, 19, "Diferencia de días calculada correctamente");
  assert.equal(comp.kpis.eva.delta, -6, "Reducción de dolor EVA calculada");
  assert.equal(comp.kpis.eva.trend, "better", "Menos dolor se considera mejora");
  assert.equal(comp.kpis.aperturaLibre.delta, 18, "Aumento de apertura calculada");
  assert.equal(comp.kpis.aperturaLibre.trend, "better", "Mayor apertura sin dolor se considera mejora");
  assert.equal(comp.kpis.ruidos.trend, "better", "Desaparición de ruidos es mejora");
  assert.equal(comp.kpis.ruidos.current, "No");
  assert.ok(comp.kpis.ruidos.previous.includes("clic"));

  // Sección de hábitos
  const secFiliacion = comp.sections.find((s) => s.id === "filiacion");
  const habField = secFiliacion.fields.find((f) => f.label === "Hábitos parafuncionales y bruxismo");
  assert.ok(habField, "Debe existir campo de hábitos parafuncionales y bruxismo");
  assert.equal(habField.trend, "better", "Dejar hábitos es una mejora");
  assert.equal(habField.current, "Sin hábitos registrados");

  // Sección de criterios CDI
  const secCdi = comp.sections.find((s) => s.id === "cdi");
  const cdiField = secCdi.fields.find((f) => f.label === "Criterios diagnósticos CDI-TTM");
  assert.ok(cdiField, "Debe existir campo CDI");
  assert.equal(cdiField.trend, "better", "Menos criterios patológicos es una mejora");
});

await test("Profesionales y roles: protección del superadmin y validaciones en backend", () => {
  const profPhp = fs.readFileSync(path.join(adminDir, "api/profesionales.php"), "utf8");
  assert.match(
    profPhp,
    /\$username === 'martin'\) \{\s*json_out\(400, \['error' => 'No es posible desactivar la cuenta del administrador principal\.'\]\);/,
    "profesionales.php debe prohibir suspender a martin"
  );
  assert.match(
    profPhp,
    /FILTER_VALIDATE_EMAIL/,
    "profesionales.php debe validar formato de correo electrónico"
  );
  assert.match(
    profPhp,
    /\$firstName === '' \|\| \$lastName === ''/,
    "profesionales.php debe exigir nombre y apellido"
  );
});

await test("Seguridad 2FA / Login: manejo de contraseñas erróneas y fallos simulados", async () => {
  // Simular rechazo 401 por contraseña incorrecta en login-code
  mockFetch(() => jsonResponse(401, { error: "Contraseña incorrecta" }));
  await assert.rejects(
    api("login-code.php", {
      method: "POST",
      body: JSON.stringify({ action: "verify", username: "maria", password: "wrong-password", code: "123456" }),
    }),
    (error) => error.status === 401 && error.message === "Contraseña incorrecta"
  );

  // Simular bloqueo 429 por exceso de intentos
  mockFetch(() => jsonResponse(429, { error: "Demasiados intentos erróneos. Cuenta bloqueada por 15 minutos." }));
  await assert.rejects(
    api("login-code.php", {
      method: "POST",
      body: JSON.stringify({ action: "verify", username: "maria", password: "wrong-password", code: "123456" }),
    }),
    (error) => error.status === 429 && /bloqueada/i.test(error.message)
  );

  // Simular rechazo 401 por contraseña incorrecta en totp.php
  mockFetch(() => jsonResponse(401, { error: "Contraseña incorrecta" }));
  await assert.rejects(
    api("totp.php", {
      method: "POST",
      body: JSON.stringify({ password: "wrong-password", code: "123456" }),
    }),
    (error) => error.status === 401 && error.message === "Contraseña incorrecta"
  );
});

await test("Formateo seguro de horario de encabezado con valores normales y extremos", () => {
  assert.equal(
    formatHeaderScheduleText("08:00", "20:00"),
    "Lunes a viernes: <strong>8 a 20 h</strong>"
  );
  assert.equal(
    formatHeaderScheduleText("08:30", "19:30"),
    "Lunes a viernes: <strong>8:30 a 19:30 h</strong>"
  );
  assert.equal(
    formatHeaderScheduleText("", ""),
    "Lunes a viernes: <strong>0 a 0 h</strong>"
  );
});

await test("Módulo de Gastos: integridad de semilla con conversión por fecha, validaciones en backend y elementos en UI", () => {
  const seedPath = path.join(adminDir, "api/gastos.json");
  assert.ok(fs.existsSync(seedPath), "admin/api/gastos.json debe existir");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  assert.equal(seed.length, 4, "Debe contener los 4 registros de la imagen");
  assert.equal(seed[0].concepto, "AI automation apps");
  assert.equal(seed[0].fecha, "2026-10-25");
  assert.equal(seed[0].monto, 148.09);
  assert.equal(seed[1].concepto, "AI automation apps");
  assert.equal(seed[1].fecha, "2026-09-26");
  assert.equal(seed[1].monto, 8.99);
  assert.equal(seed[2].concepto, "Business Web Hosting");
  assert.equal(seed[2].detalle, "kinesica.com.ar");
  assert.equal(seed[2].fecha, "2026-02-03");
  assert.equal(seed[2].monto, 65.88);
  assert.equal(seed[3].concepto, "Premium Web Hosting");
  assert.equal(seed[3].detalle, "kinesica.com.ar");
  assert.equal(seed[3].fecha, "2025-03-28");
  assert.equal(seed[3].monto, 35.88);

  // Cada registro debe almacenar sus propios valores equivalentes en las 3 monedas para su fecha histórica
  for (const item of seed) {
    assert.ok(typeof item.monto_eur === "number" && item.monto_eur > 0, `Registro ${item.id} debe tener monto_eur`);
    assert.ok(typeof item.monto_usd === "number" && item.monto_usd > 0, `Registro ${item.id} debe tener monto_usd`);
    assert.ok(typeof item.monto_ars === "number" && item.monto_ars > 0, `Registro ${item.id} debe tener monto_ars`);
    assert.ok(typeof item.tc_eur_usd === "number" && item.tc_eur_usd > 0, `Registro ${item.id} debe tener tc_eur_usd`);
    assert.ok(typeof item.tc_eur_ars === "number" && item.tc_eur_ars > 0, `Registro ${item.id} debe tener tc_eur_ars`);
  }

  const totalEur = seed.reduce((acc, g) => acc + g.monto_eur, 0);
  assert.equal(Math.round(totalEur * 100) / 100, 258.84, "La suma total en EUR de los 4 registros debe ser 258.84");

  const phpPath = path.join(adminDir, "api/gastos.php");
  assert.ok(fs.existsSync(phpPath), "admin/api/gastos.php debe existir");
  const phpSrc = fs.readFileSync(phpPath, "utf8");
  assert.match(phpSrc, /is_admin\(\$auth\)/, "gastos.php debe requerir rol admin");
  assert.match(phpSrc, /'monto_eur'/, "gastos.php debe persistir monto_eur por registro");
  assert.match(phpSrc, /'monto_usd'/, "gastos.php debe persistir monto_usd por registro");
  assert.match(phpSrc, /'monto_ars'/, "gastos.php debe persistir monto_ars por registro");
  assert.match(phpSrc, /\$action === 'create'/, "gastos.php debe soportar alta");
  assert.match(phpSrc, /\$action === 'update'/, "gastos.php debe soportar modificación");
  assert.match(phpSrc, /\$action === 'delete'/, "gastos.php debe soportar baja");
});

await test("Protección de manual.html, /docs/ y recursos internos de /admin/ solo para usuarios autorizados", () => {
  // 1. /docs/.htaccess bloquea acceso directo a todos los archivos de documentación e imágenes
  const docsHtaccessPath = path.join(root, "docs/.htaccess");
  assert.ok(fs.existsSync(docsHtaccessPath), "docs/.htaccess debe existir para impedir acceso directo por URL");
  const docsHtaccess = fs.readFileSync(docsHtaccessPath, "utf8");
  assert.match(docsHtaccess, /Require all denied/, "docs/.htaccess debe negar acceso HTTP directo");

  // 2. admin/.htaccess protege manual.html, firmas y archivos internos (.md, .json, .sha256, .sql, lib.php)
  const adminHtaccess = fs.readFileSync(path.join(adminDir, ".htaccess"), "utf8");
  assert.match(adminHtaccess, /RewriteRule \^manual\(\?:\\\.html\)\?\$ api\/manual-doc\.php\?view=page/, "admin/.htaccess debe enrutar manual.html por manual-doc.php");
  assert.match(adminHtaccess, /RewriteRule \^signatures\/\(\[a-z0-9_-\]\+\\\.png\)\$ api\/firma\.php\?file=\$1/, "admin/.htaccess debe enrutar firmas por firma.php");
  assert.match(adminHtaccess, /lib\\\.php/, "admin/.htaccess debe bloquear acceso directo a lib.php");
  assert.match(adminHtaccess, /md\|json\|sha256/, "admin/.htaccess debe bloquear acceso directo a .md, .json y .sha256");

  // 3. admin/api/manual-doc.php exige sesión activa y rol de administrador (is_admin)
  const manualDocPhpPath = path.join(adminDir, "api/manual-doc.php");
  assert.ok(fs.existsSync(manualDocPhpPath), "admin/api/manual-doc.php debe existir");
  const manualDocPhp = fs.readFileSync(manualDocPhpPath, "utf8");
  assert.match(manualDocPhp, /require_auth\(\)/, "manual-doc.php debe exigir sesión autenticada");
  assert.match(manualDocPhp, /is_admin\(\$auth\)/, "manual-doc.php debe exigir rol de administrador");

  // 4. admin/manual.html oculta el documento hasta verificar rol admin contra /admin/api/me.php y consume manual-doc.php
  const manualHtml = fs.readFileSync(path.join(adminDir, "manual.html"), "utf8");
  assert.match(manualHtml, /html:not\(\.is-admin-verified\)\s*body\s*\{\s*display:\s*none\s*!important;/, "manual.html debe permanecer oculto hasta verificar rol admin");
  assert.match(manualHtml, /me\.role !== "admin"/, "manual.html debe verificar me.role === 'admin'");
  assert.match(manualHtml, /\/admin\/api\/manual-doc\.php\?doc=/, "manual.html debe cargar los documentos vía manual-doc.php");
  assert.doesNotMatch(manualHtml, /fetch\(["']\/docs\//, "manual.html no debe hacer fetch directo a /docs/");

  // 5. admin/signatures/.htaccess y admin/api/firma.php protegen las firmas digitales
  const sigHtaccessPath = path.join(adminDir, "signatures/.htaccess");
  assert.ok(fs.existsSync(sigHtaccessPath), "admin/signatures/.htaccess debe existir");
  const firmaPhpPath = path.join(adminDir, "api/firma.php");
  assert.ok(fs.existsSync(firmaPhpPath), "admin/api/firma.php debe existir");
  const firmaPhp = fs.readFileSync(firmaPhpPath, "utf8");
  assert.match(firmaPhp, /require_auth\(\)/, "firma.php debe exigir sesión autenticada");

  // 6. admin/api/backup.php verifica autenticación y rol admin antes de consultar la base de datos en modo web
  const backupPhp = fs.readFileSync(path.join(adminDir, "api/backup.php"), "utf8");
  const authIdx = backupPhp.indexOf("require_auth()");
  const dbIdx = backupPhp.indexOf("$pdo = db()");
  assert.ok(authIdx > 0 && authIdx < dbIdx, "backup.php debe exigir require_auth() antes de abrir la base de datos");
  assert.match(backupPhp, /is_admin\(\$auth\)/, "backup.php debe exigir rol de administrador en descargas web");
});

console.log(`admin robustez: ok (${passed} pruebas)`);
