/** Pantalla de acceso (gate) y visibilidad de formularios. */

import { switchActiveView } from "./dom.js?v=79";
import { clearAuthStorage, saveAuthStorage } from "./auth-utils.js";
import { getSessionUserRef } from "./auth-session.js";
import {
  viewGate,
  loginForm,
  enrollForm,
  forgotForm,
  resetForm,
  emailCodeForm,
  logoutBtn,
  enrollAccountEl,
  enrollSecretEl,
  loginCodeSentNote,
  emailCodeStepRequest,
  emailCodeStepVerify,
  emailCodeRequestError,
  emailCodeVerifyError,
} from "./auth-elements.js";

export function showGate(data = {}) {
  clearAuthStorage();
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("is-authenticated");
    document.documentElement.classList.remove("is-admin-role");
  }

  switchActiveView("view-gate");
  if (logoutBtn) logoutBtn.hidden = true;
  document.querySelectorAll(".clara-btn").forEach((el) => el.remove());

  const enroll = Boolean(data && data.enroll);
  const forgot = Boolean(data && data.forgot);
  const reset = Boolean(data && data.reset);
  const emailCode = Boolean(data && data.emailCode);

  if (loginForm) loginForm.hidden = enroll || forgot || reset || emailCode;
  if (enrollForm) enrollForm.hidden = !enroll;
  if (forgotForm) forgotForm.hidden = !forgot;
  if (resetForm) resetForm.hidden = !reset;
  if (emailCodeForm) emailCodeForm.hidden = !emailCode;

  if (emailCode) {
    if (emailCodeStepRequest) emailCodeStepRequest.hidden = false;
    if (emailCodeStepVerify) emailCodeStepVerify.hidden = true;
    if (emailCodeRequestError) emailCodeRequestError.hidden = true;
    if (emailCodeVerifyError) emailCodeVerifyError.hidden = true;
    const userInput = emailCodeForm ? emailCodeForm.elements.username : null;
    if (userInput) {
      if (!userInput.value) userInput.focus();
      else userInput.select();
    }
  }

  if (loginCodeSentNote && !data.keepNote) loginCodeSentNote.hidden = true;

  if (enroll) {
    if (enrollAccountEl) enrollAccountEl.textContent = data.account || "Kinésica";
    const secret = data.secret || "";
    if (enrollSecretEl) enrollSecretEl.textContent = secret.replace(/(.{4})/g, "$1 ").trim();
    const enrollPassInput = enrollForm ? enrollForm.elements.enroll_password : null;
    if (enrollPassInput) {
      enrollPassInput.value = "";
      enrollPassInput.focus();
    } else {
      const enrollInput = enrollForm ? enrollForm.elements.code : null;
      if (enrollInput) enrollInput.focus();
    }
  }

  if (reset) {
    const passInput = resetForm ? resetForm.elements.password : null;
    if (passInput) passInput.focus();
  }

  if (!enroll && !forgot && !reset && loginForm) {
    const userField = loginForm.elements.username;
    if (userField && !userField.value) userField.focus();
  }
}

export function hideGate() {
  document.documentElement.classList.add("is-authenticated");
  saveAuthStorage(getSessionUserRef());
  if (viewGate) viewGate.hidden = true;
  if (logoutBtn) logoutBtn.hidden = false;
}
