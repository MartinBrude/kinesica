// Verifica que el Apps Script de reservas tome los horarios del admin (settings.php) en runtime.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "booking/google-apps-script.js"), "utf8");

function load({ adminHours, status = 200, throws = false }) {
  const calls = [];
  const store = {};
  const ctx = {
    console,
    UrlFetchApp: {
      fetch(url) {
        calls.push(url);
        if (throws) throw new Error("network");
        return {
          getResponseCode: () => status,
          getContentText: () => JSON.stringify({ practitioner_hours: adminHours }),
        };
      },
    },
    CacheService: { getScriptCache: () => ({ get: (k) => store[k] || null, put: (k, v) => { store[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ctx, calls };
}

let n = 0;
const test = (name, fn) => { fn(); n += 1; };
const ADMIN = { maria: { 3: [{ start: "10:00", end: "12:00" }] }, norberto: {} };
const CLIENT = JSON.stringify({ maria: { 3: [{ start: "07:00", end: "22:00" }] }, norberto: {} });

test("usa los horarios del admin (settings.php)", () => {
  const { ctx, calls } = load({ adminHours: ADMIN });
  const w = ctx.getGasWorkingWindows("maria", 3, null);
  assert.deepEqual(JSON.parse(JSON.stringify(w)), [{ start: "10:00", end: "12:00" }]);
  assert.match(calls[0], /admin\/api\/settings\.php/);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.getGasWorkingWindows("norberto", 1, null))), []);
});

test("el admin prevalece sobre los horarios enviados por el navegador", () => {
  const { ctx } = load({ adminHours: ADMIN });
  assert.equal(ctx.getGasWorkingWindows("maria", 3, CLIENT)[0].start, "10:00");
});

test("una reserva nunca usa horarios del navegador (aunque falle el admin)", () => {
  const { ctx } = load({ adminHours: null, throws: true });
  const w = ctx.getGasWorkingWindows("maria", 3, CLIENT, { forBooking: true });
  assert.equal(w.length, 0); // fallback técnico: María no atiende miércoles
});

test("si el admin no responde usa el fallback técnico", () => {
  const { ctx } = load({ adminHours: null, status: 500 });
  assert.equal(ctx.getGasWorkingWindows("norberto", 4, null)[0].end, "19:00");
});

test("una sola consulta al admin por ejecución", () => {
  const { ctx, calls } = load({ adminHours: ADMIN });
  for (let d = 1; d <= 5; d++) ctx.getGasWorkingWindows("", d, null);
  assert.equal(calls.length, 1);
});

console.log(`apps script horarios admin: ok (${n} pruebas)`);
