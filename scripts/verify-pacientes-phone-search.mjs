import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
const pac = readdirSync("admin/modules")
  .filter((f) => f === "pacientes.js" || (f.startsWith("pacientes-") && f.endsWith(".js")))
  .map((f) => readFileSync(`admin/modules/${f}`, "utf8"))
  .join("\n");
assert.match(pac, /phoneMatches\(p\.telefono, query\)/);
assert.match(pac, /phoneMatches\(p\.contacto_telefono, query\)/);
assert.match(pac, /formatPatientName/);
assert.match(pac, /phoneRequired/);
assert.match(pac, /button\.btn-encuesta-invite\[data-id\]/);
assert.match(pac, /pointer-events:none/);
assert.doesNotMatch(pac, /btn-encuesta-invite" title="Sin teléfono/);

// Verificar formato de nombre "Nombre Apellido" y capitalización solo inicial
import { formatPatientName } from "../admin/modules/pacientes-name.js";
import { capitalizePersonName, sanitizePersonName } from "../admin/ficha-rules.mjs";

assert.equal(formatPatientName({ apellido: "Pérez", nombre: "Juan Carlos" }).display, "Juan Carlos Pérez");
assert.equal(formatPatientName({ nombre_completo: "Ana Clara Gómez" }).display, "Ana Clara Gómez");
assert.equal(formatPatientName({ apellido: "PÉREZ", nombre: "JUAN CARLOS" }).display, "Juan Carlos Pérez");
assert.equal(formatPatientName({ apellido: "pérez", nombre: "juan carlos" }).display, "Juan Carlos Pérez");
assert.equal(formatPatientName({ nombre_completo: "FLORENCIA MARÍA GONZÁLEZ" }).display, "Florencia María González");
assert.equal(formatPatientName({ apellido: "d'alessandro", nombre: "maría-laura" }).display, "María-Laura D'Alessandro");
assert.equal(formatPatientName({ nombre_completo: "álvarez" }).display, "Álvarez");
assert.equal(formatPatientName({ nombre_completo: "Walter Mira" }).display, "Walter Mira");
assert.equal(formatPatientName({ nombre_completo: "Mira, Walter" }).display, "Walter Mira");
assert.equal(formatPatientName({ apellido: "Mira", nombre: "Walter" }).display, "Walter Mira");
// Campos invertidos respecto del nombre completo "Nombre Apellido"
assert.equal(formatPatientName({ nombre_completo: "Walter Mira", apellido: "Walter", nombre: "Mira" }).display, "Walter Mira");
assert.equal(formatPatientName({ nombre_completo: "Walter Mira", apellido: "Walter", nombre: "Mira" }).nombre, "Walter");
assert.equal(formatPatientName({ nombre_completo: "Walter Mira", apellido: "Walter", nombre: "Mira" }).apellido, "Mira");
// Mapa conocido Calendar "Apellido Nombre" (Mira Walter → Walter Mira)
assert.equal(formatPatientName({ nombre_completo: "Mira Walter", apellido: "Walter", nombre: "Mira" }).display, "Walter Mira");
assert.equal(formatPatientName({ apellido: "Walter", nombre: "Mira" }).display, "Walter Mira");
assert.equal(formatPatientName({ apellido: "Mira", nombre: "Walter" }).display, "Walter Mira");

assert.equal(capitalizePersonName("FLORENCIA"), "Florencia");
assert.equal(capitalizePersonName("gonzález"), "González");
assert.equal(capitalizePersonName("MARÍA LAURA"), "María Laura");
assert.equal(capitalizePersonName("juan-carlos"), "Juan-Carlos");
assert.equal(capitalizePersonName("d'alessandro"), "D'Alessandro");
assert.equal(sanitizePersonName("  FLORENCIA, GONZALEZ 👍\r\n"), "Florencia Gonzalez");

// Verificar permisos de eliminación + gates de token/admin en pacientes.php
const pacPhp = readdirSync("admin/api")
  .filter((f) => f === "pacientes.php" || (f.startsWith("pacientes_") && f.endsWith(".php")))
  .map((f) => readFileSync(`admin/api/${f}`, "utf8"))
  .join("\n");
assert.match(pacPhp, /can_use_admin_booking\(\$auth\)/);
assert.match(pacPhp, /Actualizar un paciente requiere sesión/);
assert.match(pacPhp, /tokenAllowedGet/);
assert.match(pacPhp, /\$tokenAllowedGet\s*=\s*\['waitlist'\]/);
assert.match(pacPhp, /'get_email_by_phone'/);
assert.ok(
  /\$sessionOnlyActions\s*=\s*\[[^\]]*['"]get_email_by_phone['"]/s.test(pacPhp),
  "get_email_by_phone debe ser session-only en POST"
);
assert.match(pacPhp, /send_email.*send_fallback_email|send_fallback_email.*send_email/);
assert.match(pacPhp, /Solo un administrador con sesión puede realizar esta acción/);
assert.match(pacPhp, /Ese teléfono ya está asignado a otro paciente/);
assert.ok(!pacPhp.includes("asignado al paciente ' . $existing"), "409 no debe revelar nombre_completo");
assert.match(pacPhp, /kinesica_pacientes_require_alive/);
assert.match(pacPhp, /kinesica_whatsapp_client_safe_result/);
assert.ok(
  !/['"]wa['"]\s*=>\s*\$waResult/.test(pacPhp),
  "encuesta no debe devolver \$waResult crudo al cliente"
);

const turnosPhp = readFileSync("admin/api/turnos.php", "utf8");
assert.match(turnosPhp, /gas_api_secret/);
assert.ok(!/getenv\s*\(\s*['"]KINESICA_BACKUP_SECRET['"]/.test(turnosPhp), "turnos.php no debe aceptar KINESICA_BACKUP_SECRET");
const turnosAuthFn = turnosPhp.split("function kinesica_turnos_api_authorized")[1] || "";
assert.ok(!/['"]install_token['"]/.test(turnosAuthFn), "turnos secret auth no debe aceptar install_token");

const authPhp = readFileSync("admin/api/pacientes_authenticate.php", "utf8");
assert.ok(
  !/\$config\[['\"]install_token['\"]\]/.test(authPhp),
  "pacientes_authenticate no debe caer a install_token"
);
assert.match(authPhp, /webhook_secret/, "pacientes_authenticate usa webhook_secret");
assert.match(authPhp, /bot_token\.sha256/, "pacientes_authenticate acepta bot_token.sha256");

const campanaFlag = readFileSync("admin/api/campana_turnos_campana_upsert_flag.php", "utf8");
assert.match(campanaFlag, /kinesica_pacientes_alive_sql/, "campaña upsert respeta alive SQL");
assert.match(campanaFlag, /kinesica_pacientes_require_alive/, "campaña upsert exige paciente vivo");
assert.match(
  campanaFlag,
  /kinesica_pacientes_find_soft_deleted_by_phone/,
  "campaña upsert revive soft-deleted por teléfono"
);
assert.match(campanaFlag, /deleted_at\s*=\s*NULL/, "campaña ON DUPLICATE limpia deleted_at");

const routesPost = readFileSync("admin/api/pacientes_routes_post.php", "utf8");
assert.match(
  routesPost,
  /kinesica_pacientes_release_soft_deleted_phone/,
  "update_phone libera teléfono soft-deleted"
);
const campanaMatch = readFileSync("admin/api/campana_turnos_campana_match_paciente.php", "utf8");
assert.ok(
  /viene_de_campana[\s\S]*:\s*false/.test(campanaMatch),
  "campaña match default viene_de_campana=false si falta columna"
);

const waPhp = readFileSync("admin/api/lib_whatsapp.php", "utf8");
assert.ok(!waPhp.includes("1340013275870491"), "lib_whatsapp no hardcodea Phone Number ID");
assert.match(waPhp, /Falta WHATSAPP_PHONE_NUMBER_ID/, "send_whatsapp_text exige phone_number_id");

const html = readFileSync("admin/index.html", "utf8");
assert.ok(!html.includes("(A, B, D)"), "el subtítulo no debe decir (A, B, D)");
assert.ok(html.includes("respuestas automáticas (A, B, C, D y E)"));
assert.match(html, /Nombre y apellido/);
assert.match(html, /app\.js\?v=\d+/);
console.log("pacientes (búsqueda por teléfono, orden por apellido, permisos DELETE) y subtítulo del admin: ok");
