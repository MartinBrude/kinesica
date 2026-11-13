import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Verificando implementación de nuevo rol Colaborador y corrección de lista de usuarios...");

function readApi(...files) {
  return files.map((f) => fs.readFileSync(path.join("admin/api", f), "utf8")).join("\n");
}

function readModulesMatching(prefix) {
  return fs
    .readdirSync("admin/modules")
    .filter((f) => f.startsWith(prefix) && f.endsWith(".js"))
    .map((f) => fs.readFileSync(path.join("admin/modules", f), "utf8"))
    .join("\n");
}

// 1. Verificar lib_auth (facade + siblings)
const libAuth = readApi("lib_auth.php", "lib_auth_require_auth.php", "lib_auth_seed_default_users.php");
assert.match(libAuth, /function is_colaborador/);
assert.match(libAuth, /'facundo'\s*=>\s*\[[^\]]*'name'\s*=>\s*'Facundo Vivardo'[^\]]*'role'\s*=>\s*'colaborador'/);
assert.match(libAuth, /facu86@gmail\.com/);
assert.doesNotMatch(
  libAuth,
  /if \(\$username === 'facundo'\) return 'colaborador'/,
  "user_role no debe elevar colaborador por nombre"
);
assert.match(libAuth, /ALTER TABLE users MODIFY COLUMN role VARCHAR/);

// 1b. Verificar que ensure_users_role_column NO ejecute seeds ni pise datos en cada petición
assert.ok(!libAuth.includes("UPDATE users SET email = 'facu86@gmail.com'"), "lib_auth.php no debe forzar el email de Facundo con UPDATE en cada petición");
assert.ok(!libAuth.includes("UPDATE users SET telefono = '+34 658 44 49 35'"), "lib_auth.php no debe forzar el teléfono de Martín con UPDATE en cada petición");
assert.ok(!/function ensure_users_role_column[^{]*\{[^}]*INSERT\s+INTO\s+users/s.test(libAuth), "ensure_users_role_column no debe insertar usuarios (seeds)");
assert.ok(!/function require_auth[^{]*\{[^}]*\bensure_users_role_column\(\s*\);/s.test(libAuth), "require_auth no debe ejecutar ensure_users_role_column en el camino normal");
assert.match(libAuth, /\.users_schema_migrated/, "ensure_users_role_column debe usar un archivo marcador para no repetir DDL");
const libPhp = fs.readFileSync("admin/api/lib.php", "utf8");
assert.ok(!libPhp.includes("ensure_users_role_column"), "lib.php no debe invocar ensure_users_role_column en resolve_username");

// 2. Verificar profesionales.php (+ post)
const profPhp = readApi("profesionales.php", "profesionales_post.php");
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

// 4. Verificar fichas.php (+ siblings)
const fichasPhp = readApi("fichas.php", "fichas_routes.php", "fichas_post.php");
assert.match(fichasPhp, /is_colaborador\(\$auth\)/);

// 5. Verificar pacientes.php (+ siblings si existen)
const pacientesFiles = ["pacientes.php", "pacientes_authenticate.php", "pacientes_routes_get.php", "pacientes_routes_post.php", "pacientes_routes_put_delete.php"]
  .filter((f) => fs.existsSync(path.join("admin/api", f)));
const pacientesPhp = readApi(...pacientesFiles);
assert.match(pacientesPhp, /is_colaborador\(\$auth\)/);

// 6. Verificar settings.php
const settingsPhp = fs.readFileSync("admin/api/settings.php", "utf8");
assert.match(settingsPhp, /is_colaborador\(\$user\)/);

// 7. Verificar interacciones.php (+ siblings)
const interaccionesPhp = fs
  .readdirSync("admin/api")
  .filter((f) => f === "interacciones.php" || f.startsWith("interacciones_"))
  .map((f) => fs.readFileSync(path.join("admin/api", f), "utf8"))
  .join("\n");
assert.match(interaccionesPhp, /is_colaborador\(\$auth/);

// 7b. Cola Instagram: colaboradores solo lectura (POST bloqueado)
const igColaPhp = fs.readFileSync("admin/api/instagram_cola.php", "utf8");
assert.match(igColaPhp, /is_colaborador\(\$auth\)/);

// 8. Verificar admin-profesionales (facade + siblings)
const adminProfJs = readModulesMatching("admin-profesionales");
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
const appTabsJs = readModulesMatching("app-tabs");
assert.match(appTabsJs, /user\.role !== "admin"/);

console.log("OK: rol colaborador + facades post-split");
