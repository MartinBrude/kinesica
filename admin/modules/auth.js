/**
 * Kinésica Admin - Gestión de Autenticación y Pantalla de Acceso (Gate)
 * Administra el flujo de login, segundo factor (TOTP 2FA), recuperación de contraseña,
 * reseteo seguro y cierre de sesión.
 */

import { api } from "./api.js?v=77";

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

/**
 * Obtiene el usuario autenticado en la sesión actual.
 * @returns {{username: string, name: string}|null}
 */
export function getSessionUser() {
  return sessionUser;
}

/**
 * Establece el usuario autenticado actual.
 * @param {{username: string, name: string}|null} user
 */
export function setSessionUser(user) {
  sessionUser = user;
  authed = Boolean(user);
  const userLabel = document.querySelector("#session-user-name");
  if (user) {
    const displayName = user.name || user.username || "";
    try {
      localStorage.setItem("kinesica_logged_in", "1");
      if (displayName) {
        localStorage.setItem("kinesica_user_name", displayName);
      }
    } catch (_) {}
    if (userLabel) {
      userLabel.textContent = displayName;
      userLabel.hidden = false;
    }
    document.documentElement.classList.add("is-authenticated");
  } else {
    try {
      localStorage.removeItem("kinesica_logged_in");
      localStorage.removeItem("kinesica_user_name");
    } catch (_) {}
    if (userLabel) {
      userLabel.textContent = "";
      userLabel.hidden = true;
    }
    document.documentElement.classList.remove("is-authenticated");
  }
}

/**
 * Muestra un mensaje de estado en los formularios de acceso.
 * @param {HTMLElement} el Elemento de mensaje
 * @param {string} text Texto descriptivo
 * @param {boolean} [info=false] Si es true se muestra como nota informativa, si es false como error
 */
export function setGateMessage(el, text, info = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("gate-note", Boolean(info));
  el.classList.toggle("gate-error", !info);
  el.hidden = false;
}

/**
 * Activa la pantalla de acceso (Gate) y oculta las vistas operativas de la aplicación.
 * @param {object} [data={}] Información de estado (enroll, forgot, reset, account, secret)
 */
export function showGate(data = {}) {
  authed = false;
  try {
    localStorage.removeItem("kinesica_logged_in");
    localStorage.removeItem("kinesica_user_name");
  } catch (_) {}
  document.documentElement.classList.remove("is-authenticated");

  const libraryView = document.querySelector("#view-library");
  const formView = document.querySelector("#view-form");
  const compareView = document.querySelector("#view-compare");
  const dashView = document.querySelector("#view-dashboard");
  const pacView = document.querySelector("#view-pacientes");
  const horView = document.querySelector("#view-horarios");

  if (libraryView) libraryView.hidden = true;
  if (formView) formView.hidden = true;
  if (compareView) compareView.hidden = true;
  if (dashView) dashView.hidden = true;
  if (pacView) pacView.hidden = true;
  if (horView) horView.hidden = true;

  if (viewGate) viewGate.hidden = false;
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
      if (!userInput.value) {
        userInput.focus();
      } else {
        userInput.select();
      }
    }
  }

  if (loginCodeSentNote && !data.keepNote) loginCodeSentNote.hidden = true;

  if (enroll) {
    if (enrollAccountEl) enrollAccountEl.textContent = data.account || "Kinésica";
    const secret = data.secret || "";
    if (enrollSecretEl) {
      enrollSecretEl.textContent = secret.replace(/(.{4})/g, "$1 ").trim();
    }
    const enrollInput = enrollForm ? enrollForm.elements.code : null;
    if (enrollInput) enrollInput.focus();
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

/**
 * Oculta la pantalla de acceso una vez autenticado exitosamente.
 */
export function hideGate() {
  document.documentElement.classList.add("is-authenticated");
  try {
    localStorage.setItem("kinesica_logged_in", "1");
    if (sessionUser && (sessionUser.name || sessionUser.username)) {
      localStorage.setItem("kinesica_user_name", sessionUser.name || sessionUser.username);
    }
  } catch (_) {}
  if (viewGate) viewGate.hidden = true;
  if (logoutBtn) logoutBtn.hidden = false;
}

/**
 * Inicializa los controladores de eventos para los formularios de autenticación.
 * @param {object} callbacks Callbacks para interactuar con el flujo de la aplicación
 * @param {() => Promise<void>} callbacks.onSuccess Callback invocado tras inicio de sesión exitoso
 * @param {() => void} callbacks.onLogout Callback invocado tras desconectar la sesión
 */
export function initAuth({ onSuccess, onLogout }) {
  const btnTogglePassword = document.querySelector("#btn-toggle-password");
  if (btnTogglePassword && loginForm) {
    btnTogglePassword.addEventListener("click", () => {
      const passwordInput = loginForm.elements.password;
      if (!passwordInput) return;
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      btnTogglePassword.setAttribute("aria-label", isPassword ? "Ocultar contraseña" : "Mostrar contraseña");
      btnTogglePassword.title = isPassword ? "Ocultar contraseña" : "Mostrar contraseña";
      const iconShow = btnTogglePassword.querySelector(".eye-show");
      const iconHide = btnTogglePassword.querySelector(".eye-hide");
      if (iconShow) iconShow.hidden = isPassword;
      if (iconHide) iconHide.hidden = !isPassword;
      passwordInput.focus();
    });
  }

  document.querySelectorAll('input[name="code"]').forEach((codeEl) => {
    codeEl.addEventListener("keydown", (e) => {
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Enter" ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });
    codeEl.addEventListener("input", () => {
      const clean = codeEl.value.replace(/\D/g, "").slice(0, 6);
      if (codeEl.value !== clean) {
        codeEl.value = clean;
      }
    });
  });

  if (btnForgot) {
    btnForgot.addEventListener("click", () => showGate({ forgot: true }));
  }

  if (btnForgotBack) {
    btnForgotBack.addEventListener("click", () => showGate({ login: true }));
  }

  if (btnLoginSendEmailCode) {
    btnLoginSendEmailCode.addEventListener("click", async () => {
      const username = loginForm?.elements?.username?.value?.trim() || "";
      if (!username) {
        setGateMessage(loginErrorEl, "Ingresá tu usuario arriba para enviarte el código.", false);
        loginForm?.elements?.username?.focus();
        return;
      }
      if (loginErrorEl) loginErrorEl.hidden = true;
      btnLoginSendEmailCode.disabled = true;
      btnLoginSendEmailCode.textContent = "Enviando código...";
      try {
        const data = await api("login-code.php", {
          method: "POST",
          body: JSON.stringify({ action: "send", username }),
        });
        if (loginCodeSentNote) {
          setGateMessage(
            loginCodeSentNote,
            data.message || `Código enviado a ${data.emailMasked || "tu correo"}. Ingresalo arriba y tocá Entrar.`,
            true
          );
        }
        btnLoginSendEmailCode.textContent = "Reenviar código al mail";
        const codeInput = loginForm?.elements?.code;
        if (codeInput) {
          codeInput.value = "";
          codeInput.focus();
        }
      } catch (err) {
        setGateMessage(loginErrorEl, err.message, false);
        btnLoginSendEmailCode.textContent = "¿No tenés la app? Enviame un código al mail";
      } finally {
        btnLoginSendEmailCode.disabled = false;
      }
    });
  }

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

  if (btnEmailCodeBack) {
    btnEmailCodeBack.addEventListener("click", () => showGate({ login: true }));
  }

  const handleSendEmailCode = async () => {
    if (!emailCodeForm) return;
    const username = emailCodeForm.elements.username?.value?.trim() || "";
    if (!username) {
      setGateMessage(emailCodeRequestError, "Ingresá tu usuario o correo.", false);
      return;
    }
    if (emailCodeRequestError) emailCodeRequestError.hidden = true;
    if (btnSendEmailCode) {
      btnSendEmailCode.disabled = true;
      btnSendEmailCode.textContent = "Enviando código...";
    }
    try {
      const data = await api("login-code.php", {
        method: "POST",
        body: JSON.stringify({ action: "send", username }),
      });
      emailCodeForm.dataset.user = data.username || username;
      if (emailCodeStepRequest) emailCodeStepRequest.hidden = true;
      if (emailCodeStepVerify) emailCodeStepVerify.hidden = false;
      if (emailCodeSentNote) {
        setGateMessage(
          emailCodeSentNote,
          data.message || `Código enviado a ${data.emailMasked || "tu correo"}.`,
          true
        );
      }
      if (emailCodeVerifyError) emailCodeVerifyError.hidden = true;
      const codeInput = emailCodeForm.elements.code;
      if (codeInput) {
        codeInput.value = "";
        codeInput.focus();
      }
    } catch (err) {
      setGateMessage(emailCodeRequestError, err.message, false);
    } finally {
      if (btnSendEmailCode) {
        btnSendEmailCode.disabled = false;
        btnSendEmailCode.textContent = "Enviar código al mail";
      }
    }
  };

  const handleVerifyEmailCode = async () => {
    if (!emailCodeForm) return;
    const username = emailCodeForm.dataset.user || emailCodeForm.elements.username?.value?.trim() || "";
    const code = emailCodeForm.elements.code?.value?.trim() || "";
    if (!code || code.length < 6) {
      setGateMessage(emailCodeVerifyError, "Ingresá los 6 dígitos del código.", false);
      return;
    }
    if (emailCodeVerifyError) emailCodeVerifyError.hidden = true;
    if (btnVerifyEmailCode) {
      btnVerifyEmailCode.disabled = true;
      btnVerifyEmailCode.textContent = "Verificando...";
    }
    try {
      const data = await api("login-code.php", {
        method: "POST",
        body: JSON.stringify({ action: "verify", username, code }),
      });
      setSessionUser({ username: data.username || username, name: data.name });
      hideGate();
      if (typeof onSuccess === "function") await onSuccess();
    } catch (err) {
      if (err.auth) return;
      setGateMessage(emailCodeVerifyError, err.message, false);
    } finally {
      if (btnVerifyEmailCode) {
        btnVerifyEmailCode.disabled = false;
        btnVerifyEmailCode.textContent = "Confirmar y entrar";
      }
    }
  };

  if (btnSendEmailCode) {
    btnSendEmailCode.addEventListener("click", (e) => {
      e.preventDefault();
      handleSendEmailCode();
    });
  }

  if (btnVerifyEmailCode) {
    btnVerifyEmailCode.addEventListener("click", (e) => {
      e.preventDefault();
      handleVerifyEmailCode();
    });
  }

  if (btnResendEmailCode) {
    btnResendEmailCode.addEventListener("click", async (e) => {
      e.preventDefault();
      const username = emailCodeForm?.dataset?.user || emailCodeForm?.elements?.username?.value?.trim() || "";
      if (!username) return;
      btnResendEmailCode.disabled = true;
      btnResendEmailCode.textContent = "Reenviando...";
      try {
        const data = await api("login-code.php", {
          method: "POST",
          body: JSON.stringify({ action: "send", username }),
        });
        setGateMessage(
          emailCodeSentNote,
          `Nuevo código enviado a ${data.emailMasked || "tu correo"}.`,
          true
        );
        if (emailCodeVerifyError) emailCodeVerifyError.hidden = true;
        const codeInput = emailCodeForm?.elements?.code;
        if (codeInput) {
          codeInput.value = "";
          codeInput.focus();
        }
      } catch (err) {
        setGateMessage(emailCodeVerifyError, err.message, false);
      } finally {
        btnResendEmailCode.disabled = false;
        btnResendEmailCode.textContent = "Reenviar código";
      }
    });
  }

  if (emailCodeForm) {
    emailCodeForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (emailCodeStepVerify && !emailCodeStepVerify.hidden) {
        handleVerifyEmailCode();
      } else {
        handleSendEmailCode();
      }
    });
  }

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
        const data = await api("login.php", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (data.enroll) {
          showGate(data);
        } else {
          setSessionUser({ username: body.username, name: data.name });
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

  if (enrollForm) {
    enrollForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (enrollErrorEl) enrollErrorEl.hidden = true;
      try {
        const data = await api("totp.php", {
          method: "POST",
          body: JSON.stringify({ code: event.target.code.value }),
        });
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

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await api("logout.php", { method: "POST" }).catch(() => {});
      try {
        localStorage.removeItem("kinesica_logged_in");
        localStorage.removeItem("kinesica_user_name");
        sessionStorage.removeItem("kinesica_admin_view");
        sessionStorage.removeItem("kinesica_cta_seen");
      } catch (_) {}
      document.documentElement.classList.remove("is-authenticated");
      setSessionUser(null);
      if (typeof onLogout === "function") onLogout();
      showGate({ login: true });
    });
  }
}
