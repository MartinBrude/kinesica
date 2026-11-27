/**
 * Consultar / anular turno: apellido + email + código → /api/mi-turno.php
 */
(function () {
  "use strict";

  var form = document.getElementById("mi-turno-form");
  if (!form) return;

  var i18nEl = document.getElementById("mi-turno-i18n");
  var copy = {};
  try { copy = i18nEl ? JSON.parse(i18nEl.textContent || "{}") : {}; } catch (e) { copy = {}; }

  var statusEl = document.getElementById("mt-status");
  var resultEl = document.getElementById("mt-result");
  var submitBtn = document.getElementById("mt-submit");
  var lastCreds = null;
  var lastPractitioner = null;

  // Mismo alfabeto / largo que admin/api/lib_relational_turnos_manage.php
  var CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;
  var NORBERTO_WA = (copy.whatsappNorbertoDigits || "5491161564311").replace(/\D/g, "");
  var CLARA_WA = (copy.whatsappClaraDigits || "5491131781733").replace(/\D/g, "");
  var PROF_WA = {
    norberto: { id: "norberto", name: "Norberto", digits: "5491161564311" },
    maria: { id: "maria", name: "María", digits: "5491128531224" },
  };

  function t(key) { return copy[key] != null ? copy[key] : key; }
  function tName(key, name) { return String(t(key)).replace(/\{name\}/g, name || "Norberto"); }
  function isValidCode(code) { return CODE_RE.test(String(code || "").trim().toUpperCase()); }
  function waHref(digits, msg) { return "https://wa.me/" + digits + "?text=" + encodeURIComponent(msg); }
  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function resolvePractitioner(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = String(raw.id || "").toLowerCase();
    var fallback = PROF_WA[id] || PROF_WA.norberto;
    var digits = String(raw.whatsappDigits || fallback.digits || "").replace(/\D/g, "") || fallback.digits;
    return { id: fallback.id, name: String(raw.name || fallback.name || "Norberto"), digits: digits };
  }

  // Prefill WA sin apellido/email/código (no filtrar secretos de gestión a Meta/chat logs).
  function claraWaHref() { return waHref(CLARA_WA, t("whatsappClaraMsg")); }

  function practitionerWaHref(context, practitioner) {
    var p = practitioner || lastPractitioner || PROF_WA.norberto;
    var msg = tName("whatsappProfMsg", p.name) + (context ? "\n(" + context + ")" : "");
    return waHref(p.digits || NORBERTO_WA, msg);
  }

  function setStatus(msg, kind, opts) {
    opts = opts || {};
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.className = "mi-turno-status" + (kind ? " is-" + kind : "");
    if (!msg) { statusEl.textContent = ""; return; }
    var html = "<p>" + escapeHtml(msg) + "</p>";
    if (opts.showClaraWa) {
      html += '<a class="mi-turno-btn mi-turno-btn-wa" href="' + escapeHtml(claraWaHref()) + '" target="_blank" rel="noopener">' + escapeHtml(t("whatsapp")) + "</a>";
    } else if (opts.showProfWa) {
      var p = opts.practitioner || lastPractitioner || PROF_WA.norberto;
      html += '<a class="mi-turno-btn mi-turno-btn-wa" href="' + escapeHtml(practitionerWaHref(opts.waContext || "", p)) + '" target="_blank" rel="noopener">' + escapeHtml(tName("whatsappProf", p.name)) + "</a>";
    }
    statusEl.innerHTML = html;
  }

  function formatWhen(fecha, hora) {
    if (!fecha) return "—";
    var parts = String(fecha).split("-");
    var d = parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : fecha;
    return hora ? d + " · " + hora + " hs" : d;
  }

  function api(action, body) {
    return fetch("/api/mi-turno.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, body)),
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data || {} }; });
    });
  }

  function renderTurno(turno, opts) {
    opts = opts || {};
    if (!resultEl) return;
    resultEl.hidden = false;
    if (turno && turno.profesional) lastPractitioner = resolvePractitioner(turno.profesional);
    var canCancel = turno && turno.can_cancel && !opts.cancelled;
    var html =
      '<div class="mi-turno-card"><h2>' + escapeHtml(t("foundTitle")) + '</h2><dl class="mi-turno-dl">' +
      "<div><dt>" + escapeHtml(t("patient")) + "</dt><dd>" + escapeHtml(turno.paciente || "—") + "</dd></div>" +
      "<div><dt>" + escapeHtml(t("when")) + "</dt><dd>" + escapeHtml(formatWhen(turno.fecha, turno.hora)) + "</dd></div></dl>";

    if (opts.cancelled) {
      html += '<p class="mi-turno-ok">' + escapeHtml(t("cancelledOk")) + "</p>";
      if (opts.lateNotice) {
        html += '<p class="mi-turno-warn">' + escapeHtml(opts.lateNotice) + "</p>";
      }
    } else if (canCancel) {
      html += '<button type="button" class="mi-turno-btn mi-turno-btn-danger" id="mt-cancel">' + escapeHtml(t("cancel")) + "</button>";
    } else if (turno.cancel_blocked_reason) {
      html += '<p class="mi-turno-warn">' + escapeHtml(t("policyBlocked")) + "</p>" +
        '<a class="mi-turno-btn mi-turno-btn-wa" href="' + escapeHtml(claraWaHref()) + '" target="_blank" rel="noopener">' + escapeHtml(t("whatsapp")) + "</a>";
    }
    html += "</div>";
    resultEl.innerHTML = html;

    var cancelBtn = document.getElementById("mt-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
  }

  function showFailure(msg, waContext, practitioner) {
    var valid = lastCreds && isValidCode(lastCreds.codigo);
    if (practitioner) lastPractitioner = resolvePractitioner(practitioner);
    setStatus(msg, "error", { showProfWa: valid, practitioner: lastPractitioner, waContext: waContext || "" });
  }

  function runCancel() {
    var btn = document.getElementById("mt-cancel");
    if (btn) { btn.disabled = true; btn.textContent = t("cancelling"); }
    setStatus("", "");
    api("cancel", lastCreds)
      .then(function (res) {
        if (res.ok && res.data.success) {
          var lateNotice = res.data.late_cancel_notice
            ? String(res.data.late_cancel_notice)
            : "";
          setStatus(res.data.message || t("cancelledOk"), "ok");
          renderTurno(res.data.turno || {}, {
            cancelled: true,
            lateNotice: lateNotice,
          });
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
          (res.data && (res.data.profesional || (res.data.turno && res.data.turno.profesional))) || null,
        );
        if (btn) { btn.disabled = false; btn.textContent = t("cancel"); }
      })
      .catch(function () {
        showFailure(t("genericError"), "cancel_failed");
        if (btn) { btn.disabled = false; btn.textContent = t("cancel"); }
      });
  }

  function onCancel() {
    if (!lastCreds) return;
    var dialog = window.KinesicaMiTurnoDialog;
    if (dialog && typeof dialog.askConfirm === "function") {
      dialog.askConfirm(t).then(function (ok) { if (ok) runCancel(); });
    } else if (window.confirm(t("confirmCancel"))) {
      runCancel();
    }
  }

  function runLookup() {
    var apellidoEl = document.getElementById("mt-apellido");
    var emailEl = document.getElementById("mt-email");
    var codigoEl = document.getElementById("mt-codigo");
    lastCreds = {
      apellido: ((apellidoEl && apellidoEl.value) || "").trim(),
      email: ((emailEl && emailEl.value) || "").trim(),
      codigo: ((codigoEl && codigoEl.value) || "").trim().toUpperCase(),
    };
    if (codigoEl) codigoEl.value = lastCreds.codigo;
    if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ""; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t("searching"); }
    setStatus("", "");

    if (!isValidCode(lastCreds.codigo)) {
      setStatus(t("invalidCode"), "error");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t("submit"); }
      return;
    }

    api("lookup", lastCreds)
      .then(function (res) {
        if (res.ok && res.data.success && res.data.turno) { renderTurno(res.data.turno); return; }
        showFailure((res.data && res.data.error) || t("notFound"), "lookup_failed");
      })
      .catch(function () { showFailure(t("genericError"), "lookup_failed"); })
      .then(function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t("submit"); }
      });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); runLookup(); });

  function setSearchUiVisible(visible) {
    var lead = document.querySelector(".mi-turno-lead");
    var hint = document.querySelector(".mi-turno-hint");
    form.hidden = !visible;
    if (lead) lead.hidden = !visible;
    if (hint) hint.hidden = !visible;
  }

  // Prefill from mail deep-link: /mi-turno?apellido=&email=&codigo=
  // Con link completo: ocultar búsqueda y mostrar solo el turno / anular.
  try {
    var params = new URLSearchParams(window.location.search || "");
    var qApellido = (params.get("apellido") || params.get("a") || "").trim();
    var qEmail = (params.get("email") || params.get("e") || "").trim();
    var qCodigo = (params.get("codigo") || params.get("code") || params.get("c") || "").trim().toUpperCase();
    var apellidoInput = document.getElementById("mt-apellido");
    var emailInput = document.getElementById("mt-email");
    var codigoInput = document.getElementById("mt-codigo");
    if (qApellido && apellidoInput) apellidoInput.value = qApellido;
    if (qEmail && emailInput) emailInput.value = qEmail;
    if (qCodigo && codigoInput) codigoInput.value = qCodigo;
    if (qApellido && qEmail && isValidCode(qCodigo)) {
      setSearchUiVisible(false);
      lastCreds = { apellido: qApellido, email: qEmail, codigo: qCodigo };
      if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ""; }
      setStatus("", "");
      api("lookup", lastCreds)
        .then(function (res) {
          if (res.ok && res.data.success && res.data.turno) {
            renderTurno(res.data.turno);
            return;
          }
          setSearchUiVisible(true);
          showFailure((res.data && res.data.error) || t("notFound"), "lookup_failed");
        })
        .catch(function () {
          setSearchUiVisible(true);
          showFailure(t("genericError"), "lookup_failed");
        });
    }
  } catch (prefillErr) {}
})();
