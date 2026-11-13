/**
 * Kinésica Admin - Gestión de Autenticación y Pantalla de Acceso (Gate)
 */

import { api } from "./api.js?v=79";
import {
  setGateMessage,
  bindPasswordToggle,
  setupNumericCodeInputs,
  clearAuthStorage,
} from "./auth-utils.js";
import { setupEmailCodeFlow } from "./auth-email-code.js";
import { setupRecoveryFlow, setupEnrollFlow } from "./auth-recovery.js";
import { getSessionUser, setSessionUser } from "./auth-session.js";
import { showGate, hideGate } from "./auth-gate.js";
import {
  loginForm,
  enrollForm,
  forgotForm,
  resetForm,
  emailCodeForm,
  logoutBtn,
  loginErrorEl,
  loginCodeSentNote,
  btnLoginSendEmailCode,
  enrollErrorEl,
  forgotErrorEl,
  resetErrorEl,
  emailCodeRequestError,
  emailCodeVerifyError,
  emailCodeSentNote,
  btnForgot,
  btnForgotBack,
  btnEmailCode,
  btnEmailCodeBack,
  btnSendEmailCode,
  btnVerifyEmailCode,
  btnResendEmailCode,
  emailCodeStepRequest,
  emailCodeStepVerify,
} from "./auth-elements.js";

export { setGateMessage };
export { getSessionUser, setSessionUser };
export { showGate, hideGate };

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
