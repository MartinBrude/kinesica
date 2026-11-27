/**
 * Sugerencia de teléfono desde directorio de pacientes — modal contacto Recordatorios.
 */

import { api } from "./api.js?v=79";
import { escapeHtml } from "./dom.js?v=79";

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePersonName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dniLooksSame(a, b) {
  const x = digitsOnly(a);
  const y = digitsOnly(b);
  if (x.length < 6 || y.length < 6) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}

function applySuggestedContact(match, phoneInput, emailInput) {
  if (!match || !phoneInput || phoneInput.value.trim()) return;
  const rawMatchPhone = String(match.telefono || "").trim();
  if (!rawMatchPhone) return;
  phoneInput.value = rawMatchPhone;
  if (match.email && emailInput && !emailInput.value.trim()) {
    emailInput.value = String(match.email).trim();
  }
}

function renderPhoneSuggestHint(phoneInput, opts) {
  const parent = phoneInput?.parentElement;
  if (!parent) return;
  parent.querySelectorAll(".recordatorio-phone-suggest").forEach((el) => el.remove());

  const hintBox = document.createElement("div");
  if (opts.kind === "ok") {
    const match = opts.match;
    const rawMatchPhone = String(match.telefono || "").trim();
    hintBox.className = "recordatorio-phone-suggest";
    hintBox.innerHTML = `Teléfono sugerido: <strong>${escapeHtml(
      match.nombre_completo || "Paciente"
    )}</strong> (${escapeHtml(rawMatchPhone)})${
      opts.note ? ` · ${escapeHtml(opts.note)}` : ""
    }`;
    parent.appendChild(hintBox);
    return;
  }

  const candidates = Array.isArray(opts.candidates) ? opts.candidates : [];
  hintBox.className = "recordatorio-phone-suggest recordatorio-phone-suggest--warn";
  const note =
    opts.note ||
    `Hay ${candidates.length} coincidencias en el directorio. Elegí la correcta antes de enviar.`;
  const rows = candidates
    .map((c, idx) => {
      const name = escapeHtml(c.nombre_completo || c.nombre || "Paciente");
      const phone = escapeHtml(String(c.telefono || "").trim());
      const dni = digitsOnly(c.dni);
      const dniLabel = dni ? ` · DNI ${escapeHtml(dni)}` : "";
      return `<button type="button" class="recordatorio-phone-pick" data-pick-idx="${idx}">Usar: ${name} (${phone})${dniLabel}</button>`;
    })
    .join("");
  hintBox.innerHTML = `<div>${escapeHtml(note)}</div>${rows}`;
  parent.appendChild(hintBox);

  hintBox.querySelectorAll(".recordatorio-phone-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-pick-idx"));
      const chosen = candidates[idx];
      if (!chosen) return;
      phoneInput.value = "";
      applySuggestedContact(chosen, phoneInput, opts.emailInput);
      renderPhoneSuggestHint(phoneInput, {
        kind: "ok",
        match: chosen,
        note: "elegido manualmente",
      });
    });
  });
}

/**
 * Autocomplete de teléfono desde directorio:
 * - 1 coincidencia clara → rellena
 * - si hay DNI en el turno, desambigua con documento
 * - si hay colisión → no rellena; pide revisión con opciones
 */
export function suggestPhoneFromDirectory({ lookupName, eventDni, phoneInput, emailInput }) {
  const q = normalizePersonName(lookupName);
  const eventDniDigits = digitsOnly(eventDni);
  api(`pacientes.php?q=${encodeURIComponent(lookupName)}`)
    .then((res) => {
      if (!phoneInput || phoneInput.value.trim()) return;
      const items = Array.isArray(res?.items) ? res.items : [];
      const withPhone = items.filter((p) => digitsOnly(p.telefono).length >= 6);
      const nameMatches = withPhone.filter((p) => {
        const full = normalizePersonName(p.nombre_completo || p.nombre || "");
        return full !== "" && (full === q || full.includes(q) || q.includes(full));
      });
      if (nameMatches.length === 0) return;

      let pool = nameMatches.filter(
        (p) => normalizePersonName(p.nombre_completo || p.nombre || "") === q
      );
      if (pool.length === 0) pool = nameMatches;

      if (eventDniDigits.length >= 6) {
        const byDni = pool.filter((p) => dniLooksSame(p.dni, eventDniDigits));
        if (byDni.length === 1) {
          applySuggestedContact(byDni[0], phoneInput, emailInput);
          renderPhoneSuggestHint(phoneInput, {
            kind: "ok",
            match: byDni[0],
            note: "coincidió nombre + documento",
          });
          return;
        }
        if (byDni.length > 1) {
          renderPhoneSuggestHint(phoneInput, {
            kind: "collision",
            candidates: byDni,
            emailInput,
          });
          return;
        }
        if (pool.length >= 1) {
          renderPhoneSuggestHint(phoneInput, {
            kind: "collision",
            candidates: pool.slice(0, 5),
            emailInput,
            note: "El documento del turno no coincidió con el directorio. Revisá antes de enviar.",
          });
          return;
        }
      }

      if (pool.length === 1) {
        applySuggestedContact(pool[0], phoneInput, emailInput);
        renderPhoneSuggestHint(phoneInput, { kind: "ok", match: pool[0] });
        return;
      }

      renderPhoneSuggestHint(phoneInput, {
        kind: "collision",
        candidates: pool.slice(0, 5),
        emailInput,
      });
    })
    .catch(() => {});
}
