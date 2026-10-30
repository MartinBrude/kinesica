/**
 * Kinésica Admin - DOM & Sanitization Utilities
 * Utilidades para construcción eficiente de elementos del DOM, prevención de XSS y debounce.
 */

import { dialogAlert, dialogConfirm } from "./dom-dialogs.js";

export { dialogAlert, dialogConfirm };

/**
 * Escapa caracteres especiales HTML para prevenir vulnerabilidades de XSS (Cross-Site Scripting).
 * @param {string|number|null|undefined} str Texto a sanear
 * @returns {string} Texto seguro para incrustar en HTML
 */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Crea un elemento DOM con clase y texto opcionales de forma segura.
 * @param {string} tag Nombre de la etiqueta HTML
 * @param {string} [className=""] Clases CSS separadas por espacio
 * @param {string} [text=""] Contenido textual
 * @returns {HTMLElement} Elemento DOM creado
 */
export function node(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== "" && text !== null && text !== undefined) el.textContent = String(text);
  return el;
}

/**
 * Crea un campo para el reporte impreso con etiqueta y valor.
 * @param {string} label Etiqueta del campo
 * @param {string} value Valor textual
 * @returns {HTMLElement} Contenedor .pf-field
 */
export function field(label, value) {
  const box = node("div", "pf-field");
  box.append(node("span", "pf-k", label), node("span", "pf-v", value || "—"));
  return box;
}

/**
 * Devuelve la descripción de la afectación bilateral o lateralidad.
 * Si ninguno está seleccionado o el valor es falsy, devuelve "" (vacío) para que no se incluya en el reporte.
 * @param {boolean|string|null|undefined} left Valor del lado izquierdo
 * @param {boolean|string|null|undefined} right Valor del lado derecho
 * @returns {string} "Bilateral", "Izquierda", "Derecha" o "" si no tiene valor
 */
export function side(left, right) {
  const isLeft = Boolean(left && left !== "No" && left !== "0" && left !== "false");
  const isRight = Boolean(right && right !== "No" && right !== "0" && right !== "false");
  if (isLeft && isRight) return "Bilateral";
  if (isLeft) return "Izquierda";
  if (isRight) return "Derecha";
  return "";
}

/**
 * Crea una sección para el reporte impreso con título y barra decorativa.
 * @param {string} title Título de la sección clínica
 * @returns {HTMLElement} Contenedor .pf-section
 */
export function section(title) {
  const sec = node("section", "pf-section");
  sec.append(node("h2", "", title));
  return sec;
}

/**
 * Construye una cuadrícula .pf-grid a partir de pares [etiqueta, valor].
 * Omite campos vacíos si son opcionales y retorna null si no hay ningún campo con valor.
 * @param {Array<[string, string]>} fields Array de tuplas [etiqueta, valor]
 * @returns {HTMLElement|null} Contenedor .pf-grid o null si está vacío
 */
export function grid(fields) {
  const g = node("div", "pf-grid");
  for (const [k, v] of fields) {
    if (v !== undefined && v !== null && v !== "") {
      g.append(field(k, v));
    }
  }
  return g.childElementCount > 0 ? g : null;
}

/**
 * Crea un bloque de texto libre para observaciones clínicas o antecedentes.
 * @param {string} label Título del bloque
 * @param {string} value Texto multilínea
 * @returns {HTMLElement|null} Bloque .pf-prose o null si está vacío
 */
export function prose(label, value) {
  if (!value) return null;
  const box = node("div", "pf-prose");
  box.append(node("span", "pf-k", label), node("p", "", value));
  return box;
}

/**
 * Concatena partes de texto filtrando valores falsy.
 * @param {Array<string|boolean|null|undefined>} parts
 * @param {string} [sep=" · "] Separador
 * @returns {string} Cadena formateada
 */
export function formatParts(parts, sep = " · ") {
  return parts.filter(Boolean).join(sep);
}

/**
 * Agrega un elemento hijo a un elemento padre si el hijo es válido.
 * @param {HTMLElement} parent Elemento contenedor
 * @param {HTMLElement|null|undefined} child Elemento a agregar
 */
export function add(parent, child) {
  if (child) parent.append(child);
}

/**
 * Aplica debounce a una función para limitar la frecuencia de ejecución (ej: filtros de búsqueda).
 * @param {(...args: any[]) => void} fn Función a ejecutar
 * @param {number} delay Tiempo de espera en milisegundos
 * @returns {(...args: any[]) => void}
 */
export function debounce(fn, delay = 150) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Catálogo canónico de todas las vistas principales de la SPA /admin.
 */
export const ALL_ADMIN_VIEWS = [
  "view-gate",
  "view-dashboard",
  "view-library",
  "view-pacientes",
  "view-consultorio",
  "view-clara",
  "view-admin",
  "view-interacciones",
  "view-recordatorios",
  "view-form",
  "view-compare",
];

/**
 * Conmuta la vista activa de la aplicación, garantizando que el elemento objetivo
 * quede visible (hidden = false) y todas las demás vistas queden ocultas (hidden = true).
 * Previene la fuga de vistas (view leaks) y superposiciones inconsistentes en el DOM.
 * @param {string} targetId ID de la sección (ej: "view-interacciones" o "#view-interacciones")
 * @returns {HTMLElement|null} Elemento de la vista activada
 */
export function switchActiveView(targetId) {
  const cleanId = String(targetId || "").replace(/^#/, "");
  let activeEl = null;
  for (const id of ALL_ADMIN_VIEWS) {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (el) {
      const match = id === cleanId;
      el.hidden = !match;
      if (match) activeEl = el;
    }
  }
  return activeEl;
}
