#!/usr/bin/env node
/**
 * Asegura que JS (dni-rules), PHP (lib_booking_dni) y GAS (isValidBookingDni)
 * compartan la misma regla de DNI/pasaporte.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const rules = require(path.join(root, "booking/dni-rules.js"));
const Validation = require(path.join(root, "booking/booking-validation.js"));

const cases = [
  ["30123456", true],
  ["30.123.456", true],
  ["A1234567", true],
  ["1234", false],
  ["1234567890123", false], // > digitMax 12
  ["No provisto", false],
  ["", false],
  ["AB12", false],
  ["PASS12345678901234567", false], // > alnumMax 20
  ["PASS12345", true],
];

let n = 0;
for (const [raw, expected] of cases) {
  assert.equal(rules.isValidBookingDni(raw), expected, `dni-rules: ${JSON.stringify(raw)}`);
  assert.equal(Validation.isValidDni(raw), expected, `booking-validation: ${JSON.stringify(raw)}`);
  n += 2;
}

const php = spawnSync("php", ["-r", `
require '${path.join(root, "admin/api/lib_booking_dni.php")}';
$cases = json_decode('${JSON.stringify(cases).replace(/'/g, "\\'")}', true);
foreach ($cases as [$raw, $expected]) {
  $got = kinesica_is_valid_booking_dni($raw);
  if ($got !== (bool)$expected) {
    fwrite(STDERR, "PHP mismatch for " . json_encode($raw) . " got " . ($got ? "true" : "false") . "\\n");
    exit(1);
  }
}
echo "ok\\n";
`], { encoding: "utf8" });
assert.equal(php.status, 0, php.stderr || php.stdout || "php failed");
n += cases.length;

const gasSrc = fs.readFileSync(path.join(root, "booking/google-apps-script.js"), "utf8");
assert.match(gasSrc, /function isValidBookingDni\(raw\)/);
assert.match(gasSrc, /alnum\.length >= 5 && alnum\.length <= 12/);
assert.match(gasSrc, /alnum\.length >= 5 && alnum\.length <= 20/);
assert.match(gasSrc, /\/\[A-Za-z\]\/\.test\(alnum\)/);
assert.match(gasSrc, /isAdminBooking = wantsAdmin && isAuthorizedSecret\(payload\)/);
n += 4;

assert.equal(rules.RULES.digitMin, 5);
assert.equal(rules.RULES.digitMax, 12);
assert.equal(rules.RULES.alnumMin, 5);
assert.equal(rules.RULES.alnumMax, 20);
n += 4;

console.log(`verify-booking-dni-rules: ${n} checks OK`);
