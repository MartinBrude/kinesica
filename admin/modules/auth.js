/**
 * Kinésica Admin - Gestión de Autenticación y Pantalla de Acceso (Gate)
 * Administra el flujo de login, segundo factor (TOTP 2FA), recuperación de contraseña,
 * reseteo seguro y cierre de sesión.
 */

import { api } from "./api.js?v=77";
import { switchActiveView } from "./dom.js?v=78";
import {
  setGateMessage,
  bindPasswordToggle,
  setupNumericCodeInputs,
  clearAuthStorage,
  saveAuthStorage,
} from "./auth-utils.js";
import { setupEmailCodeFlow } from "./auth-email-code.js";
import { setupRecoveryFlow, setupEnrollFlow } from "./auth-recovery.js";

export { setGateMessage };

let sessionUser = null;
let authed = false;

const viewGate = document.querySelector("#view-gate");
const loginForm = document.querySelector("#login-form");
const enrollForm = document.querySelector("#enroll-form");
const forgotForm = document.querySelector("#forgot-form");
const resetForm = document.querySelector("#reset-form");
const emailCodeForm = document.querySelector("#email-code-form");
const logoutBtn = document.querySelector("#btn-logout");

const enrollAccountEl = document.querySelector("#enroll-account");
const enrollSecretEl = document.querySelector("#enroll-secret");

const loginErrorEl = document.querySelector("#login-error");
const loginCodeSentNote = document.querySelector("#login-code-sent-note");
const btnLoginSendEmailCode = document.querySelector("#btn-login-send-email-code");
const enrollErrorEl = document.querySelector("#enroll-error");
const forgotErrorEl = document.querySelector("#forgot-error");
const resetErrorEl = document.querySelector("#reset-error");
const emailCodeRequestError = document.querySelector("#email-code-request-error");
const emailCodeVerifyError = document.querySelector("#email-code-verify-error");
const emailCodeSentNote = document.querySelector("#email-code-sent-note");

const btnForgot = document.querySelector("#btn-forgot");
const btnForgotBack = document.querySelector("#btn-forgot-back");
const btnEmailCode = document.querySelector("#btn-email-code");
const btnEmailCodeBack = document.querySelector("#btn-email-code-back");
const btnSendEmailCode = document.querySelector("#btn-send-email-code");
const btnVerifyEmailCode = document.querySelector("#btn-verify-email-code");
const btnResendEmailCode = document.querySelector("#btn-resend-email-code");
const emailCodeStepRequest = document.querySelector("#email-code-step-request");
const emailCodeStepVerify = document.querySelector("#email-code-step-verify");

export function getSessionUser() {
  return sessionUser;
}

export function setSessionUser(user) {
  sessionUser = user;
  authed = Boolean(user);
  const userLabel = document.querySelector("#session-user-name");
  if (user) {
    saveAuthStorage(user);
    if (userLabel) {
      userLabel.textContent = user.name || user.username || "";
      userLabel.hidden = false;
    }
    document.documentElement.classList.add("is-authenticated");
  } else {
    clearAuthStorage();
    if (userLabel) {
      userLabel.textContent = "";
      userLabel.hidden = true;
    }
    document.documentElement.classList.remove("is-authenticated");
  }
}

export function showGate(data = {}) {
  authed = false;
  clearAuthStorage();
  document.documentElement.classList.remove("is-authenticated");

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
  saveAuthStorage(sessionUser);
  if (viewGate) viewGate.hidden = true;
  if (logoutBtn) logoutBtn.hidden = false;
}

export function initAuth({ onSuccess, onLogout }) {
  bindPasswordToggle("#btn-toggle-password", () => loginForm?.elements?.password);
  bindPasswordToggle("#btn-toggle-email-code-password", () => emailCodeForm?.elements?.email_code_password);
  bindPasswordToggle("#btn-toggle-enroll-password", () => enrollForm?.elements?.enroll_password);
  setupNumericCodeInputs();

  if (btnForgot) btnForgot.addEventListener("click", () => showGate({ forgot: true }));
  if (btnForgotBack) btnForgotBack.addEventListener("click", () => showGate({ login: true }));

  if (btnEmailCode) {
    btnEmailCode.addEventListener("click", () => {
      if (loginForm && emailCodeForm) {
        const currentVal = loginForm.elements.username?.value?.trim() || "";
        if (currentVal && !emailCodeForm.elements.username?.value) {
          emailCodeForm.elements.username.value = currentVal;
        }
      }
      showGate({ emailCode: true });
    });
  }

  if (btnEmailCodeBack) btnEmailCodeBack.addEventListener("click", () => showGate({ login: true }));

  setupEmailCodeFlow({
    loginForm,
    emailCodeForm,
    emailCodeStepRequest,
    emailCodeStepVerify,
    emailCodeRequestError,
    emailCodeVerifyError,
    emailCodeSentNote,
    loginCodeSentNote,
    loginErrorEl,
    btnLoginSendEmailCode,
    btnSendEmailCode,
    btnVerifyEmailCode,
    btnResendEmailCode,
    onSuccess,
    onUserAuthed: setSessionUser,
    hideGate,
  });

  setupRecoveryFlow({
    forgotForm,
    resetForm,
    forgotErrorEl,
    resetErrorEl,
    loginErrorEl,
    showGate,
  });

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (loginErrorEl) loginErrorEl.hidden = true;
      const body = {
        username: event.target.username.value,
        password: event.target.password.value,
        code: event.target.code.value,
      };
      try {
        const data = await api("login.php", { method: "POST", body: JSON.stringify(body) });
        if (data.enroll) {
          showGate(data);
        } else {
          setSessionUser({ username: body.username, name: data.name, role: data.role });
          hideGate();
          if (typeof onSuccess === "function") await onSuccess();
        }
      } catch (err) {
        if (err.auth) return;
        if (loginErrorEl) {
          loginErrorEl.textContent = err.message;
          loginErrorEl.hidden = false;
        }
      }
    });
  }

  setupEnrollFlow({
    enrollForm,
    enrollErrorEl,
    setSessionUser,
    getSessionUser,
    hideGate,
    onSuccess,
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await api("logout.php", { method: "POST" }).catch(() => {});
      clearAuthStorage();
      document.documentElement.classList.remove("is-authenticated");
      setSessionUser(null);
      if (typeof onLogout === "function") onLogout();
      showGate({ login: true });
    });
  }
}
