/**
 * Unit tests: pastillas data-single (motivo, ruidos, …) y desync DOM vs memoria.
 * Reproduce el bug "pastilla azul / Falta completar: el motivo de consulta".
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  selectedSingleValue,
  syncSinglesFromDom,
  applySingleSelection,
  toggleSingleSelection,
} from "../admin/modules/form-singles.js";
import { missingFieldKeys, missingFields, coerceFicha } from "../admin/ficha-rules.mjs";

/** Mini DOM suficiente para pastillas (sin jsdom). */
function createPillGroup(key, options, selected = "") {
  const buttons = options.map((value) => {
    const classSet = new Set(value === selected ? ["on"] : []);
    return {
      dataset: { value },
      disabled: false,
      classList: {
        toggle(name, force) {
          if (force) classSet.add(name);
          else classSet.delete(name);
        },
        contains(name) {
          return classSet.has(name);
        },
      },
    };
  });
  return {
    dataset: { single: key },
    querySelector(sel) {
      if (sel === "button.on") return buttons.find((b) => b.classList.contains("on")) || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === "button") return buttons;
      return [];
    },
  };
}

function createFormRoot(groups) {
  return {
    querySelectorAll(sel) {
      if (sel === "[data-single]") return groups;
      return [];
    },
  };
}

const MOTIVOS = ["Traumático", "No Traumático", "Pos Quirúrgico", "Bruxismo"];

test("selectedSingleValue lee button.on", () => {
  const group = createPillGroup("motivo", MOTIVOS, "Pos Quirúrgico");
  assert.equal(selectedSingleValue(group), "Pos Quirúrgico");
  assert.equal(selectedSingleValue(createPillGroup("motivo", MOTIVOS, "")), "");
});

test("applySingleSelection sincroniza DOM y singles", () => {
  const singles = {};
  const group = createPillGroup("motivo", MOTIVOS, "");
  applySingleSelection(group, "Traumático", singles);
  assert.equal(singles.motivo, "Traumático");
  assert.equal(selectedSingleValue(group), "Traumático");
});

test("toggleSingleSelection deselecciona al repetir clic", () => {
  const singles = { motivo: "Bruxismo" };
  const group = createPillGroup("motivo", MOTIVOS, "Bruxismo");
  assert.equal(toggleSingleSelection(group, "Bruxismo", singles), "");
  assert.equal(singles.motivo, "");
  assert.equal(selectedSingleValue(group), "");
});

test("REGRESIÓN: DOM con motivo y singles vacío → syncSinglesFromDom recupera motivo", () => {
  // Escenario del bug en producción: pastilla azul, memoria desincronizada.
  const staleSingles = {}; // o un objeto distinto al que actualizó el click
  const group = createPillGroup("motivo", MOTIVOS, "Traumático");
  const root = createFormRoot([group]);

  const merged = syncSinglesFromDom(root, staleSingles);
  assert.equal(merged.motivo, "Traumático", "Debe leer Traumático desde button.on aunque singles esté vacío");

  const ficha = coerceFicha({
    nombre: "Martín Test",
    fechaSesion: "2026-11-24",
    nacimiento: "1989-05-28",
    edad: "37",
    antecedentes: "aaaa",
    ...merged,
  });
  assert.equal(ficha.motivo, "Traumático");
  assert.deepEqual(missingFieldKeys(ficha), [], "No debe faltar el motivo de consulta");
  assert.deepEqual(missingFields(ficha), []);
});

test("REGRESIÓN: Pos Quirúrgico seleccionado en DOM pasa validación de obligatorios", () => {
  const group = createPillGroup("motivo", MOTIVOS, "Pos Quirúrgico");
  const merged = syncSinglesFromDom(createFormRoot([group]), { motivo: "" });
  assert.equal(merged.motivo, "Pos Quirúrgico");
  const ficha = coerceFicha({
    nombre: "Ana Pérez",
    fechaSesion: "2026-11-24",
    nacimiento: "1990-01-01",
    edad: "36",
    antecedentes: "Dolor post cirugía",
    motivo: merged.motivo,
  });
  assert.ok(!missingFieldKeys(ficha).includes("motivo"));
});

test("syncSinglesFromDom pisa singles stale con el DOM", () => {
  const group = createPillGroup("motivo", MOTIVOS, "No Traumático");
  const merged = syncSinglesFromDom(createFormRoot([group]), { motivo: "Bruxismo" });
  assert.equal(merged.motivo, "No Traumático", "El DOM gana sobre memoria vieja");
});

test("varios grupos data-single se leen juntos", () => {
  const root = createFormRoot([
    createPillGroup("motivo", MOTIVOS, "Bruxismo"),
    createPillGroup("ruidos", ["Sí", "No"], "Sí"),
    createPillGroup("dolorCondilar", ["Sí", "No"], "No"),
  ]);
  const merged = syncSinglesFromDom(root, {});
  assert.equal(merged.motivo, "Bruxismo");
  assert.equal(merged.ruidos, "Sí");
  assert.equal(merged.dolorCondilar, "No");
});

test("sin button.on el valor queda vacío (y motivo sigue obligatorio)", () => {
  const merged = syncSinglesFromDom(createFormRoot([createPillGroup("motivo", MOTIVOS, "")]), {});
  assert.equal(merged.motivo, "");
  const ficha = coerceFicha({
    nombre: "X",
    fechaSesion: "2026-11-24",
    nacimiento: "1990-01-01",
    edad: "36",
    antecedentes: "test",
    motivo: merged.motivo,
  });
  assert.deepEqual(missingFields(ficha), ["el motivo de consulta"]);
});
