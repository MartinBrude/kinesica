/**
 * Kinésica Admin - Controles EVA, Edad, Hábitos y Derivaciones Condicionales
 */

import { ageOn } from "../ficha-rules.mjs?v=89";

const form = document.querySelector("#ficha");
const evaInput = form ? form.elements.eva : null;
const evaValue = document.querySelector("#eva-value");

export const singles = {};

export function getSingles() {
  return singles;
}

export function setSingle(key, val) {
  singles[key] = val;
}

export function resetSingles() {
  Object.keys(singles).forEach((k) => delete singles[k]);
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function evaMeta(val) {
  const n = Number(val) || 0;
  if (n === 0) return { label: "0 / 10 · Sin dolor", level: "zero" };
  if (n <= 3) return { label: `${n} / 10 · Dolor leve`, level: "mild" };
  if (n <= 6) return { label: `${n} / 10 · Dolor moderado`, level: "moderate" };
  return { label: `${n} / 10 · Dolor severo`, level: "severe" };
}

export function syncEva() {
  if (!evaInput || !evaValue) return;
  const meta = evaMeta(evaInput.value);
  evaValue.textContent = meta.label;
  evaValue.dataset.level = meta.level;
}

export function syncAge() {
  if (!form) return;
  const birth = form.elements.nacimiento?.value;
  const session = form.elements.fechaSesion?.value || todayISO();
  if (birth) {
    const calculated = ageOn(birth, session);
    if (calculated && form.elements.edad) {
      const num = parseInt(calculated, 10);
      if (Number.isInteger(num) && num >= 1 && num <= 120) {
        form.elements.edad.value = String(num);
        form.elements.edad.classList.remove("input-error");
        form.elements.edad.title = "";
      }
    }
  }
}

export function syncFollowups() {
  document.querySelectorAll("[data-follow]").forEach((box) => {
    const show = singles[box.dataset.follow] === "Sí";
    box.hidden = !show;
    if (!show) {
      box.querySelectorAll("input").forEach((input) => {
        input.checked = false;
        input.classList.remove("input-error");
      });
      box.querySelectorAll(".follow-group").forEach((fg) => {
        fg.classList.remove("input-error");
      });
    }
  });
}

export function setupSingleButtons(onChange) {
  document.querySelectorAll("[data-single]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      const key = group.dataset.single;
      const next = singles[key] === btn.dataset.value ? "" : btn.dataset.value;
      singles[key] = next;
      group.querySelectorAll("button").forEach((el) => {
        el.classList.toggle("on", el.dataset.value === next);
      });
      syncFollowups();
      if (typeof onChange === "function") onChange();
    });
  });
}
