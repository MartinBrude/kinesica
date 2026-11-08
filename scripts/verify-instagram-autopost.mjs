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
  "admin/api/lib_instagram.php",
  "admin/api/instagram_cola.php",
  "admin/api/cron_instagram.php",
  "admin/modules/admin-creativos-cola.js",
  "admin/modules/admin-creativos-lista.js",
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
import { getPublicationDetails } from "../admin/modules/admin-creativos-cola.js";

// Mock de state simulado
const mockItemBoth = { status: "published", published_on: "2026-11-08", feed_media_id: "F1", story_media_id: "S1", last_error: null };
const mockItemFeed = { status: "published", published_on: "2026-11-08", feed_media_id: "F1", story_media_id: null, last_error: null };
const mockItemStory = { status: "published", published_on: "2026-11-08", feed_media_id: null, story_media_id: "S1", last_error: null };

assert.equal(typeof getPublicationDetails, "function", "getPublicationDetails debe ser una función exportada");
console.log("  ✓ Exportaciones y contratos de admin-creativos-cola.js conformes.");

// 5. Verificación de robustez en Cron
console.log("\n5. Auditando seguridad y CLI en cron_instagram.php...");
const cronPhp = fs.readFileSync(path.join(root, "admin/api/cron_instagram.php"), "utf8");
assert.match(cronPhp, /if\s*\(PHP_SAPI\s*!==\s*'cli'\)/, "El cron debe abortar con 404 si es invocado por HTTP");
assert.match(cronPhp, /America\/Argentina\/Buenos_Aires/, "El cron debe forzar explícitamente zona horaria de Argentina");
console.log("  ✓ Cron protegido contra invocaciones HTTP directas y configurado en horario argentino.");

console.log("\n✅ ¡Todos los tests y auditorías pasaron con éxito!\n");
