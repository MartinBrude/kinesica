/**
 * Kinésica Admin - Gestión de Autenticación y Pantalla de Acceso (Gate)
 * Administra el flujo de login, segundo factor (TOTP 2FA), recuperación de contraseña,
 * reseteo seguro y cierre de sesión.
 */

import { api } from "./api.js?v=53";

let sessionUser = null;
let authed = false;

const viewGate = document.querySelector("#view-gate");
const loginForm = document.querySelector("#login-form");
const enrollForm = document.querySelector("#enroll-form");
const forgotForm = document.querySelector("#forgot-form");
const resetForm = document.querySelector("#reset-form");
const sessionNameEl = document.querySelector("#session-name");
const logoutBtn = document.querySelector("#btn-logout");

const enrollAccountEl = document.querySelector("#enroll-account");
const enrollSecretEl = document.querySelector("#enroll-secret");

const loginErrorEl = document.querySelector("#login-error");
const enrollErrorEl = document.querySelector("#enroll-error");
const forgotErrorEl = document.querySelector("#forgot-error");
const resetErrorEl = document.querySelector("#reset-error");

const btnForgot = document.querySelector("#btn-forgot");
const btnForgotBack = document.querySelector("#btn-forgot-back");

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
  if (user && sessionNameEl) {
    sessionNameEl.textContent = user.name || user.username;
    sessionNameEl.hidden = false;
  } else if (sessionNameEl) {
    sessionNameEl.hidden = true;
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
  const libraryView = document.querySelector("#view-library");
  const formView = document.querySelector("#view-form");
  const compareView = document.querySelector("#view-compare");

  if (libraryView) libraryView.hidden = true;
  if (formView) formView.hidden = true;
  if (compareView) compareView.hidden = true;

  if (viewGate) viewGate.hidden = false;
  if (logoutBtn) logoutBtn.hidden = true;
  if (sessionNameEl) sessionNameEl.hidden = true;

  const enroll = Boolean(data && data.enroll);
  const forgot = Boolean(data && data.forgot);
  const reset = Boolean(data && data.reset);

  if (loginForm) loginForm.hidden = enroll || forgot || reset;
  if (enrollForm) enrollForm.hidden = !enroll;
  if (forgotForm) forgotForm.hidden = !forgot;
  if (resetForm) resetForm.hidden = !reset;

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
  if (viewGate) viewGate.hidden = true;
  if (logoutBtn) logoutBtn.hidden = false;
  if (sessionNameEl && sessionUser) {
    sessionNameEl.textContent = sessionUser.name || sessionUser.username;
    sessionNameEl.hidden = false;
  }
}

/**
 * Inicializa los controladores de eventos para los formularios de autenticación.
 * @param {object} callbacks Callbacks para interactuar con el flujo de la aplicación
 * @param {() => Promise<void>} callbacks.onSuccess Callback invocado tras inicio de sesión exitoso
 * @param {() => void} callbacks.onLogout Callback invocado tras desconectar la sesión
 */
export function initAuth({ onSuccess, onLogout }) {
  if (btnForgot) {
    btnForgot.addEventListener("click", () => showGate({ forgot: true }));
  }

  if (btnForgotBack) {
    btnForgotBack.addEventListener("click", () => showGate({ login: true }));
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
      setSessionUser(null);
      if (typeof onLogout === "function") onLogout();
      showGate({ login: true });
    });
  }
}
