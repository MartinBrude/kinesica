/**
 * Consultar / anular turno: apellido + email + código → /api/mi-turno.php
 */
(function () {
  "use strict";

  var form = document.getElementById("mi-turno-form");
  if (!form) return;

  var i18nEl = document.getElementById("mi-turno-i18n");
  var copy = {};
  try {
    copy = i18nEl ? JSON.parse(i18nEl.textContent || "{}") : {};
  } catch (e) {
    copy = {};
  }

  var statusEl = document.getElementById("mt-status");
  var resultEl = document.getElementById("mt-result");
  var submitBtn = document.getElementById("mt-submit");
  var lastCreds = null;

  function t(key) {
    return copy[key] != null ? copy[key] : key;
  }

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
    statusEl.className = "mi-turno-status" + (kind ? " is-" + kind : "");
  }

  function formatWhen(fecha, hora) {
    if (!fecha) return "—";
    var parts = String(fecha).split("-");
    var d =
      parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : fecha;
    return hora ? d + " · " + hora + " hs" : d;
  }

  function api(action, body) {
    return fetch("/api/mi-turno.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, body)),
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data || {} };
      });
    });
  }

  function renderTurno(turno, opts) {
    opts = opts || {};
    if (!resultEl) return;
    resultEl.hidden = false;
    var canCancel = turno && turno.can_cancel && !opts.cancelled;
    var html =
      '<div class="mi-turno-card">' +
      "<h2>" +
      escapeHtml(t("foundTitle")) +
      "</h2>" +
      '<dl class="mi-turno-dl">' +
      "<div><dt>" +
      escapeHtml(t("patient")) +
      "</dt><dd>" +
      escapeHtml(turno.paciente || "—") +
      "</dd></div>" +
      "<div><dt>" +
      escapeHtml(t("when")) +
      "</dt><dd>" +
      escapeHtml(formatWhen(turno.fecha, turno.hora)) +
      "</dd></div>" +
      "</dl>";

    if (opts.cancelled) {
      html +=
        '<p class="mi-turno-ok">' + escapeHtml(t("cancelledOk")) + "</p>";
    } else if (canCancel) {
      html +=
        '<button type="button" class="mi-turno-btn mi-turno-btn-danger" id="mt-cancel">' +
        escapeHtml(t("cancel")) +
        "</button>";
    } else if (turno.cancel_blocked_reason) {
      html +=
        '<p class="mi-turno-warn">' +
        escapeHtml(t("policyBlocked")) +
        "</p>" +
        '<a class="mi-turno-btn mi-turno-btn-wa" href="https://wa.me/5491131781733" target="_blank" rel="noopener">' +
        escapeHtml(t("whatsapp")) +
        "</a>";
    }

    html += "</div>";
    resultEl.innerHTML = html;

    var cancelBtn = document.getElementById("mt-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", onCancel);
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function onCancel() {
    if (!lastCreds) return;
    if (!window.confirm(t("confirmCancel"))) return;
    var btn = document.getElementById("mt-cancel");
    if (btn) {
      btn.disabled = true;
      btn.textContent = t("cancelling");
    }
    setStatus("", "");
    api("cancel", lastCreds)
      .then(function (res) {
        if (res.ok && res.data.success) {
          setStatus(t("cancelledOk"), "ok");
          renderTurno(res.data.turno || {}, { cancelled: true });
          return;
        }
        if (res.status === 403) {
          setStatus(t("policyBlocked"), "warn");
          if (res.data.turno) renderTurno(res.data.turno);
          return;
        }
        setStatus(
          (res.data && res.data.error) || t("genericError"),
          "error",
        );
        if (btn) {
          btn.disabled = false;
          btn.textContent = t("cancel");
        }
      })
      .catch(function () {
        setStatus(t("genericError"), "error");
        if (btn) {
          btn.disabled = false;
          btn.textContent = t("cancel");
        }
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var apellido = (document.getElementById("mt-apellido") || {}).value || "";
    var email = (document.getElementById("mt-email") || {}).value || "";
    var codigo = (document.getElementById("mt-codigo") || {}).value || "";
    lastCreds = {
      apellido: apellido.trim(),
      email: email.trim(),
      codigo: codigo.trim().toUpperCase(),
    };
    if (resultEl) {
      resultEl.hidden = true;
      resultEl.innerHTML = "";
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = t("searching");
    }
    setStatus("", "");
    api("lookup", lastCreds)
      .then(function (res) {
        if (res.ok && res.data.success && res.data.turno) {
          renderTurno(res.data.turno);
          return;
        }
        setStatus(
          (res.data && res.data.error) || t("notFound"),
          "error",
        );
      })
      .catch(function () {
        setStatus(t("genericError"), "error");
      })
      .then(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = t("submit");
        }
      });
  });
})();
