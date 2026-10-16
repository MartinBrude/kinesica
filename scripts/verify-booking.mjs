#!/usr/bin/env node
/**
 * Test Suite para el Módulo de Reservas y Reglas de Kinésica
 * ==========================================================
 * Ejecución: node scripts/verify-booking.mjs
 */

import assert from "node:assert";
import engine from "../booking/booking-engine.js";
import { CONTACT } from "./site-contact.mjs";

const {
  calculateAvailableSlots,
  validateBookingRequest,
  formatCalendarSummary,
  formatCalendarDescription,
  generateCalendarExportData,
  isBusinessDay,
  DEFAULT_ARGENTINA_HOLIDAYS,
} = engine;

console.log("🩺 Ejecutando tests del motor de reservas de Kinésica...\n");

let passed = 0;
let total = 0;

function test(description, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${description}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 1. REGLA ESTRICTA DE PRIMERA VEZ (LLAMADA OBLIGATORIA)
// ---------------------------------------------------------------------------
test("REGLA 1: Ya no se aceptan llamadas", () => {
  const result = validateBookingRequest({
    appointmentType: "call",
    techniqueId: "rpg",
    practitionerId: "norberto",
    nombre: "Juan Pérez",
    telefono: "+5491112345678",
    dni: "30123456",
    date: "2026-10-07",
    time: "10:00",
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes("Ya no se agendan llamadas")));
});

test("REGLA 1B: Osteopatía solo la atiende Norberto", () => {
  const rejected = validateBookingRequest({
    appointmentType: "session",
    techniqueId: "osteopatia",
    practitionerId: "maria",
    nombre: "Juan Pérez",
    telefono: "+5491112345678",
    dni: "30123456",
    date: "2026-10-07",
    time: "10:00",
  });
  assert.strictEqual(rejected.isValid, false);

  const accepted = validateBookingRequest({
    appointmentType: "session",
    techniqueId: "osteopatia",
    practitionerId: "norberto",
    nombre: "Juan Pérez",
    telefono: "+5491112345678",
    dni: "30123456",
    date: "2026-10-07",
    time: "10:00",
  });
  assert.strictEqual(accepted.isValid, true);
});

test("REGLA 1E: Si la técnica la atienden los dos, el profesional es opcional", () => {
  const result = validateBookingRequest({
    appointmentType: "session",
    techniqueId: "rpg",
    nombre: "Juan Pérez",
    telefono: "+5491112345678",
    dni: "30123456",
    date: "2026-10-07",
    time: "10:00",
  });
  assert.strictEqual(result.isValid, true);
});

test("REGLA 1D: No sé acepta un horario de atención sin técnica fija", () => {
  const result = validateBookingRequest({
    appointmentType: "session",
    techniqueId: "no-se",
    nombre: "Juan Pérez",
    telefono: "+5491112345678",
    dni: "30123456",
    date: "2026-10-07",
    time: "10:00",
  });
  assert.strictEqual(result.isValid, true);
  assert.ok(engine.practitionersAt("2026-10-07", "10:00").length > 0);
});

test("REGLA 1C: Acupuntura solo la atiende María y RPG la atienden ambos", () => {
  assert.strictEqual(engine.practitionerOffersTechnique("maria", "acupuntura"), true);
  assert.strictEqual(engine.practitionerOffersTechnique("norberto", "acupuntura"), false);
  assert.strictEqual(engine.practitionerOffersTechnique("norberto", "rpg"), true);
  assert.strictEqual(engine.practitionerOffersTechnique("maria", "posturologia"), true);
  assert.strictEqual(engine.practitionerOffersTechnique("norberto", "viscerales"), true);
  assert.strictEqual(engine.practitionerOffersTechnique("maria", "viscerales"), true);
  assert.strictEqual(engine.getTechnique("barral"), null);
});

// ---------------------------------------------------------------------------
// 2. DÍAS HÁBILES Y FERIADOS NACIONALES DE ARGENTINA
// ---------------------------------------------------------------------------
test("REGLA 2A: Sábados y domingos no son días hábiles", () => {
  assert.strictEqual(isBusinessDay("2026-10-10"), false, "Sábado no debe ser hábil");
  assert.strictEqual(isBusinessDay("2026-10-11"), false, "Domingo no debe ser hábil");
});

test("REGLA 2B: Feriados nacionales no son días hábiles y devuelven 0 slots", () => {
  // 25 de Mayo de 2026
  assert.strictEqual(isBusinessDay("2026-05-25"), false, "25 de Mayo debe ser feriado");
  const slots = calculateAvailableSlots({
    date: "2026-05-25",
    practitionerId: "norberto",
  });
  assert.strictEqual(slots.length, 0, "No debe haber turnos en feriados");
});

test("REGLA 2C: Miércoles genera slots de Norberto entre 09:00 y 16:00 (último turno a las 15:00)", () => {
  // Miércoles 7 de Octubre 2026 (Norberto de 09:00 a 16:00, turnos de 9 a 15 inclusive)
  const slots = calculateAvailableSlots({
    date: "2026-10-07",
    appointmentType: "session",
  });
  assert.ok(slots.length > 0, "Debe generar slots disponibles");
  assert.strictEqual(slots[0].time, "09:00", "Primer turno debe arrancar a las 09:00");
  const lastSlot = slots[slots.length - 1];
  assert.strictEqual(lastSlot.time, "15:00", "Último turno de 1h debe arrancar a las 15:00 para terminar a las 16:00");
});

// ---------------------------------------------------------------------------
// 3. UNICIDAD DEL PROFESIONAL Y NO-SOLAPAMIENTO (ANTI-COLISIÓN)
// ---------------------------------------------------------------------------
test("REGLA 3A: Una llamada existente bloquea turnos presenciales que la solapen", () => {
  // Supongamos que hay una llamada de 10:10 a 10:20
  const busy = [
    {
      start: new Date("2026-10-07T10:10:00Z").getTime(),
      end: new Date("2026-10-07T10:20:00Z").getTime(),
    },
  ];

  // Si buscamos turnos presenciales de 1h usando timestamps comparables
  const testBaseDate = new Date(2026, 9, 7); // 7 Oct 2026 local
  const busyLocal = [
    {
      start: new Date(2026, 9, 7, 10, 10).getTime(),
      end: new Date(2026, 9, 7, 10, 20).getTime(),
    },
  ];

  const sessionSlots = calculateAvailableSlots({
    date: testBaseDate,
    appointmentType: "session",
    busyIntervals: busyLocal,
  });

  // El turno de 10:00 a 11:00 NO debe estar disponible porque colisiona con 10:10-10:20
  const has10am = sessionSlots.some((s) => s.time === "10:00");
  assert.strictEqual(has10am, false, "El slot 10:00-11:00 debe colisionar con la llamada");

  // El turno de 10:30 a 11:30 tampoco (porque empieza a 10:30 y la llamada termina 10:20, este sí estaría libre)
  const has1030am = sessionSlots.some((s) => s.time === "10:30");
  assert.strictEqual(has1030am, true, "El slot 10:30-11:30 no colisiona con 10:10-10:20");
});

test("REGLA 3B: Los horarios del profesional recortan los turnos de ese día", () => {
  const originalMaria = engine.PRACTITIONER_HOURS.maria;
  engine.PRACTITIONER_HOURS.maria = { 3: [{ start: "10:00", end: "13:00" }] };
  try {
    const slots = calculateAvailableSlots({
      date: new Date(2026, 9, 7),
      practitionerId: "maria",
    });
    assert.deepStrictEqual(slots.map((s) => s.time), ["10:00", "10:30", "11:00", "11:30", "12:00"]);
  } finally {
    engine.PRACTITIONER_HOURS.maria = originalMaria;
  }
});

// ---------------------------------------------------------------------------
// 4. BUFFER DE ANTICIPACIÓN Y TRASLADO EN EL MISMO DÍA
// ---------------------------------------------------------------------------
test("REGLA 4B: Para turnos presenciales en el mismo día, se mantiene margen de traslado de 2 horas (now + 2h)", () => {
  const simulatedNow = new Date(2026, 9, 7, 10, 15); // Hoy a las 10:15
  const slots = calculateAvailableSlots({
    date: new Date(2026, 9, 7),
    appointmentType: "session",
    now: simulatedNow,
  });

  // Los slots deben comenzar a partir de 12:15 o posterior (now + 2h = 12:15)
  const tooEarly = slots.some((s) => {
    const [h, m] = s.time.split(":").map(Number);
    return h < 12 || (h === 12 && m < 15);
  });
  assert.strictEqual(tooEarly, false, "No debe ofrecer turnos presenciales en menos de 2 horas desde now");

  // El primer turno de sesión presencial (pasos de 30m) debe ser a las 12:30
  assert.ok(slots.length > 0, "Debe haber turnos disponibles luego de 2h");
  assert.strictEqual(slots[0].time, "12:30", "Primer horario de turno presencial libre debe ser 12:30");
});

// ---------------------------------------------------------------------------
// 5. FORMATO DE TÍTULOS Y DESCRIPCIONES PARA GOOGLE CALENDAR
// ---------------------------------------------------------------------------
test("REGLA 5: Títulos y descripciones cumplen el estándar exacto de Kinésica", () => {
  const sessionSummary = formatCalendarSummary({
    appointmentType: "session",
    practitionerId: "norberto",
    nombre: "Lucas Méndez",
  });
  assert.strictEqual(sessionSummary, "🩺 [NORBERTO] [TURNO] Lucas Méndez");

  const menorSummary = formatCalendarSummary({
    appointmentType: "session",
    nombre: "Tobías Méndez",
    isMenor: true,
    nombreFamiliar: "Lucas Méndez",
  });
  assert.strictEqual(menorSummary, "🩺 [TURNO - MENOR] Tobías Méndez (Familiar: Lucas Méndez)");

  const description = formatCalendarDescription({
    telefono: "+54 9 11 6156-4311",
    dni: "35123456",
    motivo: "Dolor cervical y contractura",
  });
  assert.ok(description.includes("📱 WhatsApp: +54 9 11 6156-4311"));
  assert.ok(description.includes("🪪 DNI: 35123456"));
  assert.ok(description.includes("📋 Motivo: Dolor cervical y contractura"));

  const descRpg = formatCalendarDescription({
    telefono: "+54 9 11 6156-4311",
    techniqueId: "rpg",
  });
  assert.ok(descRpg.includes("📋 Especialidad: RPG"));

  const descNoSe = formatCalendarDescription({
    telefono: "+54 9 11 6156-4311",
    techniqueId: "no-se",
  });
  assert.ok(descNoSe.includes("📋 Especialidad: No especifica"));
});

// ---------------------------------------------------------------------------
// 6. GENERACIÓN DE ENLACES Y ARCHIVOS PARA CALENDARIOS PERSONALES (GOOGLE CALENDAR E .ICS)
// ---------------------------------------------------------------------------
test("REGLA 6A: Sincronización para turno presencial de 1h calcula horario UTC-3 y genera enlaces válidos", () => {
  const exportData = generateCalendarExportData(
    {
      appointmentType: "session",
      date: "2026-10-15",
      time: "14:00",
      telefono: "+54 9 11 6156-4311",
    },
    "kinesica-test-evt-1"
  );

  // 14:00 en Argentina (UTC-3) = 17:00 UTC
  // Turno presencial = 60 minutos -> finaliza a las 18:00 UTC
  assert.strictEqual(exportData.startCompact, "20261015T170000Z");
  assert.strictEqual(exportData.endCompact, "20261015T180000Z");
  assert.strictEqual(exportData.title, "Turno en Kinésica");
  assert.ok(exportData.location.includes(CONTACT.address.streetAddress));
  assert.ok(exportData.location.includes("Piso 5º B, Palermo"));
  assert.ok(exportData.description.includes("características del espacio y la organización"));

  // Verificación de URL de Google Calendar
  assert.ok(exportData.googleCalendarUrl.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE"));
  assert.ok(exportData.googleCalendarUrl.includes("dates=20261015T170000Z/20261015T180000Z"));
  assert.ok(exportData.googleCalendarUrl.includes(encodeURIComponent("Turno en Kinésica")));

  // Verificación de formato RFC 5545 para .ics
  assert.ok(exportData.icsContent.includes("BEGIN:VCALENDAR"));
  assert.ok(exportData.icsContent.includes("VERSION:2.0"));
  assert.ok(exportData.icsContent.includes("BEGIN:VEVENT"));
  assert.ok(exportData.icsContent.includes("UID:kinesica-test-evt-1"));
  assert.ok(exportData.icsContent.includes("DTSTART:20261015T170000Z"));
  assert.ok(exportData.icsContent.includes("DTEND:20261015T180000Z"));
  assert.ok(exportData.icsContent.includes("SUMMARY:Turno en Kinésica"));
  assert.ok(exportData.icsContent.includes("END:VEVENT"));
  assert.ok(exportData.icsContent.includes("END:VCALENDAR"));
  assert.strictEqual(exportData.filename, "kinesica-turno-2026-10-15.ics");
});

test("REGLA 6B: El título del calendario del paciente incluye la técnica", () => {
  const exportData = generateCalendarExportData(
    {
      appointmentType: "session",
      techniqueId: "acupuntura",
      practitionerId: "maria",
      date: "2026-10-15",
      time: "10:30",
      telefono: "+54 9 11 5555-4444",
    },
    "kinesica-test-session-2"
  );

  assert.strictEqual(exportData.startCompact, "20261015T133000Z");
  assert.strictEqual(exportData.endCompact, "20261015T143000Z");
  assert.strictEqual(exportData.title, "Turno en Kinésica — Acupuntura");
  assert.ok(exportData.description.includes("Profesional: mujer"));
  assert.strictEqual(exportData.filename, "kinesica-turno-2026-10-15.ics");
});

// ---------------------------------------------------------------------------
// 7. HORARIOS OFICIALES DEFINIDOS PARA MARÍA Y NORBERTO
// ---------------------------------------------------------------------------
test("REGLA 7A: Horarios de María (Lunes 9-15, Martes 9-14:30, Viernes 9-13; Mié y Jue no atiende)", () => {
  // Lunes 2026-10-05: 9 a 15 (turnos de 9 a 14 inclusive, finaliza a las 15 hs)
  const monSlots = calculateAvailableSlots({ date: "2026-10-05", practitionerId: "maria" });
  assert.strictEqual(monSlots[0].time, "09:00");
  assert.strictEqual(monSlots[monSlots.length - 1].time, "14:00");

  // Martes 2026-10-06: 9 a 14:30 (turnos de 9 a 13:30 inclusive, finaliza a las 14:30 hs)
  const tueSlots = calculateAvailableSlots({ date: "2026-10-06", practitionerId: "maria" });
  assert.strictEqual(tueSlots[0].time, "09:00");
  assert.strictEqual(tueSlots[tueSlots.length - 1].time, "13:30");

  // Miércoles y Jueves: María no atiende (0 turnos)
  const wedSlots = calculateAvailableSlots({ date: "2026-10-07", practitionerId: "maria" });
  assert.strictEqual(wedSlots.length, 0);
  const thuSlots = calculateAvailableSlots({ date: "2026-10-08", practitionerId: "maria" });
  assert.strictEqual(thuSlots.length, 0);

  // Viernes 2026-10-09: 9 a 13 (turnos de 9 a 12 inclusive, finaliza a las 13 hs)
  const friSlots = calculateAvailableSlots({ date: "2026-10-09", practitionerId: "maria" });
  assert.strictEqual(friSlots[0].time, "09:00");
  assert.strictEqual(friSlots[friSlots.length - 1].time, "12:00");
});

test("REGLA 7B: Horarios de Norberto (Lun 15:30-19, Mar 15-19, Mié 9-16, Jue 15-19, Vie 13:30-19)", () => {
  // Lunes 2026-10-05: 15:30 a 19 (primer turno 15:30, último 18:00 termina a las 19:00)
  const monSlots = calculateAvailableSlots({ date: "2026-10-05", practitionerId: "norberto" });
  assert.strictEqual(monSlots[0].time, "15:30");
  assert.strictEqual(monSlots[monSlots.length - 1].time, "18:00");

  // Martes 2026-10-06: 15 a 19 (primer turno 15:00, último 18:00)
  const tueSlots = calculateAvailableSlots({ date: "2026-10-06", practitionerId: "norberto" });
  assert.strictEqual(tueSlots[0].time, "15:00");
  assert.strictEqual(tueSlots[tueSlots.length - 1].time, "18:00");

  // Miércoles 2026-10-07: 9 a 16 (primer turno 09:00, último 15:00 termina a las 16:00)
  const wedSlots = calculateAvailableSlots({ date: "2026-10-07", practitionerId: "norberto" });
  assert.strictEqual(wedSlots[0].time, "09:00");
  assert.strictEqual(wedSlots[wedSlots.length - 1].time, "15:00");

  // Jueves 2026-10-08: 15 a 19 (primer turno 15:00, último 18:00)
  const thuSlots = calculateAvailableSlots({ date: "2026-10-08", practitionerId: "norberto" });
  assert.strictEqual(thuSlots[0].time, "15:00");
  assert.strictEqual(thuSlots[thuSlots.length - 1].time, "18:00");

  // Viernes 2026-10-09: 13:30 a 19 (primer turno 13:30, último 18:00 termina a las 19:00)
  const friSlots = calculateAvailableSlots({ date: "2026-10-09", practitionerId: "norberto" });
  assert.strictEqual(friSlots[0].time, "13:30");
  assert.strictEqual(friSlots[friSlots.length - 1].time, "18:00");
});

test("REGLA 8: Clara puede dar turnos a un máximo de 60 días", () => {
  const baseNow = new Date(2026, 9, 15); // 15 de Octubre 2026
  // Fecha a 50 días (4 de Diciembre 2026, viernes hábil)
  const validFuture = "2026-12-04";
  const validSlots = calculateAvailableSlots({
    date: validFuture,
    now: baseNow,
    practitionerId: "norberto",
  });
  assert.ok(validSlots.length > 0, "A 50 días debe generar turnos");

  // Fecha a 65 días (19 de Diciembre 2026) -> más de 60 días
  const beyond60 = "2026-12-19";
  const blockedSlots = calculateAvailableSlots({
    date: beyond60,
    now: baseNow,
    practitionerId: "norberto",
  });
  assert.strictEqual(blockedSlots.length, 0, "A más de 60 días no debe ofrecer turnos");

  // Validación de solicitud a más de 60 días es rechazada
  const validationRes = validateBookingRequest({
    appointmentType: "session",
    techniqueId: "osteopatia",
    practitionerId: "norberto",
    nombre: "Ana Gómez",
    telefono: "+5491112345678",
    dni: "30123456",
    date: "2026-12-28", // > 60 días desde 15 Oct
    time: "16:00",
    now: baseNow,
  });
  assert.strictEqual(validationRes.isValid, false);
  assert.ok(validationRes.errors.some((e) => e.includes("máximo de 60 días")));
});

test("REGLA 9: Opción 'No me importa' (sin profesional fijo) ofrece turnos con cualquiera de los dos", () => {
  // Lunes 2026-10-05 sin practitionerId devuelve tanto turnos de María (mañana) como de Norberto (tarde)
  const bothSlots = calculateAvailableSlots({
    date: "2026-10-05",
    practitionerId: null,
  });
  const times = bothSlots.map((s) => s.time);
  assert.ok(times.includes("09:00"), "Debe incluir turnos de María por la mañana");
  assert.ok(times.includes("14:00"), "Debe incluir el último turno de María por la mañana");
  assert.ok(times.includes("15:30"), "Debe incluir turnos de Norberto por la tarde");
  assert.ok(times.includes("18:00"), "Debe incluir el último turno de Norberto por la tarde");
});

console.log(`\n🎉 Resultado: ${passed}/${total} tests superados con éxito.\n`);
