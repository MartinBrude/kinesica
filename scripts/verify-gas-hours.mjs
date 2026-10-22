// Verifica que el Apps Script de reservas tome los horarios del admin (settings.php) en runtime.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "booking/google-apps-script.js"), "utf8");

function load({ adminHours, status = 200, throws = false, events = [], props = {} }) {
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
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    SpreadsheetApp: {
      openById: () => ({
        getActiveSheet: () => ({
          getDataRange: () => ({
            getValues: () => [["Nombre", "x", "Telefono"], ["Juana Pérez", "", "+54 9 11 2222-3333"]],
          }),
        }),
      }),
    },
    CalendarApp: {
      getCalendarById: () => ({
        getName: () => "consultorio",
        getId: () => "secret-calendar@group.calendar.google.com",
        getEvents: () => events.map((e) => ({
          getTitle: () => e.title,
          getStartTime: () => new Date(e.start),
          getEndTime: () => new Date(e.end),
        })),
      }),
    },
    Utilities: {
      formatDate(d, tz, fmt) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).formatToParts(d).map((p) => [p.type, p.value]));
        return fmt === "HH:mm" ? `${parts.hour}:${parts.minute}` : `${parts.year}-${parts.month}-${parts.day}`;
      },
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
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

// --- Privacidad: get_slots / get_slots_range son públicos y no deben exponer eventos ---
function nextWeekday(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const ALL_WEEK = { maria: Object.fromEntries([1, 2, 3, 4, 5].map((k) => [k, [{ start: "09:00", end: "17:00" }]])), norberto: {} };

test("get_slots no devuelve eventsDetected, nombres ni calendarId", () => {
  const day = nextWeekday(7);
  const events = [{ title: "Juana Pérez [MARIA]", start: `${day}T13:00:00Z`, end: `${day}T14:00:00Z` }];
  const { ctx } = load({ adminHours: ALL_WEEK, events });
  const body = ctx.doGet({ parameter: { action: "get_slots", date: day, practitioner: "maria" } }).text;
  const data = JSON.parse(body);
  assert.equal(data.status, "success");
  assert.ok(Array.isArray(data.availableSlots) && data.availableSlots.length > 0);
  assert.ok(!("eventsDetected" in data) && !("calendarId" in data));
  assert.ok(!body.includes("Juana") && !body.includes("secret-calendar"));
  assert.ok(!data.availableSlots.some((s) => s.time === "10:00"), "el turno ocupado sigue bloqueado");
});

test("get_slots_range tampoco expone eventos", () => {
  const from = nextWeekday(7);
  const events = [{ title: "Juana Pérez [MARIA]", start: `${from}T13:00:00Z`, end: `${from}T14:00:00Z` }];
  const { ctx } = load({ adminHours: ALL_WEEK, events });
  const body = ctx.doGet({ parameter: { action: "get_slots_range", from, to: from, practitioner: "maria" } }).text;
  assert.equal(JSON.parse(body).status, "success");
  assert.ok(!body.includes("Juana") && !body.includes("eventsDetected"));
});

// --- check_patient / get_directory exigen secret == GAS_API_SECRET ---
const SECRET = "s".repeat(32);
const leaks = (body) => body.includes("Juana") || body.includes("22223333") || body.includes("is_habitual") || body.includes("directory\"");
const post = (ctx, obj) => ctx.doPost({ postData: { contents: JSON.stringify(obj) } }).text;

test("sin GAS_API_SECRET configurado: unauthorized aunque se mande secret", () => {
  const { ctx } = load({ adminHours: ALL_WEEK });
  for (const body of [
    ctx.doGet({ parameter: { action: "get_directory", secret: SECRET } }).text,
    ctx.doGet({ parameter: { action: "check_patient", telefono: "1122223333", secret: SECRET } }).text,
    post(ctx, { action: "check_patient", telefono: "1122223333", secret: SECRET }),
  ]) {
    assert.deepEqual(JSON.parse(body), { status: "error", message: "unauthorized" });
    assert.ok(!leaks(body));
  }
});

test("secret ausente o incorrecto: unauthorized sin datos", () => {
  const { ctx } = load({ adminHours: ALL_WEEK, props: { GAS_API_SECRET: SECRET } });
  for (const secret of [undefined, "", "x", SECRET.slice(1) + "t"]) {
    const p = secret === undefined ? {} : { secret };
    for (const body of [
      ctx.doGet({ parameter: { action: "get_directory", ...p } }).text,
      ctx.doGet({ parameter: { action: "check_patient", telefono: "1122223333", ...p } }).text,
      post(ctx, { action: "check_patient", telefono: "1122223333", ...p }),
    ]) {
      assert.deepEqual(JSON.parse(body), { status: "error", message: "unauthorized" });
      assert.ok(!leaks(body));
    }
  }
});

test("secret correcto: check_patient y get_directory responden como antes", () => {
  const { ctx } = load({ adminHours: ALL_WEEK, props: { GAS_API_SECRET: SECRET } });
  const dir = JSON.parse(ctx.doGet({ parameter: { action: "get_directory", secret: SECRET } }).text);
  assert.equal(dir.status, "success");
  assert.equal(dir.directory["juana perez"], "5491122223333");
  const g = JSON.parse(ctx.doGet({ parameter: { action: "check_patient", telefono: "1122223333", secret: SECRET } }).text);
  assert.equal(g.is_habitual, true);
  assert.equal(g.nombre, "Juana Pérez");
  const p = JSON.parse(post(ctx, { action: "check_patient", telefono: "1122223333", secret: SECRET }));
  assert.equal(p.nombre, "Juana Pérez");
});

test("las demás acciones no piden secret", () => {
  const { ctx } = load({ adminHours: ALL_WEEK, props: { GAS_API_SECRET: SECRET } });
  const day = nextWeekday(7);
  assert.equal(JSON.parse(ctx.doGet({ parameter: { action: "get_slots", date: day } }).text).status, "success");
  assert.equal(JSON.parse(ctx.doGet({ parameter: { action: "ping" } }).text).status, "online");
});

console.log(`apps script horarios admin: ok (${n} pruebas)`);
