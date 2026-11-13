import { api } from "./api.js?v=79";
import { dialogAlert } from "./dom.js?v=79";
import {
  isValidAdminEmail,
  suggestAdminEmailDomain,
  inspectAdminPhone,
} from "./pacientes-format.js";
import { sanitizePersonName, capitalizePersonName, hasDisallowedNameChars } from "../ficha-rules.mjs?v=91";

export function bindPacienteModalForm({
  backdrop,
  form,
  errorEl,
  submitBtn,
  isEdit,
  paciente,
  onReload,
}) {
  const confirmedWeirdPhones = new Set();
  const confirmedSuspiciousEmails = new Set();

  ["#modal-p-nombre", "#modal-p-apellido", "#modal-p-contacto-nombre"].forEach((sel) => {
    const el = backdrop.querySelector(sel);
    if (el) {
      el.addEventListener("input", () => {
        const raw = el.value.replace(/[\r\n,]/g, "");
        const formatted = capitalizePersonName(raw);
        if (el.value !== formatted) {
          el.value = formatted;
        }
        errorEl.hidden = true;
      });
      el.addEventListener("blur", () => {
        el.value = sanitizePersonName(el.value);
      });
    }
  });

  ["#modal-p-tel", "#modal-p-contacto-tel"].forEach((sel) => {
    const el = backdrop.querySelector(sel);
    if (el) el.addEventListener("input", () => {
      const cleaned = el.value.replace(/[^0-9+\-().\s]/g, "");
      const hasPlus = cleaned.trimStart().startsWith("+");
      const noPlus = cleaned.replace(/\+/g, "");
      el.value = (hasPlus ? "+" + noPlus : noPlus).slice(0, 24);
      errorEl.hidden = true;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rawNombre = backdrop.querySelector("#modal-p-nombre").value;
    const rawApellido = backdrop.querySelector("#modal-p-apellido").value;
    const rawContactoNombre = backdrop.querySelector("#modal-p-contacto-nombre")?.value || "";

    if (hasDisallowedNameChars(rawNombre) || hasDisallowedNameChars(rawApellido) || hasDisallowedNameChars(rawContactoNombre)) {
      errorEl.textContent = "El nombre y apellido no permiten comas, emojis ni saltos de línea.";
      errorEl.hidden = false;
      return;
    }

    const nombre = sanitizePersonName(rawNombre);
    const apellido = sanitizePersonName(rawApellido);
    const tel = backdrop.querySelector("#modal-p-tel").value.trim();
    const email = backdrop.querySelector("#modal-p-email").value.trim();
    const dni = backdrop.querySelector("#modal-p-dni").value.trim();
    const prof = backdrop.querySelector("#modal-p-prof").value;
    const motivo = backdrop.querySelector("#modal-p-motivo").value.trim();
    const notas = backdrop.querySelector("#modal-p-notas").value.trim();
    const contactoNombre = sanitizePersonName(rawContactoNombre);
    const contactoTel = backdrop.querySelector("#modal-p-contacto-tel")?.value.trim() || "";
    const contactoEmail = backdrop.querySelector("#modal-p-contacto-email")?.value.trim() || "";
    const contactoNotas = backdrop.querySelector("#modal-p-contacto-notas")?.value.trim() || "";
    const dejoReview = backdrop.querySelector("#modal-p-dejo-review")?.checked ? 1 : 0;

    if (!nombre || !apellido || !tel) {
      errorEl.textContent = "Nombre, apellido y teléfono son obligatorios.";
      errorEl.hidden = false;
      return;
    }
    if (!isValidAdminEmail(email)) {
      errorEl.textContent = "El correo electrónico ingresado no tiene un formato válido.";
      errorEl.hidden = false;
      return;
    }
    if (email) {
      const eLower = email.toLowerCase();
      const suggested = suggestAdminEmailDomain(eLower);
      if (suggested && !confirmedSuspiciousEmails.has(eLower)) {
        confirmedSuspiciousEmails.add(eLower);
        errorEl.textContent = `¿El correo (${email}) es correcto? Quizás quisiste escribir @${suggested}. Si está bien, volvé a tocar Guardar.`;
        errorEl.hidden = false;
        return;
      }
    }
    if (!isValidAdminEmail(contactoEmail)) {
      errorEl.textContent = "El correo electrónico de contacto no tiene un formato válido.";
      errorEl.hidden = false;
      return;
    }
    const telInfo = inspectAdminPhone(tel);
    if (!telInfo.valid) {
      errorEl.textContent = "Por favor ingresá un número de teléfono válido.";
      errorEl.hidden = false;
      return;
    }
    if (!telInfo.standard && !confirmedWeirdPhones.has(telInfo.digits)) {
      confirmedWeirdPhones.add(telInfo.digits);
      errorEl.textContent = "¿El teléfono es correcto? Si es de otro país o ya lo revisaste, volvé a tocar Guardar para confirmar.";
      errorEl.hidden = false;
      return;
    }
    if (contactoTel) {
      const cTelInfo = inspectAdminPhone(contactoTel);
      if (!cTelInfo.valid) {
        errorEl.textContent = "El teléfono de contacto no es válido.";
        errorEl.hidden = false;
        return;
      }
    }

    const nombreCompleto = `${nombre} ${apellido}`.trim();
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    errorEl.hidden = true;

    const payload = {
      nombre,
      apellido,
      nombre_completo: nombreCompleto,
      telefono: tel,
      email,
      dni,
      profesional_habitual: prof,
      motivo_consulta: motivo,
      notas,
      contacto_nombre: contactoNombre,
      contacto_telefono: contactoTel,
      contacto_email: contactoEmail,
      contacto_notas: contactoNotas,
      dejo_review: dejoReview,
    };

    const close = () => backdrop.remove();
    let saveError = null;
    try {
      if (isEdit) {
        await api("pacientes.php", { method: "PUT", body: JSON.stringify({ id: paciente.id, ...payload }) });
      } else {
        await api("pacientes.php", { method: "POST", body: JSON.stringify({ action: "insert", origen: "admin", ...payload }) });
      }
    } catch (err) {
      saveError = err;
    }

    close();
    if (saveError) {
      await dialogAlert(saveError.message || "Error al procesar la solicitud", { type: "danger" });
      return;
    }
    if (typeof onReload === "function") await onReload();
  });
}
