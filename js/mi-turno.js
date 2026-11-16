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

  // Mismo alfabeto / largo que admin/api/lib_relational_turnos_manage.php
  var CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;
  var NORBERTO_WA =
    (copy.whatsappNorbertoDigits || "5491161564311").replace(/\D/g, "");
  var CLARA_WA =
    (copy.whatsappClaraDigits || "5491131781733").replace(/\D/g, "");

  function t(key) {
    return copy[key] != null ? copy[key] : key;
  }

  function isValidCode(code) {
    return CODE_RE.test(String(code || "").trim().toUpperCase());
  }

  function appendCreds(msg) {
    if (!lastCreds) return msg;
    return (
      msg +
      "\n\n" +
      t("apellido") +
      ": " +
      lastCreds.apellido +
      "\n" +
      t("email") +
      ": " +
      lastCreds.email +
      "\n" +
      t("codigo") +
      ": " +
      lastCreds.codigo
    );
  }

  function waHref(digits, msg) {
    return (
      "https://wa.me/" +
      digits +
      "?text=" +
      encodeURIComponent(msg)
    );
  }

  function claraWaHref() {
    return waHref(CLARA_WA, appendCreds(t("whatsappClaraMsg")));
  }

  function norbertoWaHref(context) {
    var msg = appendCreds(t("whatsappNorbertoMsg"));
    if (context) msg += "\n(" + context + ")";
    return waHref(NORBERTO_WA, msg);
  }

  function setStatus(msg, kind, opts) {
    opts = opts || {};
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.className = "mi-turno-status" + (kind ? " is-" + kind : "");
    if (!msg) {
      statusEl.textContent = "";
      return;
    }
    var html = "<p>" + escapeHtml(msg) + "</p>";
    if (opts.showClaraWa) {
      html +=
        '<a class="mi-turno-btn mi-turno-btn-wa" href="' +
        escapeHtml(claraWaHref()) +
        '" target="_blank" rel="noopener">' +
        escapeHtml(t("whatsapp")) +
        "</a>";
    } else if (opts.showNorbertoWa) {
      html +=
        '<a class="mi-turno-btn mi-turno-btn-wa" href="' +
        escapeHtml(norbertoWaHref(opts.waContext || "")) +
        '" target="_blank" rel="noopener">' +
        escapeHtml(t("whatsappNorberto")) +
        "</a>";
    }
    statusEl.innerHTML = html;
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
        '<a class="mi-turno-btn mi-turno-btn-wa" href="' +
        escapeHtml(claraWaHref()) +
        '" target="_blank" rel="noopener">' +
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

  function showFailure(msg, waContext) {
    var valid = lastCreds && isValidCode(lastCreds.codigo);
    setStatus(msg, "error", {
      showNorbertoWa: valid,
      waContext: waContext || "",
    });
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
          setStatus(t("policyBlocked"), "warn", { showClaraWa: true });
          if (res.data.turno) renderTurno(res.data.turno);
          return;
        }
        showFailure(
          (res.data && res.data.error) || t("genericError"),
          "cancel_failed",
        );
        if (btn) {
          btn.disabled = false;
          btn.textContent = t("cancel");
        }
      })
      .catch(function () {
        showFailure(t("genericError"), "cancel_failed");
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

    if (!isValidCode(lastCreds.codigo)) {
      setStatus(t("invalidCode"), "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = t("submit");
      }
      return;
    }

    api("lookup", lastCreds)
      .then(function (res) {
        if (res.ok && res.data.success && res.data.turno) {
          renderTurno(res.data.turno);
          return;
        }
        showFailure(
          (res.data && res.data.error) || t("notFound"),
          "lookup_failed",
        );
      })
      .catch(function () {
        showFailure(t("genericError"), "lookup_failed");
      })
      .then(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = t("submit");
        }
      });
  });
})();
