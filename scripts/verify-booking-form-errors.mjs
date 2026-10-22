#!/usr/bin/env node
/**
 * Errores por campo del formulario "Completa tus datos" (turnera).
 * Ejecución: node scripts/verify-booking-form-errors.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const BookingWidget = require(path.join(root, "booking/booking-widget.js"));
const src = fs.readFileSync(path.join(root, "booking/booking-widget.js"), "utf8");

let n = 0;
const test = (name, fn) => { fn(); n += 1; };
const t = (k) => `T:${k}`;
const ok = { isOther: false, contactoNombre: "", contactoTelefono: "", nombre: "Ana Pérez", email: "ana@x.com", telefono: "11 2222 3333", usesContactPhone: false };

// --- Fake DOM mínimo ---
function makeEl(id, tag = "input") {
  const attrs = {};
  const listeners = {};
  const cls = new Set();
  const el = {
    id, tagName: tag.toUpperCase(), hidden: tag === "div", textContent: "", disabled: false, focused: 0,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    removeAttribute: (k) => { delete attrs[k]; },
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    dispatch: (ev) => (listeners[ev] || []).forEach((fn) => fn({ type: ev })),
    focus: () => { el.focused += 1; },
    scrollIntoView: () => {},
  };
  return el;
}
function makeWidget() {
  const els = {};
  for (const f of BookingWidget.FORM_FIELDS) {
    els[`kb-input-${f}`] = makeEl(`kb-input-${f}`);
    els[`kb-err-${f}`] = makeEl(`kb-err-${f}`, "div");
  }
  const w = Object.create(BookingWidget.prototype);
  w.container = { querySelector: (sel) => els[sel.replace(/^#/, "")] || null };
  // mismo cableado que bindEvents: input en cada campo limpia SOLO su error
  for (const f of BookingWidget.FORM_FIELDS) els[`kb-input-${f}`].addEventListener("input", () => w.clearFieldError(f));
  return { w, els };
}

test("sin errores con datos válidos", () => {
  assert.deepEqual(BookingWidget.validateContactForm(ok, t), []);
});

test("todos los errores a la vez, en orden visual, con los textos i18n", () => {
  const errs = BookingWidget.validateContactForm({ ...ok, isOther: true, nombre: "", email: "mal", telefono: "12" }, t);
  assert.deepEqual(errs.map((e) => e.field), ["contacto-nombre", "contacto-telefono", "nombre", "email", "telefono"]);
  assert.deepEqual(errs.map((e) => e.message), ["T:errContactName", "T:errContactPhone", "T:errPatientName", "T:emailInvalid", "T:errPhone"]);
});

test("teléfono heredado de quien agenda: el error queda solo en ese campo", () => {
  const errs = BookingWidget.validateContactForm({ ...ok, isOther: true, contactoNombre: "Laura", contactoTelefono: "", telefono: "", usesContactPhone: true }, t);
  assert.deepEqual(errs.map((e) => e.field), ["contacto-telefono"]);
});

test("DNI no es obligatorio (sin cambios)", () => {
  assert.equal(BookingWidget.validateContactForm({ ...ok }, t).some((e) => e.field === "dni"), false);
});

test("showFieldErrors marca campo, aria y role=alert, y enfoca el primero", () => {
  const { w, els } = makeWidget();
  w.showFieldErrors([{ field: "nombre", message: "falta nombre" }, { field: "email", message: "mail malo" }]);
  for (const [f, msg] of [["nombre", "falta nombre"], ["email", "mail malo"]]) {
    const input = els[`kb-input-${f}`]; const box = els[`kb-err-${f}`];
    assert.equal(box.hidden, false); assert.equal(box.textContent, msg);
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(input.getAttribute("aria-describedby"), `kb-err-${f}`);
    assert.ok(input.classList.contains("kb-input-invalid"));
  }
  assert.equal(els["kb-input-nombre"].focused, 1);
  assert.equal(els["kb-input-email"].focused, 0);
});

test("el error persiste hasta que se escribe en ESE campo", () => {
  const { w, els } = makeWidget();
  w.showFieldErrors([{ field: "nombre", message: "a" }, { field: "email", message: "b" }]);
  els["kb-input-email"].dispatch("input");
  assert.equal(els["kb-err-email"].hidden, true);
  assert.equal(els["kb-input-email"].getAttribute("aria-invalid"), null);
  assert.equal(els["kb-input-email"].getAttribute("aria-describedby"), null);
  assert.equal(els["kb-err-nombre"].hidden, false, "el error de otro campo sigue visible");
  assert.ok(els["kb-input-nombre"].classList.contains("kb-input-invalid"));
});

test("plantilla: cada campo tiene su contenedor role=alert y se cablea el evento input", () => {
  for (const f of ["contacto-nombre", "contacto-telefono", "nombre", "email", "telefono", "dni"]) {
    assert.match(src, new RegExp(`id="kb-err-${f}" role="alert"`));
  }
  assert.match(src, /addEventListener\("input", \(\) => this\.clearFieldError\(field\)\)/);
  assert.doesNotMatch(src, /showError\("Por favor ingresá/, "ya no hay avisos transitorios del formulario");
});

test("i18n: los 4 idiomas tienen los textos de error", () => {
  for (const k of ["errContactName", "errContactPhone", "errPatientName", "errPhone", "emailInvalid"]) {
    assert.equal((src.match(new RegExp(`\\b${k}: "`, "g")) || []).length, 4, k);
  }
});

console.log(`formulario de datos (errores por campo): ok (${n} pruebas)`);
