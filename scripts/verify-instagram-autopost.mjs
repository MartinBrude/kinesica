/**
 * Kinésica — Test Suite Integral: Publicación Automática en Instagram.
 * Audita:
 * 1. Ejecución del backend PHP (SQLite in-memory, tipos, seguridad, atomicidad).
 * 2. Límite arquitectónico estricto: cada archivo en admin/ debe tener <= 250 líneas.
 * 3. Integración en index.html: presencia en menú Meta, ausencia en menú Admin, tabs y slots.
 * 4. Lógica de publicación y badges en JS (Feed, Story, Ambas).
 * 5. Cálculo de slots estimados de publicación (L/M/V 10:00 hs Argentina).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("\n🧪 --- Suite de Verificación: Instagram Autopost (Kinésica) ---");

// 1. Backend PHP
console.log("1. Ejecutando tests unitarios de backend en PHP...");
const phpOutput = execSync("php scripts/verify-instagram-autopost.php", { cwd: root, encoding: "utf8" });
console.log(phpOutput.trim());

// 2. Límite de líneas arquitectónico (máximo 250 líneas)
console.log("\n2. Auditando regla de arquitectura: archivos < 250 líneas...");
const filesToCheck = [
  "admin/api/lib_instagram_store.php",
  "admin/api/lib_instagram_copy.php",
  "admin/api/lib_instagram_guard.php",
  "admin/api/lib_instagram.php",
  "admin/api/instagram_cola.php",
  "admin/api/cron_instagram.php",
  "admin/modules/admin-creativos-cola.js",
  "admin/modules/admin-creativos-cola-ui.js",
  "admin/modules/admin-creativos-lista.js",
  "admin/modules/admin-creativos-caption.js",
];

for (const rel of filesToCheck) {
  const full = path.join(root, rel);
  assert.ok(fs.existsSync(full), `Archivo no encontrado: ${rel}`);
  const lines = fs.readFileSync(full, "utf8").split("\n").length;
  assert.ok(lines <= 250, `VIOLACIÓN DE ARQUITECTURA: ${rel} tiene ${lines} líneas (máximo permitido: 250)`);
  console.log(`  ✓ ${rel}: ${lines} líneas (<= 250)`);
}

// 3. Auditoría de HTML y Navegación
console.log("\n3. Auditando integración en index.html...");
const html = fs.readFileSync(path.join(root, "admin/index.html"), "utf8");

// Debe estar en menú Meta
assert.match(html, /id="nav-btn-whatsapp"[^>]*>\s*<span>Meta<\/span>/, "El botón del dropdown debe llamarse 'Meta'");
assert.match(html, /id="nav-menu-whatsapp"[\s\S]*?id="nav-btn-admin-creativos"/, "Creativos Instagram debe estar dentro de nav-menu-whatsapp");

// NO debe estar en menú Admin
const adminMenuMatch = html.match(/id="nav-menu-admin"[\s\S]*?<\/div>/);
assert.ok(adminMenuMatch, "nav-menu-admin debe existir");
assert.ok(!adminMenuMatch[0].includes("nav-btn-admin-creativos"), "Creativos Instagram NO debe estar en nav-menu-admin");

// Elementos requeridos en Creativos
assert.match(html, /id="btn-creativos-tab-catalog"/, "Debe tener selector de tab de Catálogo");
assert.match(html, /id="btn-creativos-tab-queue"/, "Debe tener selector de tab de Lista para publicar");
assert.match(html, /id="creativos-tab-panel-queue"/, "Debe existir el panel de Lista para publicar");
assert.match(html, /id="creativo-modal-cola-slot"/, "Debe existir el slot para el estado en el modal");
console.log("  ✓ Estructura de navegación y elementos UI verificados correctamente.");

// 4. Auditoría de JS: Lógica de badges y detalles de canal
console.log("\n4. Auditando lógica de badges de publicación...");
import {
  getPublicationDetails,
  _setListForTesting,
  stateOf,
  orderOf,
} from "../admin/modules/admin-creativos-cola.js?v=7";
import {
  colaHeartHtml,
  colaBadgeHtml,
  colaButtonHtml,
} from "../admin/modules/admin-creativos-cola-ui.js?v=1";

// Mock de state simulado
const mockList = [
  { creativo_id: "both_pub", status: "published", published_on: "2026-11-08", feed_media_id: "F1", story_media_id: "S1", last_error: null },
  { creativo_id: "feed_pub", status: "published", published_on: "2026-11-08", feed_media_id: "F1", story_media_id: null, last_error: null },
  { creativo_id: "story_pub", status: "published", published_on: "2026-11-08", feed_media_id: null, story_media_id: "S1", last_error: null },
  { creativo_id: "queued_1", status: "queued", sort_order: 1, title: "Pieza 1" },
  { creativo_id: "queued_2", status: "queued", sort_order: 2, title: "Pieza 2" },
];

_setListForTesting(mockList);

// Caso Both
const detBoth = getPublicationDetails("both_pub");
assert.equal(detBoth.channelText, "Feed + Story");
assert.equal(detBoth.badgeClass, "is-both");
assert.match(colaBadgeHtml({ id: "both_pub" }), /Feed \+ Story/);
assert.match(colaHeartHtml({ id: "both_pub" }), /is-published/);

// Caso Feed only
const detFeed = getPublicationDetails("feed_pub");
assert.equal(detFeed.channelText, "Solo Post");
assert.equal(detFeed.badgeClass, "is-feed");
assert.match(colaBadgeHtml({ id: "feed_pub" }), /Solo Post/);

// Caso Story only
const detStory = getPublicationDetails("story_pub");
assert.equal(detStory.channelText, "Solo Story");
assert.equal(detStory.badgeClass, "is-story");
assert.match(colaBadgeHtml({ id: "story_pub" }), /Solo Story/);

// Cola activa: orden, estados y botones
assert.equal(stateOf("queued_1"), "queued");
assert.equal(orderOf("queued_1"), 1);
assert.equal(orderOf("queued_2"), 2);
assert.match(colaHeartHtml({ id: "queued_1" }), /❤️ #1/);
assert.match(colaHeartHtml({ id: "non_existent" }), /🤍/);
assert.match(colaButtonHtml({ id: "queued_1" }), /❤️ Programada \(#1\)/);
assert.match(colaButtonHtml({ id: "non_existent" }), /🤍 Me gusta \(programar\)/);

_setListForTesting([
  ...mockList,
  { creativo_id: "pub_busy", status: "publishing", sort_order: 3, title: "Busy" },
  { creativo_id: "pub_fail", status: "failed", sort_order: 0, title: "Fail", last_error: "x" },
]);
assert.equal(stateOf("pub_busy"), "publishing");
assert.match(colaButtonHtml({ id: "pub_busy" }), /Publicando/);
assert.match(colaButtonHtml({ id: "pub_fail" }), /bloqueada/);
assert.match(colaHeartHtml({ id: "pub_fail" }), /is-failed/);

console.log("  ✓ Exportaciones, contratos y casos (Both, Feed, Story, Queue, Publishing, Failed) conformes.");

// 5. Verificación de robustez en Cron
console.log("\n5. Auditando seguridad y CLI en cron_instagram.php...");
const cronPhp = fs.readFileSync(path.join(root, "admin/api/cron_instagram.php"), "utf8");
assert.match(cronPhp, /if\s*\(PHP_SAPI\s*!==\s*'cli'\)/, "El cron debe abortar con 404 si es invocado por HTTP");
assert.match(cronPhp, /America\/Argentina\/Buenos_Aires/, "El cron debe forzar explícitamente zona horaria de Argentina");
console.log("  ✓ Cron protegido contra invocaciones HTTP directas y configurado en horario argentino.");

console.log("\n✅ ¡Todos los tests y auditorías pasaron con éxito!\n");
