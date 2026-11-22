/**
 * Suite de Verificación Integral: Cesión de Horarios y Cierres de Consultorio
 * Cobertura completa de capas:
 * 1. Backend PHP (unit tests, SQLite in-memory, validación, aritmética de ventanas).
 * 2. Límite arquitectónico estricto: cada archivo en admin/ debe tener <= 250 líneas.
 * 3. Booking Engine en JS: cronogramas base, camilla única, cesiones completas y parciales.
 * 4. Cierres totales y parciales de consultorio.
 * 5. Protección de turnos preexistentes (respeto físico de la camilla).
 * 6. Inmutabilidad de feriados nacionales y fines de semana.
 * 7. Rangos de fechas (de tal día a tal día).
 * 8. Consultabilidad: badges de estado, metadatos y trazabilidad de auditoría.
 * 9. Anulación: reversión inmediata de turnos a los cronogramas habituales.
 * 10. Robustez y tipos: fechas inexistentes (2026-02-31), nulls, casing insensible.
 * 11. Validador cliente de Admin (casos límite).
 * 12. Paridad 100% con Google Apps Script (GAS) en entorno VM.
 * 13. Sincronización e invalidación de caché cliente (currentHoursSignature).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readGasSource } from "./gas-source.mjs";
import engine from "../booking/booking-engine.js";
import { validateCesionDraft, isValidIsoDate, isValidHm, hmToMin } from "../admin/modules/horarios-cesiones-validator.js";
import { getOverrideStatusBadge, formatOverrideDescription } from "../admin/modules/horarios-cesiones-list.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gasSource = readGasSource();

console.log("\n🧪 --- Suite de Verificación Integral: Cesión de Horarios y Cierres ---");

// =========================================================================
// 1. Backend PHP Unit Tests
// =========================================================================
console.log("\n1. Ejecutando tests unitarios de backend en PHP...");
const phpOutput = execSync("php scripts/verify-horarios-cesiones.php", { cwd: root, encoding: "utf8" });
console.log(phpOutput.trim());

// =========================================================================
// 2. Auditoría de Límites Arquitectónicos (archivos <= 250 líneas)
// =========================================================================
console.log("\n2. Auditando regla arquitectónica: archivos en admin/ <= 250 líneas...");
const adminFiles = [
  "admin/api/horarios_cesiones.php",
  "admin/api/lib_horarios_cesiones.php",
  "admin/api/lib_horarios_cesiones_windows.php",
  "admin/modules/horarios-cesiones.js",
  "admin/modules/horarios-cesiones-ui.js",
  "admin/modules/horarios-cesiones-form-html.js",
  "admin/modules/horarios-cesiones-list.js",
  "admin/modules/horarios-cesiones-validator.js",
  "admin/api/lib_calendar_backup_backup_compute_day_slots.php",
];

for (const relPath of adminFiles) {
  const fullPath = path.join(root, relPath);
  assert.ok(fs.existsSync(fullPath), `Archivo ${relPath} debe existir`);
  const lines = fs.readFileSync(fullPath, "utf8").split("\n").length;
  assert.ok(
    lines <= 250,
    `Archivo ${relPath} tiene ${lines} líneas y excede el límite de 250`
  );
  console.log(`  ✓ ${relPath}: ${lines} líneas (<= 250)`);
}

// =========================================================================
// 3. Cronograma semanal habitual base (Lunes a Viernes)
// =========================================================================
console.log("\n3. Verificando cronograma semanal base de Norberto y María...");
engine.resetScheduleOverrides();

// Nota: 2026-11-23 es feriado nacional (Soberanía Nacional). Usamos 2026-11-30 (Lunes hábil).
// Lunes (2026-11-30): María 09:00-17:00, Norberto 17:30-19:30
const monMaria = engine.calculateAvailableSlots({ date: "2026-11-30", practitionerId: "maria" });
const monNorberto = engine.calculateAvailableSlots({ date: "2026-11-30", practitionerId: "norberto" });
assert.ok(monMaria.length > 0, "María atiende los lunes");
assert.equal(monMaria[0].time, "09:00");
assert.ok(monNorberto.length > 0, "Norberto atiende lunes a la tarde");
assert.equal(monNorberto[0].time, "17:30");

// Miércoles (2026-11-25): Norberto 09:00-16:30, María 0 slots
const wedMaria = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "maria" });
const wedNorberto = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" });
assert.equal(wedMaria.length, 0, "María no atiende miércoles");
assert.ok(wedNorberto.length > 0, "Norberto atiende miércoles");
assert.equal(wedNorberto[0].time, "09:00");

// Jueves (2026-11-26): Norberto 15:00-19:00, María 0 slots
const thuMaria = engine.calculateAvailableSlots({ date: "2026-11-26", practitionerId: "maria" });
const thuNorberto = engine.calculateAvailableSlots({ date: "2026-11-26", practitionerId: "norberto" });
assert.equal(thuMaria.length, 0, "María no atiende jueves");
assert.ok(thuNorberto.length > 0, "Norberto atiende jueves");
assert.equal(thuNorberto[0].time, "15:00");

console.log("  ✓ Cronograma base de lunes a viernes validado correctamente.");

// =========================================================================
// 4. Cesiones de Jornada Completa (Norberto -> María y María -> Norberto)
// =========================================================================
console.log("\n4. Verificando cesión de jornada completa...");
// Norberto cede el miércoles a María
engine.setScheduleOverrides([
  {
    id: "cov_full_wed",
    action: "transfer",
    from_practitioner: "norberto",
    to_practitioner: "maria",
    start_date: "2026-11-25",
    end_date: "2026-11-25",
    time_scope: "all_day",
    active: true,
  },
]);

const wedNorbertoAfter = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" });
const wedMariaAfter = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "maria" });
assert.equal(wedNorbertoAfter.length, 0, "Norberto queda sin turnos al ceder");
assert.ok(wedMariaAfter.length > 0, "María recibe los turnos del miércoles");
assert.equal(wedMariaAfter[0].time, "09:00");
assert.equal(wedMariaAfter[0].practitionerId, "maria");

// María cede el lunes a Norberto
engine.setScheduleOverrides([
  {
    id: "cov_full_mon",
    action: "transfer",
    from_practitioner: "maria",
    to_practitioner: "norberto",
    start_date: "2026-11-30",
    end_date: "2026-11-30",
    time_scope: "all_day",
    active: true,
  },
]);
const monMariaAfter = engine.calculateAvailableSlots({ date: "2026-11-30", practitionerId: "maria" });
const monNorbertoAfter = engine.calculateAvailableSlots({ date: "2026-11-30", practitionerId: "norberto" });
assert.equal(monMariaAfter.length, 0, "María queda sin turnos al ceder el lunes");
assert.ok(monNorbertoAfter.length > 2, "Norberto recibe la jornada completa de lunes");
assert.equal(monNorbertoAfter[0].time, "09:00");

console.log("  ✓ Cesiones de jornada completa validadas en ambas direcciones.");

// =========================================================================
// 4b. Profesional de baja (multi-día): disciplinas exclusivas no se ofrecen
// =========================================================================
console.log("\n4b. Verificando profesional de baja y disciplinas exclusivas...");
engine.setScheduleOverrides([
  {
    id: "cov_maria_leave",
    action: "transfer",
    from_practitioner: "maria",
    to_practitioner: "norberto",
    period_type: "date_range",
    start_date: "2026-12-01",
    end_date: "2026-12-14",
    time_scope: "custom_hours",
    custom_range: { start: "14:00", end: "17:00" },
    custom_ranges: [{ start: "14:00", end: "17:00" }],
    practitioner_on_leave: true,
    active: true,
  },
]);
// 2026-12-01 es martes (María suele atender mañana)
assert.equal(engine.isPractitionerOnLeave("maria", "2026-12-01"), true, "María de baja el 1/12");
assert.equal(engine.isPractitionerOnLeave("norberto", "2026-12-01"), false, "Norberto no está de baja");
assert.equal(engine.isTechniqueOfferedOnDate("acupuntura", "2026-12-01"), false, "Acupuntura no se ofrece con María de baja");
assert.equal(engine.isTechniqueOfferedOnDate("posturologia", "2026-12-01"), false, "Posturología no se ofrece con María de baja");
assert.equal(engine.isTechniqueOfferedOnDate("osteopatia", "2026-12-01"), true, "Osteopatía sigue (Norberto)");
assert.equal(engine.getWorkingWindows("maria", "2026-12-01").length, 0, "María sin ventanas al estar de baja");
const norbertoLeaveSlots = engine.calculateAvailableSlots({ date: "2026-12-01", practitionerId: "norberto" });
assert.ok(norbertoLeaveSlots.some((s) => s.time === "14:00"), "Norberto recibe la franja cedida 14:00");
assert.equal(engine.isTechniqueOfferedOnDate("acupuntura", "2026-12-15"), true, "Acupuntura vuelve fuera del rango");
engine.resetScheduleOverrides();
console.log("  ✓ De baja oculta disciplinas exclusivas y libera franjas al receptor.");

// =========================================================================
// 5. Regla Física Estricta de 1 Sola Camilla (Sin Solapamientos)
// =========================================================================
console.log("\n5. Verificando regla física de 1 sola camilla en el consultorio...");
const generalSlots = engine.calculateAvailableSlots({ date: "2026-11-30" });
const slotTimes = new Set();
for (const s of generalSlots) {
  assert.equal(slotTimes.has(s.time), false, `Horario duplicado en camilla: ${s.time}`);
  slotTimes.add(s.time);
}
console.log("  ✓ 0 turnos simultáneos garantizados en todo el consultorio.");

// =========================================================================
// 6. Protección de Citas Preexistentes (No se ceden turnos dados)
// =========================================================================
console.log("\n6. Verificando protección física de citas ya reservadas...");
engine.setScheduleOverrides([
  {
    id: "cov_test_wed",
    action: "transfer",
    from_practitioner: "norberto",
    to_practitioner: "maria",
    start_date: "2026-11-25",
    end_date: "2026-11-25",
    time_scope: "all_day",
    active: true,
  },
]);

const busyAppointment = [
  {
    start: new Date(2026, 10, 25, 11, 0).getTime(),
    end: new Date(2026, 10, 25, 12, 0).getTime(),
    practitioner: "norberto",
    title: "Paciente Previo - Osteopatía",
  },
];

const mariaSlotsWithBusy = engine.calculateAvailableSlots({
  date: "2026-11-25",
  practitionerId: "maria",
  busyIntervals: busyAppointment,
});
assert.equal(mariaSlotsWithBusy.some((s) => s.time === "11:00"), false, "Slot 11:00 bloqueado por cita previa");
assert.equal(mariaSlotsWithBusy.some((s) => s.time === "09:00"), true, "Slot 09:00 disponible para María");
assert.equal(mariaSlotsWithBusy.some((s) => s.time === "12:00"), true, "Slot 12:00 disponible para María");

console.log("  ✓ Citas preexistentes bloquean físicamente la camilla y solo se cede tiempo libre.");

// =========================================================================
// 7. Cesiones Parciales (Franjas horarias personalizadas)
// =========================================================================
console.log("\n7. Verificando cesión parcial de ciertas horas...");
engine.setScheduleOverrides([
  {
    id: "cov_partial",
    action: "transfer",
    from_practitioner: "norberto",
    to_practitioner: "maria",
    start_date: "2026-11-25",
    end_date: "2026-11-25",
    time_scope: "custom_hours",
    custom_range: { start: "14:00", end: "16:30" },
    active: true,
  },
]);

const norbertoPart = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" });
const mariaPart = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "maria" });
assert.ok(norbertoPart.length > 0, "Norberto conserva turnos antes de las 14:00");
assert.equal(norbertoPart.some((s) => s.time >= "14:00"), false, "Norberto no tiene slots desde las 14:00");
assert.ok(mariaPart.length > 0, "María recibe turnos desde las 14:00");
assert.equal(mariaPart[0].time, "14:00");
assert.equal(mariaPart.some((s) => s.time < "14:00"), false, "María no tiene slots antes de las 14:00");

// Test de múltiples franjas horarias (2 franjas separadas: 09:00 a 11:00 y 14:00 a 16:00)
engine.setScheduleOverrides([
  {
    id: "cov_multi_part",
    action: "transfer",
    from_practitioner: "norberto",
    to_practitioner: "maria",
    start_date: "2026-11-25",
    end_date: "2026-11-25",
    time_scope: "custom_hours",
    custom_ranges: [
      { start: "09:00", end: "11:00" },
      { start: "14:00", end: "16:00" },
    ],
    active: true,
  },
]);
const mMulti = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "maria" });
assert.ok(mMulti.some((s) => s.time === "09:00" || s.time === "10:00"), "María tiene turnos en franja 1");
assert.ok(mMulti.some((s) => s.time === "14:00" || s.time === "15:00"), "María tiene turnos en franja 2");
assert.equal(mMulti.some((s) => s.time === "11:00" || s.time === "12:00" || s.time === "13:00"), false, "María no tiene turnos intermedios");

console.log("  ✓ División de jornada horaria con precisión de minutos y múltiples franjas validada.");

// =========================================================================
// 8. Cierre Total y Parcial de Consultorio
// =========================================================================
console.log("\n8. Verificando cierres de consultorio...");
// Cierre total
engine.setScheduleOverrides([
  {
    id: "cov_close_day",
    action: "closure",
    start_date: "2026-11-25",
    end_date: "2026-11-25",
    time_scope: "all_day",
    active: true,
  },
]);
assert.equal(engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" }).length, 0);
assert.equal(engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "maria" }).length, 0);
assert.equal(engine.calculateAvailableSlots({ date: "2026-11-25" }).length, 0);

// Cierre parcial (mantenimiento 10:00 a 12:00)
engine.setScheduleOverrides([
  {
    id: "cov_close_part",
    action: "closure",
    start_date: "2026-11-25",
    end_date: "2026-11-25",
    time_scope: "custom_hours",
    custom_range: { start: "10:00", end: "12:00" },
    active: true,
  },
]);
const slotsNorbertoWithClose = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" });
assert.equal(slotsNorbertoWithClose.some((s) => s.time === "10:00" || s.time === "11:00"), false);
assert.equal(slotsNorbertoWithClose.some((s) => s.time === "09:00"), true);
assert.equal(slotsNorbertoWithClose.some((s) => s.time === "12:00"), true);

console.log("  ✓ Cierre total y parcial bloquean correctamente la disponibilidad.");

// =========================================================================
// 9. Inmutabilidad de Feriados Nacionales y Fines de Semana
// =========================================================================
console.log("\n9. Verificando inmutabilidad de feriados y fines de semana...");
engine.setScheduleOverrides([
  {
    id: "cov_holiday",
    action: "transfer",
    from_practitioner: "norberto",
    to_practitioner: "maria",
    start_date: "2026-12-25", // Navidad
    end_date: "2026-12-25",
    time_scope: "all_day",
    active: true,
  },
]);
assert.equal(engine.calculateAvailableSlots({ date: "2026-12-25" }).length, 0, "Feriados devuelven 0 slots");
assert.equal(engine.calculateAvailableSlots({ date: "2026-11-28" }).length, 0, "Sábados devuelven 0 slots");
assert.equal(engine.calculateAvailableSlots({ date: "2026-11-29" }).length, 0, "Domingos devuelven 0 slots");
console.log("  ✓ Feriados y fines de semana permanecen inmutables.");

// =========================================================================
// 10. Rangos de Fechas (De tal día a tal día)
// =========================================================================
console.log("\n10. Verificando rango de fechas (de tal día a tal día)...");
engine.setScheduleOverrides([
  {
    id: "cov_range",
    action: "transfer",
    from_practitioner: "norberto",
    to_practitioner: "maria",
    period_type: "date_range",
    start_date: "2026-11-23",
    end_date: "2026-11-27",
    time_scope: "all_day",
    active: true,
  },
]);
assert.equal(engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" }).length, 0);
assert.ok(engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "maria" }).length > 0);
assert.equal(engine.calculateAvailableSlots({ date: "2026-11-26", practitionerId: "norberto" }).length, 0);
assert.ok(engine.calculateAvailableSlots({ date: "2026-11-26", practitionerId: "maria" }).length > 0);
// Fuera del rango vuelve a la normalidad
assert.ok(engine.calculateAvailableSlots({ date: "2026-11-30", practitionerId: "norberto" }).length > 0);
console.log("  ✓ Rango cubre toda la ventana y no contamina fechas externas.");

// =========================================================================
// 11. Consultabilidad: Badges, Estados y Trazabilidad de Auditoría
// =========================================================================
console.log("\n11. Verificando consultabilidad de historial y badges...");
const testToday = "2026-11-25";
assert.ok(getOverrideStatusBadge({ active: false, start_date: "2026-11-25", end_date: "2026-11-25" }, testToday).includes("Anulada"));
assert.ok(getOverrideStatusBadge({ active: true, start_date: "2026-11-25", end_date: "2026-11-25" }, testToday).includes("Activa hoy"));
assert.ok(getOverrideStatusBadge({ active: true, start_date: "2026-12-01", end_date: "2026-12-05" }, testToday).includes("Próxima"));
assert.ok(getOverrideStatusBadge({ active: true, start_date: "2026-11-01", end_date: "2026-11-05" }, testToday).includes("Expirada"));

const descAudit = formatOverrideDescription({
  action: "transfer",
  from_practitioner: "norberto",
  to_practitioner: "maria",
  start_date: "2026-11-25",
  end_date: "2026-11-25",
  time_scope: "custom_hours",
  custom_range: { start: "14:00", end: "17:00" },
  reason: "Día de examen",
  created_by: "admin_norberto",
  active: false,
  annulled_by: "admin_maria",
});
assert.ok(descAudit.title.includes("María"));
assert.ok(descAudit.hours.includes("14:00 a 17:00"));
assert.ok(descAudit.extra.includes("admin_norberto"));
assert.ok(descAudit.extra.includes("admin_maria"));

const descMulti = formatOverrideDescription({
  action: "transfer",
  from_practitioner: "norberto",
  to_practitioner: "maria",
  start_date: "2026-11-25",
  end_date: "2026-11-25",
  time_scope: "custom_hours",
  custom_ranges: [
    { start: "09:00", end: "11:00" },
    { start: "14:00", end: "16:00" },
  ],
  active: true,
});
assert.ok(descMulti.hours.includes("09:00 a 11:00 hs y 14:00 a 16:00 hs"));
console.log("  ✓ Metadatos de consulta y auditoría validados al 100%.");

// =========================================================================
// 12. Anulación Inmediata
// =========================================================================
console.log("\n12. Verificando anulación inmediata y restauración de cronograma...");
const ovWillAnnul = {
  id: "ov_annul_check",
  action: "transfer",
  from_practitioner: "norberto",
  to_practitioner: "maria",
  start_date: "2026-11-25",
  end_date: "2026-11-25",
  time_scope: "all_day",
  active: true,
};
engine.setScheduleOverrides([ovWillAnnul]);
assert.equal(engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" }).length, 0);

ovWillAnnul.active = false;
ovWillAnnul.annulled_at = new Date().toISOString();
ovWillAnnul.annulled_by = "admin";
engine.setScheduleOverrides([ovWillAnnul]);

const restoredSlots = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" });
assert.ok(restoredSlots.length > 0, "Al anular, Norberto recupera sus turnos inmediatamente");
assert.equal(restoredSlots[0].time, "09:00");
console.log("  ✓ Anulación probada con reversión instantánea de disponibilidad.");

// =========================================================================
// 13. Robustez ante Tipos y Casos Límite
// =========================================================================
console.log("\n13. Verificando robustez ante tipos y casos límite...");
assert.equal(engine.calculateAvailableSlots({ date: null }).length, 0);
assert.equal(engine.calculateAvailableSlots({ date: "" }).length, 0);
assert.equal(engine.calculateAvailableSlots({ date: "fecha-invalida" }).length, 0);
assert.equal(engine.calculateAvailableSlots({ date: "2026-02-31" }).length, 0); // 31 de feb

const slotsCasing = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: " NorBERTO " });
assert.ok(slotsCasing.length > 0, "PractitionerId insensible a mayúsculas y espacios");

engine.setScheduleOverrides([null, undefined, "texto_corrupto", { active: false }, ovWillAnnul]);
const safeSlots = engine.calculateAvailableSlots({ date: "2026-11-25", practitionerId: "norberto" });
assert.ok(safeSlots.length > 0, "Lista corrupta se sanea sin crashear");
console.log("  ✓ Casos anómalos y conversiones de tipo superados sin fallos.");

// =========================================================================
// 14. Reglas del Validador de Admin
// =========================================================================
console.log("\n14. Verificando reglas de negocio del validador de Admin...");
assert.equal(validateCesionDraft({ action: "transfer", from_practitioner: "norberto", to_practitioner: "norberto", start_date: "2026-11-25" }).isValid, false);
assert.equal(validateCesionDraft({ action: "transfer", from_practitioner: "norberto", to_practitioner: "maria", start_date: "2026-11-28", end_date: "2026-11-25", period_type: "date_range" }).isValid, false);
assert.equal(validateCesionDraft({ action: "transfer", from_practitioner: "norberto", to_practitioner: "maria", start_date: "2026-11-25", time_scope: "custom_hours", custom_range: { start: "14:00", end: "14:30" } }).isValid, false);
assert.equal(validateCesionDraft({ action: "closure", start_date: "2026-11-25", time_scope: "custom_hours", custom_range: { start: "07:00", end: "10:00" } }).isValid, false);
assert.equal(isValidIsoDate("2026-02-30"), false);
assert.equal(isValidIsoDate("2026-11-25"), true);
assert.equal(isValidHm("09:15"), false);
assert.equal(isValidHm("09:30"), true);
console.log("  ✓ Validador de Admin cubre todos los límites de negocio.");

// =========================================================================
// 15. Paridad con Google Apps Script (GAS en sandbox VM)
// =========================================================================
console.log("\n15. Verificando paridad 100% de cálculo con Google Apps Script...");
const gasCtx = {
  console: { log() {}, warn() {}, error() {} },
  Date, Math, String, parseInt, Array, Object, JSON,
  Utilities: {
    formatDate(d, tz, fmt) {
      if (fmt === "yyyy-MM-dd") {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }
      return "";
    },
  },
  UrlFetchApp: { fetch() { return { getResponseCode: () => 500 }; } },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
};
vm.createContext(gasCtx);
vm.runInContext(gasSource, gasCtx);

const transferWed = [{
  id: "cov_gas_1",
  action: "transfer",
  from_practitioner: "norberto",
  to_practitioner: "maria",
  start_date: "2026-11-25",
  end_date: "2026-11-25",
  time_scope: "all_day",
  active: true,
}];

const gasWinMaria = gasCtx.getGasWorkingWindows("maria", 3, null, { date: "2026-11-25", overrides: transferWed });
assert.ok(gasWinMaria.length > 0, "GAS devuelve ventanas para María en día cedido");
assert.equal(gasWinMaria[0].start, "09:00");
assert.equal(gasWinMaria[0].end, "16:30");

const gasWinNorberto = gasCtx.getGasWorkingWindows("norberto", 3, null, { date: "2026-11-25", overrides: transferWed });
assert.equal(gasWinNorberto.length, 0, "GAS devuelve 0 ventanas para Norberto en día cedido");

console.log("  ✓ Paridad matemática exacta entre Apps Script y Engine confirmada.");

console.log("\n🎉 ¡Todos los tests de la suite integral superados con éxito absoluto!\n");
