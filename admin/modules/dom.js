/**
 * Kinésica Admin - DOM & Sanitization Utilities
 * Utilidades para construcción eficiente de elementos del DOM, prevención de XSS y debounce.
 */

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
 * @template T
 * @param {(...args: any[]) => void} fn Función a ejecutar
 * @param {number} delay Tiempo de espera en milisegundos
 * @returns {(...args: any[]) => void}
 */
let dialogQueue = Promise.resolve();

function enqueueDialog(task) {
  const run = dialogQueue.then(task, task);
  dialogQueue = run.then(() => {}, () => {});
  return run;
}

/**
 * Aviso modal del admin. Reemplaza window.alert.
 * @param {string} message
 * @returns {Promise<void>}
 */
export function dialogAlert(message) {
  return enqueueDialog(() => openDialog({ message, confirm: false }));
}

/**
 * Confirmación modal del admin. Reemplaza window.confirm.
 * @param {string} message
 * @param {{danger?: boolean}} [options]
 * @returns {Promise<boolean>}
 */
export function dialogConfirm(message, options = {}) {
  return enqueueDialog(() =>
    openDialog({
      message,
      confirm: true,
      danger: Boolean(options.danger),
      okText: options.okText,
      cancelText: options.cancelText,
    })
  );
}

function openDialog({ message, confirm, danger, okText, cancelText }) {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "app-dialog";
    root.setAttribute("role", "presentation");

    const card = document.createElement("div");
    card.className = "app-dialog-card";
    card.setAttribute("role", confirm ? "dialog" : "alertdialog");
    card.setAttribute("aria-modal", "true");

    const text = document.createElement("p");
    text.className = "app-dialog-text";
    text.textContent = String(message ?? "");

    const actions = document.createElement("div");
    actions.className = "app-dialog-actions";

    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = danger ? "btn danger" : "btn green";
    ok.textContent = okText || (confirm ? (danger ? "Quitar" : "Confirmar") : "Entendido");

    let cancel = null;
    if (confirm) {
      cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn light";
      cancel.textContent = cancelText || "Cancelar";
      actions.append(cancel);
    }
    actions.append(ok);
    card.append(text, actions);
    root.append(card);
    document.body.append(root);

    const finish = (value) => {
      document.removeEventListener("keydown", onKey);
      root.remove();
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(confirm ? false : undefined);
      } else if (event.key === "Enter") {
        event.preventDefault();
        finish(confirm ? true : undefined);
      }
    };
    cancel?.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(confirm ? true : undefined));
    root.addEventListener("click", (event) => {
      if (event.target === root) finish(confirm ? false : undefined);
    });
    document.addEventListener("keydown", onKey);
    ok.focus();
  });
}

export function debounce(fn, delay = 150) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
