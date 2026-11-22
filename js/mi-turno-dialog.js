/**
 * Accessible confirmation modal for /mi-turno cancellation.
 */
(function () {
  "use strict";

  var confirmEl = null;
  var confirmResolver = null;
  var confirmPrevFocus = null;

  function ensureConfirmDialog() {
    if (confirmEl) return confirmEl;
    confirmEl = document.createElement("div");
    confirmEl.id = "mt-confirm";
    confirmEl.className = "mi-turno-confirm";
    confirmEl.hidden = true;
    confirmEl.innerHTML =
      '<div class="mi-turno-confirm-backdrop" data-mt-dismiss="1"></div>' +
      '<div class="mi-turno-confirm-card" role="dialog" aria-modal="true" aria-labelledby="mt-confirm-title" aria-describedby="mt-confirm-body">' +
      '<p class="mi-turno-confirm-brand">Kinésica</p>' +
      '<h2 id="mt-confirm-title" class="mi-turno-confirm-title"></h2>' +
      '<p id="mt-confirm-body" class="mi-turno-confirm-body"></p>' +
      '<div class="mi-turno-confirm-actions">' +
      '<button type="button" class="mi-turno-btn mi-turno-btn-ghost" data-mt-confirm="no"></button>' +
      '<button type="button" class="mi-turno-btn mi-turno-btn-danger" data-mt-confirm="yes"></button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(confirmEl);

    confirmEl.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest && e.target.closest("button[data-mt-confirm]");
      var action =
        (btn && btn.getAttribute("data-mt-confirm")) ||
        (e.target && e.target.classList && e.target.classList.contains("mi-turno-confirm-backdrop") ? "no" : null);
      if (action === "yes" || action === "no") closeConfirm(action === "yes");
    });

    document.addEventListener("keydown", function (e) {
      if (!confirmEl || confirmEl.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfirm(false);
      } else if (e.key === "Tab") {
        var focusables = confirmEl.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    return confirmEl;
  }

  function closeConfirm(ok) {
    if (!confirmEl || confirmEl.hidden) return;
    confirmEl.hidden = true;
    confirmEl.classList.remove("is-open");
    document.documentElement.classList.remove("mi-turno-confirm-open");
    if (confirmPrevFocus && typeof confirmPrevFocus.focus === "function") {
      try { confirmPrevFocus.focus(); } catch (err) {}
    }
    confirmPrevFocus = null;
    var resolve = confirmResolver;
    confirmResolver = null;
    if (resolve) resolve(!!ok);
  }

  function askConfirm(t) {
    return new Promise(function (resolve) {
      var el = ensureConfirmDialog();
      if (confirmResolver) confirmResolver(false);
      confirmResolver = resolve;
      confirmPrevFocus = document.activeElement;
      el.querySelector("#mt-confirm-title").textContent = t("confirmCancelTitle");
      el.querySelector("#mt-confirm-body").textContent = t("confirmCancel");
      el.querySelector('button[data-mt-confirm="no"]').textContent = t("confirmCancelNo");
      el.querySelector('button[data-mt-confirm="yes"]').textContent = t("confirmCancelYes");
      el.hidden = false;
      document.documentElement.classList.add("mi-turno-confirm-open");
      requestAnimationFrame(function () {
        el.classList.add("is-open");
        var noBtn = el.querySelector('button[data-mt-confirm="no"]');
        if (noBtn) noBtn.focus();
      });
    });
  }

  window.KinesicaMiTurnoDialog = { askConfirm: askConfirm };
})();
