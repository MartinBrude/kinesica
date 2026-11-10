/**
 * Kinésica Admin - Mail de prueba de confirmación (sección políticas en /admin/clara).
 */

import { api } from "./api.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import { toast } from "./dom.js?v=79";

function qs(id) {
  return document.querySelector(id);
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prefillMailPreviewForm() {
  const paciente = qs("#cfg-mail-preview-paciente");
  const fecha = qs("#cfg-mail-preview-fecha");
  const hora = qs("#cfg-mail-preview-hora");
  const servicio = qs("#cfg-mail-preview-servicio");
  const profesional = qs("#cfg-mail-preview-profesional");
  const menor = qs("#cfg-mail-preview-menor");

  const user = getSessionUser();
  if (paciente && !paciente.value.trim()) {
    paciente.value = user?.name || user?.username || "Paciente de prueba";
  }
  if (fecha && !fecha.value) fecha.value = tomorrowIso();
  if (hora && !hora.value) hora.value = "16:00";
  if (servicio && !servicio.value.trim()) servicio.value = "Terapias Manuales";
  if (profesional && !profesional.value) profesional.value = "Lic. Norberto Brude";
  if (menor) menor.checked = false;
}

function setPreviewStatus(el, message, ok) {
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = ok ? "horarios-alert-box is-success" : "horarios-alert-box";
}

export function initMailPreview() {
  const btn = qs("#btn-send-confirmation-preview");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  prefillMailPreviewForm();

  btn.addEventListener("click", async () => {
    const statusEl = qs("#cfg-mail-preview-status");
    const paciente = qs("#cfg-mail-preview-paciente")?.value?.trim() || "";
    const fecha = qs("#cfg-mail-preview-fecha")?.value?.trim() || "";
    const hora = qs("#cfg-mail-preview-hora")?.value?.trim() || "";
    const profesional = qs("#cfg-mail-preview-profesional")?.value?.trim() || "";
    const servicio = qs("#cfg-mail-preview-servicio")?.value?.trim() || "Terapias Manuales";
    const esMenor = Boolean(qs("#cfg-mail-preview-menor")?.checked);

    if (!paciente) {
      setPreviewStatus(statusEl, "Ingresá el nombre del paciente.", false);
      qs("#cfg-mail-preview-paciente")?.focus();
      return;
    }
    if (!fecha) {
      setPreviewStatus(statusEl, "Elegí la fecha del turno.", false);
      qs("#cfg-mail-preview-fecha")?.focus();
      return;
    }
    if (!hora) {
      setPreviewStatus(statusEl, "Elegí el horario.", false);
      qs("#cfg-mail-preview-hora")?.focus();
      return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Enviando…";
    setPreviewStatus(statusEl, "", true);

    try {
      const res = await api("send-confirmation-preview.php", {
        method: "POST",
        body: { paciente, fecha, hora, profesional, servicio, esMenor },
      });
      const masked = res?.emailMasked || "tu correo";
      const msg = `Mail de prueba enviado a ${masked}.`;
      setPreviewStatus(statusEl, `✓ ${msg}`, true);
      toast(msg, { type: "success" });
    } catch (err) {
      const message = err?.message || "No se pudo enviar el mail de prueba.";
      setPreviewStatus(statusEl, message, false);
      toast(message, { type: "danger" });
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

export function refreshMailPreviewPrefill() {
  prefillMailPreviewForm();
}
