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
  assert.match(src, /addEventListener\("input",\s*\(\)\s*=>\s*\{[\s\S]*?this\.clearFieldError\(field\)/);
  assert.doesNotMatch(src, /showError\("Por favor ingresá/, "ya no hay avisos transitorios del formulario");
});

test("i18n: los 4 idiomas tienen los textos de error y confirmación de teléfono", () => {
  for (const k of ["errContactName", "errContactPhone", "errPatientName", "errPhone", "phoneConfirm", "emailInvalid"]) {
    assert.equal((src.match(new RegExp(`\\b${k}: "`, "g")) || []).length, 4, k);
  }
});

test("restricción de input en vivo (sanitizeFieldInput): filtra caracteres inválidos antes de enviar", () => {
  assert.equal(BookingWidget.sanitizeFieldInput("telefono", "+54 abc 9 11 2233-4455!"), "+54  9 11 2233-4455");
  assert.equal(BookingWidget.sanitizeFieldInput("telefono", "11+22+33"), "112233", "el + solo se permite al inicio");
  assert.equal(BookingWidget.sanitizeFieldInput("email", " juan.perez @ gmail.com "), "juan.perez@gmail.com");
  assert.equal(BookingWidget.sanitizeFieldInput("nombre", "María José 123 @$!"), "María José ");
  assert.equal(BookingWidget.sanitizeFieldInput("dni", "30.123.456<script>"), "30.123.456script");
});

test("validación estricta de email: rechaza dominios o sintaxis inválida", () => {
  for (const valid of ["ana@ejemplo.com", "juan.perez+turnos@clinica.com.ar", "user_1@sub.domain.org"]) {
    assert.equal(BookingWidget.isValidEmail(valid), true, `debe aceptar ${valid}`);
  }
  for (const invalid of ["", "sin-arroba.com", "a@b", "a@b.c", "a..b@ejemplo.com", ".ana@ejemplo.com", "ana@ejemplo..com", "ana@-ejemplo.com", "ana@ejemplo.123", "ana perez@ejemplo.com"]) {
    assert.equal(BookingWidget.isValidEmail(invalid), false, `debe rechazar ${invalid}`);
  }
});

test("teléfonos internacionales y argentinos estándar pasan directo sin repregunta", () => {
  for (const stdPhone of [
    "11 6156-4311",
    "+54 9 11 6156 4311",
    "011 15 6156 4311",
    "+34 612 345 678",
    "+598 99 123 456",
    "+56 9 8765 4321",
    "+55 11 98765 4321",
    "+1 305 555 0199",
    "0034 612 345 678",
  ]) {
    assert.deepEqual(
      BookingWidget.validateContactForm({ ...ok, telefono: stdPhone }, t),
      [],
      `debe aceptar directo ${stdPhone}`
    );
  }
});

test("teléfono con formato inusual (>=6 dígitos): repregunta una vez pero siempre deja pasar al confirmar", () => {
  const unusual = "4567890"; // 7 dígitos sin prefijo internacional ni formato AR estándar
  const confirmedPhones = new Set();
  const firstAttempt = BookingWidget.validateContactForm(
    { ...ok, telefono: unusual, confirmedPhones },
    t
  );
  assert.equal(firstAttempt.length, 1);
  assert.equal(firstAttempt[0].field, "telefono");
  assert.equal(firstAttempt[0].message, "T:phoneConfirm");
  assert.equal(firstAttempt[0].isSoftPhoneConfirm, true);
  // Al registrar que ya se repreguntó ese número, el segundo intento pasa sin bloquear
  confirmedPhones.add(firstAttempt[0].phoneDigits);
  const secondAttempt = BookingWidget.validateContactForm(
    { ...ok, telefono: unusual, confirmedPhones },
    t
  );
  assert.deepEqual(secondAttempt, []);
});

test("teléfono inválido (<6 dígitos o todos repetidos): bloquea siempre", () => {
  for (const bad of ["12345", "1111111111", "00000000", "abc"]) {
    const errs = BookingWidget.validateContactForm({ ...ok, telefono: bad }, t);
    assert.equal(errs.length, 1, `debe bloquear ${bad}`);
    assert.equal(errs[0].message, "T:errPhone");
    assert.ok(!errs[0].isSoftPhoneConfirm);
  }
});

console.log(`formulario de datos (errores por campo): ok (${n} pruebas)`);
