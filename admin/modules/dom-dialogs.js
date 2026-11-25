/**
 * Kinésica Admin - Modal Dialogs
 * Sistema de alertas y confirmaciones no bloqueantes basadas en DOM / Accessible Dialogs.
 */

let dialogQueue = Promise.resolve();

function enqueueDialog(task) {
  const run = dialogQueue.then(task, task);
  dialogQueue = run.then(() => {}, () => {});
  return run;
}

/**
 * Aviso modal del admin. Reemplaza window.alert.
 * @param {string} message
 * @param {{type?: "success" | "danger" | "info"}} [options]
 * @returns {Promise<void>}
 */
export function dialogAlert(message, options = {}) {
  const msgStr = String(message ?? "");
  const inferredSuccess = options.type === "success" || /(éxito|correctamente|restauraron|guardados|guardado|importó|importaron)/i.test(msgStr);
  const inferredDanger = options.type === "danger" || (!inferredSuccess && /(error|falló|supera|inválido|no es|no se pudo|falta)/i.test(msgStr));
  const finalType = options.type || (inferredSuccess ? "success" : (inferredDanger ? "danger" : "info"));

  return enqueueDialog(() =>
    openDialog({
      message: msgStr,
      confirm: false,
      alertType: finalType,
      title: options.title,
      hint: options.hint,
      category: options.category,
      errorId: options.errorId,
      errorCode: options.errorCode,
    })
  );
}

/**
 * Confirmación modal del admin. Reemplaza window.confirm.
 * @param {string} message
 * @param {{danger?: boolean, okText?: string, cancelText?: string, title?: string}} [options]
 * @returns {Promise<boolean>}
 */
export function dialogConfirm(message, options = {}) {
  return enqueueDialog(() =>
    openDialog({
      message,
      confirm: true,
      danger: Boolean(options.danger),
      okText: options.okText,
      cancelText: options.cancelText,
      title: options.title,
    })
  );
}

const TOAST_MAX_VISIBLE = 3;
const TOAST_DEFAULT_MS = 3200;
let toastHost = null;

function ensureToastHost() {
  if (toastHost && document.body.contains(toastHost)) return toastHost;
  toastHost = document.createElement("div");
  toastHost.className = "app-toast-host";
  toastHost.setAttribute("aria-live", "polite");
  toastHost.setAttribute("aria-relevant", "additions");
  document.body.append(toastHost);
  return toastHost;
}

/**
 * Aviso no bloqueante (toast). Preferir para éxitos y feedback rutinario.
 * @param {string} message
 * @param {{type?: "success" | "danger" | "info", duration?: number}} [options]
 * @returns {void}
 */
export function toast(message, options = {}) {
  const msgStr = String(message ?? "").trim();
  if (!msgStr) return;

  const inferredSuccess =
    options.type === "success" ||
    /(éxito|correctamente|restauraron|guardados|guardado|importó|importaron|enviado|listo)/i.test(msgStr);
  const inferredDanger =
    options.type === "danger" ||
    (!inferredSuccess && /(error|falló|supera|inválido|no es|no se pudo|falta)/i.test(msgStr));
  const finalType =
    options.type || (inferredSuccess ? "success" : inferredDanger ? "danger" : "info");
  const duration = Math.max(1200, Number(options.duration) || TOAST_DEFAULT_MS);

  const host = ensureToastHost();
  while (host.children.length >= TOAST_MAX_VISIBLE) {
    host.firstElementChild?.remove();
  }

  const el = document.createElement("div");
  el.className = `app-toast is-${finalType}`;
  el.setAttribute("role", "status");
  el.textContent = msgStr;
  host.append(el);

  // Force reflow so enter transition runs.
  void el.offsetWidth;
  el.classList.add("is-visible");

  const dismiss = () => {
    el.classList.remove("is-visible");
    el.classList.add("is-leaving");
    window.setTimeout(() => el.remove(), 220);
  };
  const timer = window.setTimeout(dismiss, duration);
  el.addEventListener("click", () => {
    window.clearTimeout(timer);
    dismiss();
  });
}

export function openDialog({
  message,
  confirm,
  danger,
  okText,
  cancelText,
  alertType,
  title,
  hint,
  category,
  errorId,
  errorCode,
}) {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "app-dialog";
    root.setAttribute("role", "presentation");

    const card = document.createElement("div");
    let cardClasses = "app-dialog-card";
    if (confirm && danger) {
      cardClasses += " is-danger";
    } else if (!confirm) {
      if (alertType === "success") cardClasses += " is-success";
      else if (alertType === "danger") cardClasses += " is-danger";
    }
    card.className = cardClasses;
    card.setAttribute("role", confirm ? "dialog" : "alertdialog");
    card.setAttribute("aria-modal", "true");

    const titleText = String(title || "").trim();
    if (titleText) {
      const heading = document.createElement("h3");
      heading.className = "app-dialog-title";
      heading.id = "app-dialog-title";
      heading.textContent = titleText;
      card.setAttribute("aria-labelledby", "app-dialog-title");
      card.append(heading);
    } else if (category && alertType === "danger") {
      const badge = document.createElement("div");
      badge.className = "app-dialog-badge";
      badge.style.cssText =
        "font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;padding:3px 8px;border-radius:4px;display:inline-block;";
      if (category === "user_input") {
        badge.style.background = "#fffaeb";
        badge.style.color = "#b54708";
        badge.textContent = "⚠️ Verificación de datos";
      } else if (category === "software_logic") {
        badge.style.background = "#fef3f2";
        badge.style.color = "#b42318";
        badge.textContent = "🛠️ Error en el software";
      } else if (category === "external_service") {
        badge.style.background = "#eff8ff";
        badge.style.color = "#175cd3";
        badge.textContent = "🌐 Servicio externo";
      } else if (category === "infrastructure") {
        badge.style.background = "#f4f3ff";
        badge.style.color = "#5925dc";
        badge.textContent = "🖥️ Sistema / Base de datos";
      } else if (category === "auth") {
        badge.style.background = "#fef6ee";
        badge.style.color = "#c4320a";
        badge.textContent = "🔒 Permisos / Sesión";
      }
      card.append(badge);
    }

    const text = document.createElement("p");
    text.className = "app-dialog-text";
    text.textContent = String(message ?? "");
    card.append(text);

    if (hint) {
      const hintEl = document.createElement("div");
      hintEl.className = "app-dialog-hint";
      hintEl.style.cssText =
        "margin-top:10px;font-size:13px;line-height:1.45;color:#344054;background:#f8fafc;padding:9px 12px;border-radius:6px;border-left:3px solid #0b2545;";
      hintEl.textContent = `💡 Sugerencia: ${hint}`;
      card.append(hintEl);
    }

    if (errorId) {
      const refEl = document.createElement("div");
      refEl.className = "app-dialog-ref";
      refEl.style.cssText = "margin-top:8px;font-size:11px;color:#667085;";
      refEl.textContent = `Referencia de diagnóstico: ${errorId}`;
      card.append(refEl);
    }

    const actions = document.createElement("div");
    actions.className = "app-dialog-actions";

    const ok = document.createElement("button");
    ok.type = "button";
    if (confirm) {
      ok.className = danger ? "btn danger" : "btn green";
      ok.textContent = okText || (danger ? "Quitar" : "Confirmar");
    } else {
      ok.className = alertType === "danger" ? "btn danger" : "btn green";
      ok.textContent = okText || "Entendido";
    }

    let cancel = null;
    if (confirm) {
      cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn light";
      cancel.textContent = cancelText || "Cancelar";
      actions.append(cancel);
    }
    actions.append(ok);
    card.append(actions);
    root.append(card);
    document.body.append(root);

    const finish = (value) => {
      document.removeEventListener("keydown", onKey);
      root.remove();
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(confirm ? false : undefined);
      } else if (event.key === "Enter") {
        event.preventDefault();
        finish(confirm ? true : undefined);
      }
    };
    cancel?.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(confirm ? true : undefined));
    root.addEventListener("click", (event) => {
      if (event.target === root) finish(confirm ? false : undefined);
    });
    document.addEventListener("keydown", onKey);
    ok.focus();
  });
}
