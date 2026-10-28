/**
 * Kinésica Admin - Flujo de Recuperación y Reseteo de Contraseña
 * Gestiona el envío de mails con token de reset y la actualización de claves.
 */

import { api } from "./api.js?v=77";
import { setGateMessage } from "./auth-utils.js";

export function setupRecoveryFlow({
  forgotForm,
  resetForm,
  forgotErrorEl,
  resetErrorEl,
  loginErrorEl,
  showGate,
}) {
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (forgotErrorEl) forgotErrorEl.hidden = true;
      try {
        const data = await api("forgot.php", {
          method: "POST",
          body: JSON.stringify({ username: event.target.username.value }),
        });
        setGateMessage(
          forgotErrorEl,
          data.message || "Si el usuario tiene correo, te llega un enlace en unos minutos.",
          true
        );
      } catch (err) {
        setGateMessage(forgotErrorEl, err.message, false);
      }
    });
  }

  if (resetForm) {
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (resetErrorEl) resetErrorEl.hidden = true;
      const password = event.target.password.value;
      if (password !== event.target.confirm.value) {
        setGateMessage(resetErrorEl, "Las contraseñas no coinciden.", false);
        return;
      }
      try {
        await api("reset.php", {
          method: "POST",
          body: JSON.stringify({ token: event.target.dataset.token, password }),
        });
        history.replaceState(null, "", location.pathname);
        showGate({ login: true });
        setGateMessage(loginErrorEl, "Contraseña actualizada. Entrá con la nueva.", true);
      } catch (err) {
        setGateMessage(resetErrorEl, err.message, false);
      }
    });
  }
}

export function setupEnrollFlow({
  enrollForm,
  enrollErrorEl,
  setSessionUser,
  getSessionUser,
  hideGate,
  onSuccess,
}) {
  if (!enrollForm) return;
  enrollForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (enrollErrorEl) enrollErrorEl.hidden = true;
    const password = event.target.enroll_password?.value || "";
    const code = event.target.code?.value || "";
    if (!password) {
      setGateMessage(enrollErrorEl, "Ingresá tu contraseña.", false);
      event.target.enroll_password?.focus();
      return;
    }
    try {
      const data = await api("totp.php", { method: "POST", body: JSON.stringify({ password, code }) });
      if (data && data.name) {
        setSessionUser({ username: getSessionUser()?.username || "", name: data.name, role: data.role });
      }
      hideGate();
      if (typeof onSuccess === "function") await onSuccess();
    } catch (err) {
      if (err.auth) return;
      if (enrollErrorEl) {
        enrollErrorEl.textContent = err.message;
        enrollErrorEl.hidden = false;
      }
    }
  });
}
