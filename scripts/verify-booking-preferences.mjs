#!/usr/bin/env node
/**
 * Test Suite: Preferencia de Profesional (Hombre / Mujer / Indistinto),
 * píldora en Paso 2 y enfoque limpio en Agendar (sin tarjetas sobrantes).
 * =========================================================================
 * Ejecución: node scripts/verify-booking-preferences.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const BookingWidget = require(path.join(root, "booking/booking-widget.js"));
const BookingWidgetCopy = require(path.join(root, "booking/booking-widget-copy.js"));
const engine = require(path.join(root, "booking/booking-engine.js"));
const { AGENDAR } = await import(path.join(root, "scripts/agendar-content.mjs"));

console.log("🩺 Ejecutando tests de preferencias de profesional y página Agendar...\n");

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

// Helper: DOM simulado para probar el widget en Node.js
function createMockElement(id = "", tag = "div") {
  const attrs = {};
  const listeners = {};
  const classes = new Set();
  const children = [];

  const el = {
    id,
    tagName: tag.toUpperCase(),
    dataset: {},
    style: {},
    hidden: false,
    textContent: "",
    innerHTML: "",
    children,
    parentNode: null,
    get className() {
      return Array.from(classes).join(" ");
    },
    set className(val) {
      classes.clear();
      String(val || "").split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
    },
    classList: {
      add: (...c) => c.forEach((cls) => classes.add(cls)),
      remove: (...c) => c.forEach((cls) => classes.delete(cls)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classes.has(c)) { classes.delete(c); return false; }
          classes.add(c); return true;
        }
        if (force) { classes.add(c); return true; }
        classes.delete(c); return false;
      },
      contains: (c) => classes.has(c),
    },
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    removeAttribute: (k) => { delete attrs[k]; },
    addEventListener: (event, fn) => {
      (listeners[event] = listeners[event] || []).push(fn);
    },
    click: () => {
      (listeners.click || []).forEach((fn) => fn({ target: el }));
    },
    appendChild: (child) => {
      children.push(child);
      child.parentNode = el;
      return child;
    },
    querySelectorAll: (sel) => {
      const results = [];
      function walk(node) {
        if (matchesSel(node, sel)) results.push(node);
        (node.children || []).forEach(walk);
      }
      (el.children || []).forEach(walk);
      return results;
    },
    querySelector: (sel) => {
      const all = el.querySelectorAll(sel);
      return all.length > 0 ? all[0] : null;
    },
    scrollIntoView: () => {},
  };

  function matchesSel(node, sel) {
    if (!sel || !node) return false;
    if (sel.startsWith("#") && node.id === sel.slice(1)) return true;
    if (sel.startsWith(".") && node.classList && node.classList.contains(sel.slice(1))) return true;
    if (sel.includes("[data-practitioner=")) {
      const m = sel.match(/\[data-practitioner="([^"]+)"\]/);
      if (m && node.dataset && node.dataset.practitioner === m[1]) return true;
    }
    return false;
  }

  return el;
}

globalThis.document = {
  createElement: (tag) => createMockElement("", tag),
};

// 1. Tests unitarios de getPractitionerPreferenceDisplay
test("getPractitionerPreferenceDisplay: paciente habitual devuelve null", () => {
  const widget = Object.create(BookingWidget.prototype);
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: true, techniqueId: "rpg", practitionerPreference: "any" };
  assert.strictEqual(widget.getPractitionerPreferenceDisplay(), null);
});

test("getPractitionerPreferenceDisplay: técnica mono-profesional sin preferencia explícita devuelve null", () => {
  const widget = Object.create(BookingWidget.prototype);
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: "osteopatia", practitionerPreference: null };
  assert.strictEqual(widget.getPractitionerPreferenceDisplay(), null);
});

test("getPractitionerPreferenceDisplay: técnica multi-profesional por defecto ('any') devuelve 'Indistinto'", () => {
  const widget = Object.create(BookingWidget.prototype);
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: "rpg", practitionerPreference: "any" };
  assert.strictEqual(widget.getPractitionerPreferenceDisplay(), "Indistinto");
});

test("getPractitionerPreferenceDisplay: 'norberto' devuelve 'Hombre' y 'maria' devuelve 'Mujer'", () => {
  const widget = Object.create(BookingWidget.prototype);
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: "rpg", practitionerPreference: "norberto" };
  assert.strictEqual(widget.getPractitionerPreferenceDisplay(), "Hombre");

  widget.state.practitionerPreference = "maria";
  assert.strictEqual(widget.getPractitionerPreferenceDisplay(), "Mujer");
});

test("getPractitionerPreferenceDisplay: soporte multi-idioma (EN, FR, PT)", () => {
  const langs = [
    { lang: "en", expectedAny: "No preference", expectedMale: "Male", expectedFemale: "Female" },
    { lang: "fr", expectedAny: "Indifférent", expectedMale: "Homme", expectedFemale: "Femme" },
    { lang: "pt", expectedAny: "Indiferente", expectedMale: "Homem", expectedFemale: "Mulher" },
  ];

  for (const { lang, expectedAny, expectedMale, expectedFemale } of langs) {
    const widget = Object.create(BookingWidget.prototype);
    widget.copy = BookingWidgetCopy.COPY[lang];
    widget.state = { existingPatient: false, techniqueId: "rpg", practitionerPreference: "any" };
    assert.strictEqual(widget.getPractitionerPreferenceDisplay(), expectedAny);

    widget.state.practitionerPreference = "norberto";
    assert.strictEqual(widget.getPractitionerPreferenceDisplay(), expectedMale);

    widget.state.practitionerPreference = "maria";
    assert.strictEqual(widget.getPractitionerPreferenceDisplay(), expectedFemale);
  }
});

test("getPractitionerPreferenceDisplay: resiliencia ante tipos anómalos o valores vacíos", () => {
  const widget = Object.create(BookingWidget.prototype);
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = null;
  assert.strictEqual(widget.getPractitionerPreferenceDisplay(), null);

  widget.state = { existingPatient: false, techniqueId: null, practitionerPreference: 123 };
  assert.strictEqual(widget.getPractitionerPreferenceDisplay(), null);

  widget.state = { existingPatient: false, techniqueId: "tecnica_inexistente", practitionerPreference: undefined };
  assert.strictEqual(widget.getPractitionerPreferenceDisplay(), null);
});

// 2. Tests de selectTechnique y selección por defecto
test("selectTechnique: técnica con 2 profesionales (RPG) preselecciona 'any' e id null", () => {
  const container = createMockElement("container");
  const techGrid = createMockElement("kb-technique-grid");
  const techMoreGrid = createMockElement("kb-technique-more-grid");
  const pracBox = createMockElement("kb-practitioner-box");
  const pracGrid = createMockElement("kb-practitioner-grid");
  const btnNext1 = createMockElement("kb-btn-next-1");

  container.appendChild(techGrid);
  container.appendChild(techMoreGrid);
  container.appendChild(pracBox);
  container.appendChild(pracGrid);
  container.appendChild(btnNext1);

  const widget = Object.create(BookingWidget.prototype);
  widget.container = container;
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: null, practitionerPreference: null, practitionerId: null };

  widget.selectTechnique("rpg");

  assert.strictEqual(widget.state.techniqueId, "rpg");
  assert.strictEqual(widget.state.practitionerPreference, "any");
  assert.strictEqual(widget.state.practitionerId, null);
  assert.strictEqual(pracBox.hidden, false, "El contenedor de preferencias debe ser visible");
});

test("selectTechnique: técnica con 1 profesional (Osteopatía) fija id 'norberto' y oculta preferencias", () => {
  const container = createMockElement("container");
  const techGrid = createMockElement("kb-technique-grid");
  const techMoreGrid = createMockElement("kb-technique-more-grid");
  const pracBox = createMockElement("kb-practitioner-box");
  const pracGrid = createMockElement("kb-practitioner-grid");
  const btnNext1 = createMockElement("kb-btn-next-1");

  container.appendChild(techGrid);
  container.appendChild(techMoreGrid);
  container.appendChild(pracBox);
  container.appendChild(pracGrid);
  container.appendChild(btnNext1);

  const widget = Object.create(BookingWidget.prototype);
  widget.container = container;
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: null, practitionerPreference: null, practitionerId: null };

  widget.selectTechnique("osteopatia");

  assert.strictEqual(widget.state.techniqueId, "osteopatia");
  assert.strictEqual(widget.state.practitionerPreference, null);
  assert.strictEqual(widget.state.practitionerId, "norberto");
  assert.strictEqual(pracBox.hidden, true, "El contenedor de preferencias debe estar oculto");
});

test("selectTechnique: técnica con 1 profesional (Acupuntura) fija id 'maria' y oculta preferencias", () => {
  const container = createMockElement("container");
  const techGrid = createMockElement("kb-technique-grid");
  const techMoreGrid = createMockElement("kb-technique-more-grid");
  const pracBox = createMockElement("kb-practitioner-box");
  const pracGrid = createMockElement("kb-practitioner-grid");
  const btnNext1 = createMockElement("kb-btn-next-1");

  container.appendChild(techGrid);
  container.appendChild(techMoreGrid);
  container.appendChild(pracBox);
  container.appendChild(pracGrid);
  container.appendChild(btnNext1);

  const widget = Object.create(BookingWidget.prototype);
  widget.container = container;
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: null, practitionerPreference: null, practitionerId: null };

  widget.selectTechnique("acupuntura");

  assert.strictEqual(widget.state.techniqueId, "acupuntura");
  assert.strictEqual(widget.state.practitionerPreference, null);
  assert.strictEqual(widget.state.practitionerId, "maria");
  assert.strictEqual(pracBox.hidden, true, "El contenedor de preferencias debe estar oculto");
});

// 3. Tests de renderPractitionerChoices y comportamiento de click
test("renderPractitionerChoices: marca 'any' (Indistinto) con clase 'selected' por defecto", () => {
  const container = createMockElement("container");
  const pracBox = createMockElement("kb-practitioner-box");
  const pracGrid = createMockElement("kb-practitioner-grid");
  const btnNext1 = createMockElement("kb-btn-next-1");

  container.appendChild(pracBox);
  container.appendChild(pracGrid);
  container.appendChild(btnNext1);

  const widget = Object.create(BookingWidget.prototype);
  widget.container = container;
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: "rpg", practitionerPreference: "any", practitionerId: null };

  const technique = engine.getTechnique("rpg");
  widget.renderPractitionerChoices(technique);

  const cards = pracGrid.children;
  assert.strictEqual(cards.length, 3, "Debe tener 3 tarjetas: Norberto, María, Indistinto");

  const cardNorberto = cards.find((c) => c.dataset.practitioner === "norberto");
  const cardMaria = cards.find((c) => c.dataset.practitioner === "maria");
  const cardAny = cards.find((c) => c.dataset.practitioner === "any");

  assert.ok(cardNorberto && cardMaria && cardAny);
  assert.strictEqual(cardNorberto.classList.contains("selected"), false);
  assert.strictEqual(cardMaria.classList.contains("selected"), false);
  assert.strictEqual(cardAny.classList.contains("selected"), true, "Indistinto debe tener la clase selected");
});

test("renderPractitionerChoices: clic alterna entre opciones y re-clic en género vuelve a 'any'", () => {
  const container = createMockElement("container");
  const pracBox = createMockElement("kb-practitioner-box");
  const pracGrid = createMockElement("kb-practitioner-grid");
  const btnNext1 = createMockElement("kb-btn-next-1");

  container.appendChild(pracBox);
  container.appendChild(pracGrid);
  container.appendChild(btnNext1);

  const widget = Object.create(BookingWidget.prototype);
  widget.container = container;
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: "rpg", practitionerPreference: "any", practitionerId: null };

  const technique = engine.getTechnique("rpg");
  widget.renderPractitionerChoices(technique);

  const cardNorberto = pracGrid.children.find((c) => c.dataset.practitioner === "norberto");
  const cardMaria = pracGrid.children.find((c) => c.dataset.practitioner === "maria");
  const cardAny = pracGrid.children.find((c) => c.dataset.practitioner === "any");

  // 1. Clic en Hombre
  cardNorberto.click();
  assert.strictEqual(widget.state.practitionerPreference, "norberto");
  assert.strictEqual(widget.state.practitionerId, "norberto");
  assert.strictEqual(cardNorberto.classList.contains("selected"), true);
  assert.strictEqual(cardAny.classList.contains("selected"), false);

  // 2. Re-clic en Hombre: debe volver a 'any'
  cardNorberto.click();
  assert.strictEqual(widget.state.practitionerPreference, "any");
  assert.strictEqual(widget.state.practitionerId, null);
  assert.strictEqual(cardNorberto.classList.contains("selected"), false);
  assert.strictEqual(cardAny.classList.contains("selected"), true);

  // 3. Clic en Mujer
  cardMaria.click();
  assert.strictEqual(widget.state.practitionerPreference, "maria");
  assert.strictEqual(widget.state.practitionerId, "maria");
  assert.strictEqual(cardMaria.classList.contains("selected"), true);

  // 4. Clic directo en Indistinto
  cardAny.click();
  assert.strictEqual(widget.state.practitionerPreference, "any");
  assert.strictEqual(widget.state.practitionerId, null);
  assert.strictEqual(cardAny.classList.contains("selected"), true);
  assert.strictEqual(cardMaria.classList.contains("selected"), false);
});

// 4. Tests de Paso 2 y píldora de preferencia
test("Paso 2: píldora visible y con texto correcto para técnicas multi-profesional", () => {
  const container = createMockElement("container");
  const prefBox = createMockElement("kb-step2-pref-container");
  const prefVal = createMockElement("kb-step2-pref-val");
  const subtitle = createMockElement("kb-slots-subtitle");
  container.appendChild(prefBox);
  container.appendChild(prefVal);
  container.appendChild(subtitle);

  const widget = Object.create(BookingWidget.prototype);
  widget.container = container;
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: "rpg", practitionerPreference: "any" };

  // Simular lógica de setStep(2)
  const prefText = widget.getPractitionerPreferenceDisplay();
  if (prefText) {
    prefVal.textContent = prefText;
    prefBox.style.display = "block";
  } else {
    prefBox.style.display = "none";
  }

  assert.strictEqual(prefBox.style.display, "block");
  assert.strictEqual(prefVal.textContent, "Indistinto");
});

test("Paso 2: píldora oculta para técnicas mono-profesional (Osteopatía)", () => {
  const container = createMockElement("container");
  const prefBox = createMockElement("kb-step2-pref-container");
  const prefVal = createMockElement("kb-step2-pref-val");
  container.appendChild(prefBox);
  container.appendChild(prefVal);

  const widget = Object.create(BookingWidget.prototype);
  widget.container = container;
  widget.copy = BookingWidgetCopy.COPY.es;
  widget.state = { existingPatient: false, techniqueId: "osteopatia", practitionerPreference: null, practitionerId: "norberto" };

  const prefText = widget.getPractitionerPreferenceDisplay();
  if (prefText) {
    prefVal.textContent = prefText;
    prefBox.style.display = "block";
  } else {
    prefBox.style.display = "none";
  }

  assert.strictEqual(prefBox.style.display, "none");
  assert.strictEqual(prefText, null);
});

// 5. Tests de generación de páginas Agendar (sin tarjetas de destacados)
test("HTML Agendar (ES, EN, FR, PT): no contienen booking-highlights-grid y contienen mount de widget", () => {
  const pages = ["agendar.html", "en/agendar.html", "fr/agendar.html", "pt/agendar.html"];
  for (const p of pages) {
    const fullPath = path.join(root, p);
    assert.ok(fs.existsSync(fullPath), `El archivo ${p} debe existir`);
    const content = fs.readFileSync(fullPath, "utf8");
    assert.strictEqual(
      content.includes("booking-highlights-grid"),
      false,
      `${p} no debe contener booking-highlights-grid`
    );
    assert.strictEqual(
      content.includes("booking-highlight-card"),
      false,
      `${p} no debe contener booking-highlight-card`
    );
    assert.ok(
      content.includes('id="kinesica-booking-widget"'),
      `${p} debe contener el contenedor kinesica-booking-widget`
    );
  }
});

test("scripts/agendar-content.mjs: sin bloques de highlights muertos (DRY y limpieza)", () => {
  for (const lang of ["es", "en", "fr", "pt"]) {
    assert.strictEqual(
      AGENDAR[lang].highlights,
      undefined,
      `AGENDAR.${lang} no debe tener propiedad highlights`
    );
  }
});

test("css/style.css: .booking-page-widget-mount tiene margin: 0 auto; y no hay booking-highlights-grid", () => {
  const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
  assert.ok(
    css.includes(".booking-page-widget-mount {\n  position: relative;\n  margin: 0 auto;"),
    "booking-page-widget-mount debe tener margin: 0 auto;"
  );
  assert.strictEqual(
    css.includes(".booking-highlights-grid"),
    false,
    "css/style.css no debe contener .booking-highlights-grid"
  );
});

console.log(`\n🎉 Resultado: ${passed}/${total} tests de preferencias y agendar superados con éxito.\n`);
