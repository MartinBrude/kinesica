#!/usr/bin/env node
/**
 * Verificación integral del Sistema de Respaldo de Calendario y Auditoría
 * =======================================================================
 * Valida:
 * 1. Sincronización Google -> Espejo Local (push_snapshot y sync_client_slots).
 * 2. Conmutación 100% transparente al paciente cuando Google Calendar falla (lectura y reserva).
 * 3. Bloqueo inmediato anti-colisión en el respaldo local para evitar doble turno.
 * 4. Alerta de auditoría enviada EXCLUSIVAMENTE a Norberto (incluso en turnos de María).
 * 5. Derivación Nivel 3 si fallara también el respaldo:
 *    - Norberto para disciplinas de Norberto (osteopatia, viscerales) y de ambos (rpg, atm, neurodinamia, no-se).
 *    - María para disciplinas exclusivas de María (acupuntura, posturologia).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { CONTACT } from "./site-contact.mjs";
import { SITE } from "./i18n-urls.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { BookingClient } = require(path.join(root, "booking/booking-api-client.js"));
const BookingWidget = require(path.join(root, "booking/booking-widget.js"));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kinesica-cal-bkp-"));
const backupFile = path.join(tmpDir, "calendar_backup.json");
const TEST_SECRET = "test_backup_secret_1234567890";

function runPhpAction(method, queryObj, bodyObj = null, extraEnv = {}) {
  const runnerPath = path.join(tmpDir, "run_endpoint.php");
  const getJson = JSON.stringify(queryObj || {});
  const bodyRaw = bodyObj ? JSON.stringify(bodyObj) : "";
  const phpCode = `<?php
    $_SERVER['REQUEST_METHOD'] = ${JSON.stringify(method)};
    $_GET = json_decode(${JSON.stringify(getJson)}, true) ?: [];
    $_POST = ${bodyObj ? `json_decode(${JSON.stringify(bodyRaw)}, true) ?: []` : "[]"};
    require ${JSON.stringify(path.join(root, "admin/api/calendar_backup.php"))};
  `;
  fs.writeFileSync(runnerPath, phpCode, "utf8");
  const proc = spawnSync("php", ["-d", "error_reporting=24575", runnerPath], {
    env: {
      ...process.env,
      KINESICA_CALENDAR_BACKUP_FILE: backupFile,
      KINESICA_BACKUP_SECRET: TEST_SECRET,
      KINESICA_GAS_BOOKING_URL: "none",
      KINESICA_BACKUP_SKIP_EXTERNAL_ALERTS: "1",
      ...extraEnv,
    },
    encoding: "utf8",
  });
  if (proc.error) throw proc.error;
  const out = (proc.stdout || "").trim();
  return JSON.parse(out);
}

// Próximo miércoles hábil para pruebas deterministas
function nextWednesdayIso() {
  const d = new Date(Date.now() + 5 * 86400000);
  while (d.getUTCDay() !== 3) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log(`  ✅ ${name}`);
  passed += 1;
}

console.log("🛡️ Verificando sistema de respaldo de calendario y auditoría...\n");

const targetWed = nextWednesdayIso();
// Miércoles 10:00 hs Argentina (-03:00) = 13:00 UTC
const busyStartMs = new Date(`${targetWed}T10:00:00-03:00`).getTime();
const busyEndMs = new Date(`${targetWed}T11:00:00-03:00`).getTime();

await test("1. push_snapshot guarda intervalos ocupados y get_slots bloquea ese horario en el respaldo", async () => {
  const snap = runPhpAction("POST", { action: "push_snapshot" }, {
    action: "push_snapshot",
    secret: TEST_SECRET,
    busy_intervals: [{ start: busyStartMs, end: busyEndMs }],
  });
  assert.equal(snap.status, "success");
  assert.equal(snap.busy_count, 1);

  const slotsRes = runPhpAction("GET", {
    action: "get_slots",
    date: targetWed,
    practitioner: "norberto",
  });
  assert.equal(slotsRes.status, "success");
  assert.ok(Array.isArray(slotsRes.availableSlots) && slotsRes.availableSlots.length > 0);
  const times = slotsRes.availableSlots.map((s) => s.time);
  assert.ok(times.includes("09:00"), "09:00 debe estar libre");
  assert.ok(!times.includes("09:30"), "09:30 solapa con 10:00-11:00 y debe estar bloqueado");
  assert.ok(!times.includes("10:00"), "10:00 está ocupado en el snapshot y debe estar bloqueado");
  assert.ok(times.includes("11:00"), "11:00 debe estar libre");
});

await test("2. BookingClient conmuta de forma 100% transparente al respaldo cuando Google Calendar falla", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      // Simular caída total de Google Apps Script
      if (u.includes("script.google.com") || u.includes("/api/booking")) {
        throw new TypeError("Failed to fetch (Google Calendar unreachable)");
      }
      // Redirigir llamadas a /admin/api/calendar_backup.php al motor PHP real
      if (u.includes("calendar_backup.php")) {
        const parsed = new URL(u, SITE);
        const queryObj = Object.fromEntries(parsed.searchParams.entries());
        const bodyObj = opts.body ? JSON.parse(opts.body) : null;
        const json = runPhpAction(opts.method || "GET", queryObj, bodyObj);
        return {
          ok: json.status === "success",
          status: json.status === "success" ? 200 : (json.status === "conflict" ? 409 : 503),
          json: async () => json,
        };
      }
      throw new Error("URL inesperada: " + u);
    };

    const client = new BookingClient({
      apiUrl: "https://script.google.com/macros/s/FAKE/exec",
      backupApiUrl: `${SITE}/admin/api/calendar_backup.php`,
    });

    // Consulta de slots cae en modo respaldo sin arrojar error al paciente
    const slotsOut = await client.getAvailableSlots(targetWed, "session", {
      maxRetries: 0,
      practitionerId: "norberto",
    });
    assert.equal(slotsOut.status, "success");
    assert.ok(slotsOut.availableSlots.some((s) => s.time === "11:00"));

    // Confirmación de reserva cae en modo respaldo y responde exactamente igual que el modo normal
    const bookingPayload = {
      appointmentType: "session",
      techniqueId: "rpg",
      practitionerId: "norberto",
      nombre: "Carlos Gómez",
      email: "carlos@ejemplo.com",
      telefono: "+54 9 11 5555-6666",
      dni: "30111222",
      date: targetWed,
      time: "11:00",
    };
    const bookOut = await client.bookAppointment(bookingPayload);
    assert.equal(bookOut.status, "success");
    assert.equal(bookOut.message, "Tu turno presencial ha sido agendado con éxito.");
    assert.ok(bookOut.eventId && bookOut.eventId.startsWith("kin_"));
    assert.ok(!JSON.stringify(bookOut).toLowerCase().includes("respaldo"), "El paciente nunca debe ver la palabra respaldo");

    // Segundo paciente intenta reservar el mismo horario (11:00) mientras Google sigue caído -> Bloqueado!
    await assert.rejects(
      () =>
        client.bookAppointment({
          ...bookingPayload,
          nombre: "Otro Paciente",
          email: "otro@ejemplo.com",
          bookingRequestId: "req_second_patient_999999",
        }),
      /reservado por otro paciente/i,
      "El respaldo debe bloquear inmediatamente el hueco para evitar doble turno"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await test("3. La alerta de auditoría en modo respaldo va ÚNICAMENTE a Norberto (incluso si el turno es de María)", async () => {
  const inspectorPhp = path.join(tmpDir, "inspect_audit.php");
  fs.writeFileSync(
    inspectorPhp,
    `<?php
      require ${JSON.stringify(path.join(root, "admin/api/lib_calendar_backup.php"))};
      $entry = [
        'date' => ${JSON.stringify(targetWed)},
        'time' => '10:00',
        'payload' => [
          'practitionerId' => 'maria',
          'techniqueId' => 'acupuntura',
          'especialidad' => 'Acupuntura',
          'nombre' => 'Lucía Fernández',
          'telefono' => '1144445555',
          'email' => 'lucia@ejemplo.com',
          'dni' => '28999888',
        ],
      ];
      $out = kinesica_backup_notify_norberto_audit($entry, ['updated_ts' => time() - 120], ['synced' => false]);
      echo json_encode($out);
    `,
    "utf8"
  );
  const proc = spawnSync("php", ["-d", "error_reporting=24575", inspectorPhp], {
    env: { ...process.env, KINESICA_BACKUP_SKIP_EXTERNAL_ALERTS: "1" },
    encoding: "utf8",
  });
  const auditOut = JSON.parse(proc.stdout.trim());
  assert.equal(auditOut.notified_to, "norberto_only");
  assert.equal(auditOut.recipient_phone, "541161564311");
  assert.equal(auditOut.recipient_email, CONTACT.email);
  assert.match(auditOut.message, /Lic\. María Gulín/);
  assert.match(auditOut.message, /Lucía Fernández/);

  const libSrc = fs.readFileSync(path.join(root, "admin/api/lib_calendar_backup.php"), "utf8");
  assert.ok(!libSrc.includes("541128531224"), "lib_calendar_backup.php no debe enviar alertas de respaldo al teléfono de María");
  assert.ok(!libSrc.includes("manosmagicas7116"), "lib_calendar_backup.php no debe enviar alertas de respaldo al mail de María");
  assert.ok(libSrc.includes("541161564311"), "La alerta de auditoría debe dirigirse a Norberto");
  // Lecturas de horarios en respaldo NO deben spamear: solo auditoría al agendar.
  assert.ok(
    libSrc.includes("KINESICA_BACKUP_READ_ALERTS"),
    "Las alertas por lectura de horarios deben ser opt-in (KINESICA_BACKUP_READ_ALERTS)"
  );
});

await test("4. Nivel 3 (si fallara también el respaldo): ofrece teléfono de Norberto (propias y ambos) o María (exclusivas)", async () => {
  function checkFallbackFor(techniqueId, practitionerId = null) {
    const w = Object.create(BookingWidget.prototype);
    w.state = { techniqueId, practitionerId };
    return w.fallbackPractitionerId();
  }

  // Disciplinas exclusivas de Norberto -> Norberto
  assert.equal(checkFallbackFor("osteopatia"), "norberto");
  assert.equal(checkFallbackFor("viscerales"), "norberto");

  // Disciplinas compartidas por ambos -> SIEMPRE Norberto (incluso si había preferencia en state)
  assert.equal(checkFallbackFor("rpg"), "norberto");
  assert.equal(checkFallbackFor("rpg", "maria"), "norberto");
  assert.equal(checkFallbackFor("atm"), "norberto");
  assert.equal(checkFallbackFor("atm", "maria"), "norberto");
  assert.equal(checkFallbackFor("neurodinamia"), "norberto");
  assert.equal(checkFallbackFor("no-se"), "norberto");

  // Disciplinas exclusivas de María -> María
  assert.equal(checkFallbackFor("acupuntura"), "maria");
  assert.equal(checkFallbackFor("posturologia"), "maria");

  // Si la copia de respaldo tiene > 24h de antigüedad, calendar_backup.php devuelve error 503 para activar el Nivel 3
  fs.writeFileSync(
    backupFile,
    JSON.stringify({
      version: 1,
      updated_at: "2026-01-01T00:00:00Z",
      updated_ts: Math.floor(Date.now() / 1000) - 90000, // > 24h
      source: "gas_snapshot",
      busy_intervals: [],
      pending_bookings: [],
    }),
    "utf8"
  );
  const expiredRes = runPhpAction("GET", { action: "get_slots", date: targetWed });
  assert.equal(expiredRes.status, "error");
});

await test("5. Carrusel de María repone automáticamente días disponibles cuando hay fechas llenas (mantiene 10 días visibles)", async () => {
  const widgetProto = BookingWidget.prototype;
  const fakeWidget = Object.create(widgetProto);
  fakeWidget.state = {
    techniqueId: "acupuntura",
    practitionerId: "maria",
    appointmentType: "session",
    selectedDate: null,
    selectedTime: null,
  };
  fakeWidget.copy = {
    dows: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    months: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  };

  // Recolectar los 30 candidatos de María dentro de los 60 días
  const allMariaDays = fakeWidget.collectAttendanceDays(30);
  assert.ok(allMariaDays.length >= 15, `María debe tener al menos 15 días de atención en 60 días (obtenidos: ${allMariaDays.length})`);

  // Simulamos que 5 de los primeros 10 días de María están completamente ocupados (0 slots),
  // exactamente como ocurría en producción cuando el carrusel quedaba en solo 5 días.
  const fullDates = new Set(allMariaDays.slice(1, 6).map((d) => d.iso));

  // Mock DOM mínimo para probar pruneEmptyDays + replenishCarouselIfNeeded
  const cards = [];
  const carouselEl = {
    innerHTML: "",
    appendChild(card) {
      cards.push(card);
    },
    querySelectorAll(sel) {
      if (sel === ".kb-date-card") return cards;
      return [];
    },
    querySelector(sel) {
      const m = sel.match(/\[data-date="([^"]+)"\]/);
      if (m) return cards.find((c) => c.dataset.date === m[1]) || null;
      return null;
    },
  };

  fakeWidget.container = {
    querySelector(sel) {
      if (sel === "#kb-date-carousel") return carouselEl;
      const m = sel.match(/\.kb-date-card\[data-date="([^"]+)"\]/);
      if (m) return cards.find((c) => c.dataset.date === m[1]) || null;
      return null;
    },
  };
  fakeWidget.createDateCard = (day) => {
    const card = {
      dataset: { date: day.iso },
      classList: { contains: () => false },
      remove() {
        const idx = cards.indexOf(card);
        if (idx !== -1) cards.splice(idx, 1);
      },
    };
    return card;
  };
  fakeWidget.fetchFilteredSlots = async (iso) => {
    if (fullDates.has(iso)) return [];
    return [{ time: "10:00" }];
  };

  fakeWidget._carouselSeq = 1;
  fakeWidget._targetCarouselDays = 10;
  fakeWidget._prefetchedSlots = {};
  const initial10 = allMariaDays.slice(0, 10);
  fakeWidget._reserveAttendanceDays = allMariaDays.slice(10);
  initial10.forEach((d) => carouselEl.appendChild(fakeWidget.createDateCard(d)));

  await fakeWidget.pruneEmptyDays(initial10.slice(1), 1);
  assert.equal(
    cards.length,
    10,
    `Tras descartar 5 días llenos de María, el carrusel debe reponer desde las semanas siguientes y mostrar 10 días (mostró: ${cards.length})`
  );
  for (const c of cards) {
    assert.ok(!fullDates.has(c.dataset.date), `El día lleno ${c.dataset.date} no debe quedar en el carrusel`);
  }
});

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n🎉 ${passed}/${passed} verificaciones de respaldo de calendario superadas con éxito.`);
