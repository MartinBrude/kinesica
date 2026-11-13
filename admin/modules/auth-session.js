/** Sesión de usuario autenticado en el admin. */

import { clearAuthStorage, saveAuthStorage } from "./auth-utils.js";

let sessionUser = null;

const qs = (sel) => (typeof document !== "undefined" ? document.querySelector(sel) : null);

export function getSessionUser() {
  if (sessionUser) {
    return sessionUser;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const logged = localStorage.getItem("kinesica_logged_in") === "1";
      const role = localStorage.getItem("kinesica_user_role");
      const name = localStorage.getItem("kinesica_user_name");
      if (logged && (role || name)) {
        return { name: name || "", username: name || "", role: role || "professional" };
      }
    } catch { /* ignore */ }
  }
  return sessionUser;
}

export function setSessionUser(user) {
  sessionUser = user;
  const userLabel = qs("#session-user-name");
  if (user) {
    saveAuthStorage(user);
    if (userLabel) {
      userLabel.textContent = user.name || user.username || "";
      userLabel.hidden = false;
    }
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("is-authenticated");
      if (user.role === "admin") {
        document.documentElement.classList.add("is-admin-role");
      } else {
        document.documentElement.classList.remove("is-admin-role");
      }
    }
  } else {
    clearAuthStorage();
    if (userLabel) {
      userLabel.textContent = "";
      userLabel.hidden = true;
    }
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("is-authenticated");
      document.documentElement.classList.remove("is-admin-role");
    }
  }
}

export function getSessionUserRef() {
  return sessionUser;
}
