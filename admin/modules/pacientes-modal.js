/**
 * Kinésica Admin - Modal de Alta y Edición de Pacientes (facade).
 */

import { getSessionUser } from "./auth.js?v=83";
import { capitalizePersonName } from "./pacientes-format.js";
import { buildPacienteModalMarkup } from "./pacientes-modal-html.js";
import { bindPacienteModalForm } from "./pacientes-modal-submit.js";

export function openFullPacienteModal(paciente = null, onReload = null) {
  const isEdit = Boolean(paciente && paciente.id);
  const isColaborador = getSessionUser()?.role === "colaborador";
  const backdrop = document.createElement("div");
  backdrop.className = "paciente-modal-backdrop";

  let nombreVal = paciente?.nombre || "";
  let apellidoVal = paciente?.apellido || "";
  if (!nombreVal && !apellidoVal && paciente?.nombre_completo) {
    const parts = paciente.nombre_completo.trim().split(/\s+/);
    nombreVal = parts[0] || "";
    apellidoVal = parts.slice(1).join(" ") || "";
  }
  nombreVal = capitalizePersonName(nombreVal);
  apellidoVal = capitalizePersonName(apellidoVal);
  const contactoNombreVal = capitalizePersonName(paciente?.contacto_nombre || "");

  let telVal = paciente?.telefono || "";
  if (telVal.startsWith("sin-tel-") || telVal.startsWith("sin-telefono-") || telVal.startsWith("ficha-")) {
    telVal = "";
  }

  backdrop.innerHTML = buildPacienteModalMarkup({
    isEdit,
    isColaborador,
    nombreVal,
    apellidoVal,
    telVal,
    paciente,
    contactoNombreVal,
  });

  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelectorAll(".btn-close-modal").forEach((b) => b.addEventListener("click", close));

  if (isColaborador) {
    backdrop.querySelectorAll("input, textarea, select").forEach((el) => {
      el.disabled = true;
    });
  } else if (nombreVal) {
    const telInput = backdrop.querySelector("#modal-p-tel");
    if (telInput) setTimeout(() => telInput.focus(), 60);
  }

  const form = backdrop.querySelector("#form-full-paciente");
  const errorEl = backdrop.querySelector("#modal-p-error");
  const submitBtn = backdrop.querySelector("#btn-submit-paciente");

  if (!isColaborador && form && submitBtn) {
    bindPacienteModalForm({
      backdrop,
      form,
      errorEl,
      submitBtn,
      isEdit,
      paciente,
      onReload,
    });
  }
}
