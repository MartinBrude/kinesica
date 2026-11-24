/**
 * Pastillas data-single (motivo, ruidos, EVA laterales, etc.).
 * El DOM (button.on) es la fuente de verdad al serializar; `singles` se mantiene
 * sincronizado para follow-ups y validación en vivo.
 */

/**
 * Valor de la pastilla activa en un grupo `[data-single]`.
 * @param {ParentNode | null | undefined} groupEl
 * @returns {string}
 */
export function selectedSingleValue(groupEl) {
  if (!groupEl || typeof groupEl.querySelector !== "function") return "";
  const onBtn = groupEl.querySelector("button.on");
  return String(onBtn?.dataset?.value ?? "").trim();
}

/**
 * Lee todos los grupos `[data-single]` del formulario y los fusiona sobre `singles`.
 * El valor del DOM pisa cualquier estado en memoria (evita desync click vs guardar).
 * @param {ParentNode | null | undefined} root
 * @param {Record<string, unknown>} [singles={}]
 * @returns {Record<string, unknown>}
 */
export function syncSinglesFromDom(root, singles = {}) {
  const out = { ...(singles && typeof singles === "object" ? singles : {}) };
  if (!root || typeof root.querySelectorAll !== "function") return out;
  root.querySelectorAll("[data-single]").forEach((group) => {
    const key = group.dataset?.single;
    if (!key) return;
    out[key] = selectedSingleValue(group);
  });
  return out;
}

/**
 * Aplica selección visual + estado en `singles` para un grupo.
 * @param {Element | null | undefined} groupEl
 * @param {string} value
 * @param {Record<string, unknown> | null} [singles]
 * @returns {string} valor aplicado ("" si se deseleccionó)
 */
export function applySingleSelection(groupEl, value, singles = null) {
  const next = String(value ?? "").trim();
  const key = groupEl?.dataset?.single;
  if (singles && key) singles[key] = next;
  if (groupEl && typeof groupEl.querySelectorAll === "function") {
    groupEl.querySelectorAll("button").forEach((btn) => {
      const isOn = btn.dataset?.value === next;
      if (btn.classList && typeof btn.classList.toggle === "function") {
        btn.classList.toggle("on", isOn);
      }
    });
  }
  return next;
}

/**
 * Toggle al hacer clic en una pastilla (mismo valor = deseleccionar).
 * @param {Element | null | undefined} groupEl
 * @param {string} clickedValue
 * @param {Record<string, unknown>} singles
 * @returns {string}
 */
export function toggleSingleSelection(groupEl, clickedValue, singles) {
  const key = groupEl?.dataset?.single;
  const current = key && singles ? String(singles[key] ?? "") : selectedSingleValue(groupEl);
  const clicked = String(clickedValue ?? "").trim();
  const next = current === clicked ? "" : clicked;
  return applySingleSelection(groupEl, next, singles);
}
