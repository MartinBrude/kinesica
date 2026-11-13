/**
 * Errores de campo — modales recordatorio.
 */

export function markTestFieldError(input, message) {
  if (!input) return;
  input.setAttribute("aria-invalid", "true");
  input.style.borderColor = "#b42318";
  input.style.boxShadow = "0 0 0 2px rgba(180, 35, 24, 0.15)";
  input.focus();
  const field = input.closest(".recordatorio-modal-field");
  let err = field?.querySelector(".recordatorio-modal-field-error");
  if (field && !err) {
    err = document.createElement("p");
    err.className = "recordatorio-modal-field-error";
    err.style.cssText = "margin:0;font-size:12px;color:#b42318;";
    field.appendChild(err);
  }
  if (err) err.textContent = message;
}

export function clearTestFieldError(input) {
  if (!input) return;
  input.removeAttribute("aria-invalid");
  input.style.borderColor = "";
  input.style.boxShadow = "";
  input.closest(".recordatorio-modal-field")?.querySelector(".recordatorio-modal-field-error")?.remove();
}
