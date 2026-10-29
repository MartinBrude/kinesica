import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Verificando implementación de nuevo rol Colaborador y corrección de lista de usuarios...");

// 1. Verificar lib_auth.php
const libAuth = fs.readFileSync("admin/api/lib_auth.php", "utf8");
assert.match(libAuth, /function is_colaborador/);
assert.match(libAuth, /'facundo'\s*=>\s*\[[^\]]*'name'\s*=>\s*'Facundo Vivardo'[^\]]*'role'\s*=>\s*'colaborador'/);
assert.match(libAuth, /facu86@gmail\.com/);
assert.match(libAuth, /\$username\s*===\s*'facundo'/);
assert.match(libAuth, /ALTER TABLE users MODIFY COLUMN role VARCHAR/);

// 2. Verificar profesionales.php
const profPhp = fs.readFileSync("admin/api/profesionales.php", "utf8");
assert.match(profPhp, /'users'\s*=>\s*\$users/);
assert.match(profPhp, /'profesionales'\s*=>\s*\$users/);
assert.match(profPhp, /\$u\['name'\]\s*=/);
assert.match(profPhp, /colaborador/);

// 3. Verificar que profesionales_sync.php excluya a colaboradores de las opciones clínicas de WhatsApp
// y que NO requiera settings.php (evitando exit anticipado en GET)
const profSync = fs.readFileSync("admin/api/profesionales_sync.php", "utf8");
assert.match(profSync, /role != "colaborador"/);
assert.ok(!profSync.includes("require_once __DIR__ . '/settings.php'"), "profesionales_sync.php no debe requerir settings.php");
assert.match(profSync, /kinesica_settings_storage\.php/);

// 3b. Verificar inclusión segura de settings.php y lib_auth.php
const settingsPhpRaw = fs.readFileSync("admin/api/settings.php", "utf8");
assert.match(settingsPhpRaw, /KINESICA_SETTINGS_INCLUDED/);
assert.match(libAuth, /SHOW COLUMNS FROM users LIKE 'login_count'/);

// 4. Verificar fichas.php
const fichasPhp = fs.readFileSync("admin/api/fichas.php", "utf8");
assert.match(fichasPhp, /is_colaborador\(\$auth\)/);

// 5. Verificar pacientes.php
const pacientesPhp = fs.readFileSync("admin/api/pacientes.php", "utf8");
assert.match(pacientesPhp, /is_colaborador\(\$auth\)/);

// 6. Verificar settings.php
const settingsPhp = fs.readFileSync("admin/api/settings.php", "utf8");
assert.match(settingsPhp, /is_colaborador\(\$user\)/);

// 7. Verificar interacciones.php
const interaccionesPhp = fs.readFileSync("admin/api/interacciones.php", "utf8");
assert.match(interaccionesPhp, /is_colaborador\(\$auth/);

// 8. Verificar admin-profesionales.js
const adminProfJs = fs.readFileSync("admin/modules/admin-profesionales.js", "utf8");
assert.match(adminProfJs, /data\?\.profesionales/);
assert.match(adminProfJs, /data\?\.users/);
assert.match(adminProfJs, /prof\.role === "colaborador"/);
assert.match(adminProfJs, /Colaborador/);

// 9. Verificar index.html
const indexHtml = fs.readFileSync("admin/index.html", "utf8");
assert.match(indexHtml, /value="colaborador"/);
assert.ok(!indexHtml.includes("(María, Norberto o Martín)"), "no debe contener lista fija de usuarios en el gate");

// 10. Verificar admin-panel.css
const adminCss = fs.readFileSync("admin/css/admin-panel.css", "utf8");
assert.match(adminCss, /\.prof-role-badge\.colaborador/);

// 11. Verificar router.js y app-tabs.js
const appTabsJs = fs.readFileSync("admin/modules/app-tabs.js", "utf8");
assert.match(appTabsJs, /user\.role !== "admin"/);

console.log("✅ Todas las verificaciones del rol Colaborador y lista de usuarios pasaron correctamente.");
