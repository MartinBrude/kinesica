/**
 * Kinésica Admin - Utilidades de Mensajes y Estado de Gate
 */

export function setGateMessage(el, text, info = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("gate-note", Boolean(info));
  el.classList.toggle("gate-error", !info);
  el.hidden = false;
}

export function bindPasswordToggle(btnSelector, inputFinder) {
  const btn = document.querySelector(btnSelector);
  if (!btn) return;
  btn.addEventListener("click", () => {
    const input = typeof inputFinder === "function" ? inputFinder() : document.querySelector(inputFinder);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.setAttribute("aria-label", isPassword ? "Ocultar contraseña" : "Mostrar contraseña");
    btn.title = isPassword ? "Ocultar contraseña" : "Mostrar contraseña";
    const iconShow = btn.querySelector(".eye-show");
    const iconHide = btn.querySelector(".eye-hide");
    if (iconShow) iconShow.hidden = isPassword;
    if (iconHide) iconHide.hidden = !isPassword;
    input.focus();
  });
}

export function setupNumericCodeInputs() {
  document.querySelectorAll('input[name="code"]').forEach((codeEl) => {
    codeEl.addEventListener("keydown", (e) => {
      if (["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key) || e.ctrlKey || e.metaKey) return;
      if (!/^\d$/.test(e.key)) e.preventDefault();
    });
    codeEl.addEventListener("input", () => {
      const clean = codeEl.value.replace(/\D/g, "").slice(0, 6);
      if (codeEl.value !== clean) codeEl.value = clean;
    });
  });
}

export function clearAuthStorage() {
  try {
    localStorage.removeItem("kinesica_logged_in");
    localStorage.removeItem("kinesica_user_name");
    localStorage.removeItem("kinesica_user_role");
    sessionStorage.removeItem("kinesica_admin_view");
    sessionStorage.removeItem("kinesica_cta_seen");
  } catch (_) {}
}

export function saveAuthStorage(user) {
  try {
    localStorage.setItem("kinesica_logged_in", "1");
    if (user && (user.name || user.username)) {
      localStorage.setItem("kinesica_user_name", user.name || user.username);
    }
    if (user && user.role) {
      localStorage.setItem("kinesica_user_role", user.role);
    }
  } catch (_) {}
}
