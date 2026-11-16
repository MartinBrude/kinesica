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
  var PROF_WA = {
    norberto: { id: "norberto", name: "Norberto", digits: "5491161564311" },
    maria: { id: "maria", name: "María", digits: "5491128531224" },
  };
  var lastPractitioner = null;

  function t(key) {
    return copy[key] != null ? copy[key] : key;
  }

  function tName(key, name) {
    return String(t(key)).replace(/\{name\}/g, name || "Norberto");
  }

  function resolvePractitioner(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = String(raw.id || "").toLowerCase();
    var fallback = PROF_WA[id] || PROF_WA.norberto;
    var digits = String(raw.whatsappDigits || fallback.digits || "").replace(
      /\D/g,
      "",
    );
    if (!digits) digits = fallback.digits;
    return {
      id: fallback.id,
      name: String(raw.name || fallback.name || "Norberto"),
      digits: digits,
    };
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

  function practitionerWaHref(context, practitioner) {
    var p = practitioner || lastPractitioner || PROF_WA.norberto;
    var msg = appendCreds(tName("whatsappProfMsg", p.name));
    if (context) msg += "\n(" + context + ")";
    return waHref(p.digits || NORBERTO_WA, msg);
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
    } else if (opts.showProfWa) {
      var p = opts.practitioner || lastPractitioner || PROF_WA.norberto;
      html +=
        '<a class="mi-turno-btn mi-turno-btn-wa" href="' +
        escapeHtml(practitionerWaHref(opts.waContext || "", p)) +
        '" target="_blank" rel="noopener">' +
        escapeHtml(tName("whatsappProf", p.name)) +
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
    if (turno && turno.profesional) {
      lastPractitioner = resolvePractitioner(turno.profesional);
    }
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

  function showFailure(msg, waContext, practitioner) {
    var valid = lastCreds && isValidCode(lastCreds.codigo);
    if (practitioner) {
      lastPractitioner = resolvePractitioner(practitioner);
    }
    setStatus(msg, "error", {
      showProfWa: valid,
      practitioner: lastPractitioner,
      waContext: waContext || "",
    });
  }

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
      '<div class="mi-turno-confirm-backdrop" data-mt-confirm="no"></div>' +
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
      var action = e.target && e.target.getAttribute("data-mt-confirm");
      if (action === "yes" || action === "no") closeConfirm(action === "yes");
    });

    document.addEventListener("keydown", function (e) {
      if (!confirmEl || confirmEl.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfirm(false);
      } else if (e.key === "Tab") {
        var focusables = confirmEl.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
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
      try {
        confirmPrevFocus.focus();
      } catch (err) {}
    }
    confirmPrevFocus = null;
    var resolve = confirmResolver;
    confirmResolver = null;
    if (resolve) resolve(!!ok);
  }

  function askConfirm() {
    return new Promise(function (resolve) {
      var el = ensureConfirmDialog();
      if (confirmResolver) {
        confirmResolver(false);
      }
      confirmResolver = resolve;
      confirmPrevFocus = document.activeElement;
      el.querySelector("#mt-confirm-title").textContent = t(
        "confirmCancelTitle",
      );
      el.querySelector("#mt-confirm-body").textContent = t("confirmCancel");
      el.querySelector('[data-mt-confirm="no"]').textContent = t(
        "confirmCancelNo",
      );
      el.querySelector('[data-mt-confirm="yes"]').textContent = t(
        "confirmCancelYes",
      );
      el.hidden = false;
      document.documentElement.classList.add("mi-turno-confirm-open");
      requestAnimationFrame(function () {
        el.classList.add("is-open");
        var noBtn = el.querySelector('[data-mt-confirm="no"]');
        if (noBtn) noBtn.focus();
      });
    });
  }

  function runCancel() {
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
          (res.data && (res.data.profesional || (res.data.turno && res.data.turno.profesional))) ||
            null,
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

  function onCancel() {
    if (!lastCreds) return;
    askConfirm().then(function (ok) {
      if (ok) runCancel();
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
