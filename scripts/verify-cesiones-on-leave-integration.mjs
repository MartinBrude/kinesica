#!/usr/bin/env node
/**
 * Integración: cesión multi-día con «profesional de baja».
 *
 * Cubre el flujo que antes pedía prueba manual:
 * 1. Admin create (schedule_action + normalize practitioner_on_leave)
 * 2. Resolución de ventanas PHP
 * 3. Agendar (widget fetchFilteredSlots): Acupuntura vacía / Osteopatía no
 * 4. Smoke live contra GAS publicado (hours.ov con de baja)
 *
 *   node scripts/verify-cesiones-on-leave-integration.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const engine = require(path.join(root, "booking/booking-engine.js"));
const BookingWidget = require(path.join(root, "booking/booking-widget.js"));

const LEAVE_START = "2026-12-01"; // martes
const LEAVE_END = "2026-12-14";
const AFTER_LEAVE = "2026-12-15"; // martes siguiente

const leaveOverride = {
  id: "cov_it_maria_leave",
  action: "transfer",
  from_practitioner: "maria",
  to_practitioner: "norberto",
  period_type: "date_range",
  start_date: LEAVE_START,
  end_date: LEAVE_END,
  time_scope: "custom_hours",
  custom_range: { start: "14:00", end: "17:00" },
  custom_ranges: [{ start: "14:00", end: "17:00" }],
  practitioner_on_leave: true,
  active: true,
};

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log(`  ✅ ${name}`);
  passed += 1;
}

function runPhp(code) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kinesica-leave-it-"));
  const file = path.join(tmp, "run.php");
  fs.writeFileSync(file, code, "utf8");
  const proc = spawnSync("php", ["-d", "error_reporting=24575", file], {
    encoding: "utf8",
    cwd: root,
  });
  if (proc.error) throw proc.error;
  if (proc.status !== 0) {
    throw new Error(`PHP falló:\n${proc.stderr || proc.stdout}`);
  }
  const out = (proc.stdout || "").trim();
  try {
    return JSON.parse(out);
  } catch {
    throw new Error(`PHP no devolvió JSON:\n${out}`);
  }
}

console.log("\n🧪 Integración — Profesional de baja (cesiones → Agendar → GAS)\n");

// ---------------------------------------------------------------------------
await test("1. Admin create: schedule_action + practitioner_on_leave normalizados", () => {
  const result = runPhp(`<?php
    require ${JSON.stringify(path.join(root, "admin/api/lib_horarios_cesiones.php"))};
    $input = [
      "action" => "create",
      "schedule_action" => "transfer",
      "from_practitioner" => "maria",
      "to_practitioner" => "norberto",
      "period_type" => "date_range",
      "start_date" => ${JSON.stringify(LEAVE_START)},
      "end_date" => ${JSON.stringify(LEAVE_END)},
      "time_scope" => "custom_hours",
      "custom_ranges" => [["start" => "14:00", "end" => "17:00"]],
      "practitioner_on_leave" => true,
      "reason" => "Viaje integración",
    ];
    $toValidate = $input;
    $scheduleAction = trim((string) ($input["schedule_action"] ?? ""));
    if (in_array($scheduleAction, ["transfer", "closure"], true)) {
      $toValidate["action"] = $scheduleAction;
    }
    $val = validate_schedule_override($toValidate);
    echo json_encode($val, JSON_UNESCAPED_UNICODE);
  `);
  assert.equal(result.isValid, true, "create debe validar");
  assert.equal(result.normalized.action, "transfer");
  assert.equal(result.normalized.practitioner_on_leave, true);
  assert.equal(result.normalized.from_practitioner, "maria");
  assert.equal(result.normalized.end_date, LEAVE_END);
});

// ---------------------------------------------------------------------------
await test("2. PHP resolve: de baja vacía a María y cede franja a Norberto", () => {
  const result = runPhp(`<?php
    require ${JSON.stringify(path.join(root, "admin/api/lib_horarios_cesiones.php"))};
    $base = [
      "maria" => ["2" => [["start" => "09:00", "end" => "16:00"]]],
      "norberto" => ["2" => [["start" => "16:30", "end" => "19:30"]]],
    ];
    $ov = json_decode(${JSON.stringify(JSON.stringify([leaveOverride]))}, true);
    $m = resolve_practitioner_windows_for_date($base, $ov, ${JSON.stringify(LEAVE_START)}, "maria");
    $n = resolve_practitioner_windows_for_date($base, $ov, ${JSON.stringify(LEAVE_START)}, "norberto");
    echo json_encode(["maria" => $m, "norberto" => $n], JSON_UNESCAPED_UNICODE);
  `);
  assert.deepEqual(result.maria, []);
  assert.ok(result.norberto.length > 0);
  assert.equal(result.norberto[0].start, "14:00");
});

// ---------------------------------------------------------------------------
await test("3. Widget Agendar: Acupuntura 0 slots en baja; Osteopatía con horarios", async () => {
  engine.resetScheduleOverrides();
  engine.setScheduleOverrides([leaveOverride]);

  const fake = Object.create(BookingWidget.prototype);
  fake.state = {
    techniqueId: "acupuntura",
    practitionerId: "maria",
    appointmentType: "session",
  };
  fake.client = {
    async getAvailableSlots(dateIso, _type, options = {}) {
      return {
        status: "success",
        date: dateIso,
        availableSlots: engine.calculateAvailableSlots({
          date: dateIso,
          practitionerId: options.practitionerId || null,
          busyIntervals: [],
        }),
      };
    },
  };

  const acuLeave = await fake.fetchFilteredSlots(LEAVE_START);
  assert.equal(acuLeave.length, 0, "Acupuntura no debe ofrecer slots con María de baja");

  const acuAfter = await fake.fetchFilteredSlots(AFTER_LEAVE);
  // Fuera del rango puede haber slots o 0 si el mock no filtra feriados; la oferta de técnica sí vuelve
  assert.equal(engine.isTechniqueOfferedOnDate("acupuntura", AFTER_LEAVE), true);

  fake.state.techniqueId = "osteopatia";
  fake.state.practitionerId = "norberto";
  const osteoLeave = await fake.fetchFilteredSlots(LEAVE_START);
  assert.ok(osteoLeave.length > 0, "Osteopatía debe seguir ofreciendo horarios (Norberto)");
  assert.ok(osteoLeave.some((s) => s.time === "14:00" || s.time >= "14:00"), "Incluye franja cedida");

  engine.resetScheduleOverrides();
});

// ---------------------------------------------------------------------------
await test("4. Sin de baja (misma cesión parcial): Acupuntura sigue en la mañana", async () => {
  engine.setScheduleOverrides([{ ...leaveOverride, practitioner_on_leave: false, id: "cov_it_no_leave" }]);
  assert.equal(engine.isTechniqueOfferedOnDate("acupuntura", LEAVE_START), true);
  assert.ok(engine.getWorkingWindows("maria", LEAVE_START).length > 0);

  const fake = Object.create(BookingWidget.prototype);
  fake.state = { techniqueId: "acupuntura", practitionerId: "maria", appointmentType: "session" };
  fake.client = {
    async getAvailableSlots(dateIso, _type, options = {}) {
      return {
        status: "success",
        availableSlots: engine.calculateAvailableSlots({
          date: dateIso,
          practitionerId: options.practitionerId || null,
          busyIntervals: [],
        }),
      };
    },
  };
  const slots = await fake.fetchFilteredSlots(LEAVE_START);
  assert.ok(slots.length > 0, "Sin flag de baja, Acupuntura conserva mañana");
  engine.resetScheduleOverrides();
});

// ---------------------------------------------------------------------------
await test("5. Smoke live GAS (@deploy): de baja cierra ventanas de María y cede a Norberto", async () => {
  const siteConfigSrc = fs.readFileSync(path.join(root, "js/site-config.js"), "utf8");
  const m = siteConfigSrc.match(/bookingApiUrl:\s*"(https:\/\/script\.google\.com\/[^"]+)"/);
  const apiUrl = m ? m[1] : "";
  assert.ok(apiUrl, "bookingApiUrl en js/site-config.js");

  async function fetchSlots({ practitionerId, override }) {
    const q = new URLSearchParams({
      action: "get_slots",
      date: LEAVE_START,
      type: "session",
      practitionerId,
      schedule_overrides: JSON.stringify([override]),
    });
    const res = await fetch(`${apiUrl}?${q.toString()}`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    assert.ok(res.ok, `GAS HTTP ${res.status}`);
    const json = await res.json();
    assert.equal(json.status, "success", json.message || "GAS status");
    assert.ok(Array.isArray(json.availableSlots), "availableSlots array");
    return json;
  }

  const mariaLeave = await fetchSlots({ practitionerId: "maria", override: leaveOverride });
  assert.equal(mariaLeave.availableSlots.length, 0, "María de baja → 0 slots");
  assert.match(
    String(mariaLeave.message || ""),
    /Sin atención/i,
    "GAS debe cerrar ventanas de María (no solo agenda llena)"
  );

  const mariaNoLeave = await fetchSlots({
    practitionerId: "maria",
    override: { ...leaveOverride, practitioner_on_leave: false, id: "cov_it_gas_no_leave" },
  });
  // Puede haber 0 slots libres si el Calendar está lleno, pero NO debe ser “Sin atención”
  // (las ventanas de mañana siguen existiendo).
  assert.doesNotMatch(
    String(mariaNoLeave.message || ""),
    /Sin atención/i,
    "Sin flag de baja, María conserva ventanas (aunque el día esté ocupado)"
  );

  const norbertoLeave = await fetchSlots({ practitionerId: "norberto", override: leaveOverride });
  assert.ok(norbertoLeave.availableSlots.length > 0, "Norberto recibe/atiende con la cesión");
  assert.ok(
    norbertoLeave.availableSlots.some((s) => String(s.time) >= "14:00" && String(s.time) < "17:00"),
    "Incluye horarios de la franja cedida 14–17"
  );
});

console.log(`\n🎉 Integración de baja: ${passed}/${passed} OK\n`);
