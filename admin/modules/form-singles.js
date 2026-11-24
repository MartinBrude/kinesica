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
 * Escribe en `singles` los valores actuales del DOM (mutación in-place).
 * @param {ParentNode | null | undefined} root
 * @param {Record<string, unknown> | null | undefined} singles
 * @returns {Record<string, unknown>}
 */
export function writeSinglesFromDom(root, singles) {
  const target = singles && typeof singles === "object" ? singles : {};
  if (!root || typeof root.querySelectorAll !== "function") return target;
  root.querySelectorAll("[data-single]").forEach((group) => {
    const key = group.dataset?.single;
    if (!key) return;
    target[key] = selectedSingleValue(group);
  });
  return target;
}

/**
 * Lee todos los grupos `[data-single]` del formulario y los fusiona sobre `singles`.
 * El valor del DOM pisa cualquier estado en memoria (evita desync click vs guardar).
 * No muta el objeto `singles` original (devuelve copia).
 * @param {ParentNode | null | undefined} root
 * @param {Record<string, unknown>} [singles={}]
 * @returns {Record<string, unknown>}
 */
export function syncSinglesFromDom(root, singles = {}) {
  const out = { ...(singles && typeof singles === "object" ? singles : {}) };
  return writeSinglesFromDom(root, out);
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
 * El DOM gana sobre memoria stale al decidir el valor actual.
 * @param {Element | null | undefined} groupEl
 * @param {string} clickedValue
 * @param {Record<string, unknown>} singles
 * @returns {string}
 */
export function toggleSingleSelection(groupEl, clickedValue, singles) {
  const key = groupEl?.dataset?.single;
  const fromDom = selectedSingleValue(groupEl);
  const fromMem = key && singles ? String(singles[key] ?? "") : "";
  const current = fromDom || fromMem;
  const clicked = String(clickedValue ?? "").trim();
  const next = current === clicked ? "" : clicked;
  return applySingleSelection(groupEl, next, singles);
}
