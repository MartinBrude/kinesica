(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingWidgetStep4 = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  function attachStep4Methods(proto) {
    proto.formatConfirmationWhen = function (dateIso, time) {
      const parts = String(dateIso || "").split("-");
      const day = parts.length === 3 ? `${parts[2]}/${parts[1]}` : String(dateIso || "");
      const hm = String(time || "").slice(0, 5);
      return `${day} ${this.t("at")} ${hm} hs`;
    };

    /** Estado de envío mail/WhatsApp para turnera admin. */
    proto.adminDeliveryStatusText = function (result) {
      const emailOk = !!(result && result.confirmationEmail && result.confirmationEmail.ok);
      const waOk = !!(result && result.confirmationWhatsapp && result.confirmationWhatsapp.ok);
      if (emailOk && waOk) return this.t("adminDeliveryBoth");
      if (waOk) return this.t("adminDeliveryWhatsappOnly");
      if (emailOk) return this.t("adminDeliveryEmailOnly");
      return this.t("adminDeliveryNone");
    };

    proto.renderConfirmation = function (payload, result) {
      const q = (sel) => this.container.querySelector(sel);
      const esc = (v) => this.escapeHtml(v);

      const technique = engine && typeof engine.getTechnique === "function" ? engine.getTechnique(payload.techniqueId) : null;
      const professional = this.practitionerFullName(payload.practitionerId) || this.t("bySchedulePro");
      const isExisting = Boolean(payload.esPaciente || this.state.existingPatient || payload.techniqueId === "paciente");
      const successTitle = q("#kb-success-title");
      if (successTitle) successTitle.textContent = this.t("success");

      const manageUrl = this.safeManageUrl(result && result.manageUrl);
      const summaryBox = q("#kb-success-summary");
      if (summaryBox) {
        summaryBox.innerHTML = `
          <div style="font-weight: 700; color: var(--kin-green-deep); margin-bottom: 8px;">
            ${esc(this.t("summaryKind"))}
          </div>
          ${technique && !technique.bySchedule && !technique.internal ? `<div><strong>${esc(this.t("technique"))}:</strong> ${esc(this.techniqueLabel(technique))}</div>` : ""}
          <div><strong>${esc(this.t("practitioner"))}:</strong> ${esc(professional)}</div>
          <div><strong>${esc(this.t("patient"))}:</strong> ${esc(payload.nombre)}</div>
          <div><strong>${esc(this.t("when"))}:</strong> ${esc(this.formatConfirmationWhen(payload.date, payload.time))}</div>
          ${!isExisting && !this.options.adminMode ? `<div><strong>${esc(this.t("fee"))}:</strong> ${esc(this.feeDisplayHtml(payload.techniqueId, { compact: true }))} <span style="font-size: 12px; color: var(--kin-text-muted);">(${esc(this.t("paymentMethodsNote"))})</span></div>` : ""}
          ${payload.email ? `<div><strong>${esc(this.t("email"))}:</strong> ${esc(payload.email)}</div>` : ""}
          ${result && result.manageCode ? `<div style="margin-top: 10px; padding: 10px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
            <div><strong>${esc(this.t("manageCode"))}</strong> <code style="font-size: 16px; letter-spacing: 0.08em; font-weight: 700; color: #0f766e;">${esc(result.manageCode)}</code></div>
            <div style="margin-top: 6px; font-size: 12px; color: var(--kin-text-muted);">
              ${esc(this.t("manageHint"))}
              <a href="${esc(manageUrl)}" style="color: var(--kin-blue, #005f99); font-weight: 600;">${esc(this.t("manageLink"))}</a>.
            </div>
          </div>` : ""}
          ${this.options.adminMode ? `<div style="margin-top: 6px; font-size: 12px; color: var(--kin-text-muted);">
            ${esc(this.t("eventId"))} <code>${esc((result && result.eventId) || "OK")}</code>
          </div>
          <div style="margin-top: 8px; font-size: 13px; color: var(--kin-text-muted);">
            ${esc(this.adminDeliveryStatusText(result))}
          </div>` : ""}
        `;
      }

      const clinicRules = q("#kb-success-clinic-rules");
      if (clinicRules) clinicRules.style.display = this.options.adminMode ? "none" : "block";

      const subtitle = q("#kb-success-subtitle");
      if (subtitle) subtitle.hidden = true;

      const calBox = q("#kb-calendar-sync-box");
      if (this.options.adminMode) {
        if (calBox) calBox.style.display = "none";
        return;
      }
      this.setupCalendarButtons(payload, result);
    };

    proto.setupCalendarButtons = function (payload, result) {
      const q = (sel) => this.container.querySelector(sel);
      const data = engine && engine.generateCalendarExportData
        ? engine.generateCalendarExportData(payload, result && result.eventId)
        : null;

      if (!data) return;

      const gcalBtn = q("#kb-btn-cal-google");
      if (gcalBtn) gcalBtn.href = data.googleCalendarUrl;

      const icsBtn = q("#kb-btn-cal-ics");
      if (icsBtn) {
        icsBtn.onclick = (e) => {
          e.preventDefault();
          try {
            const blob = new Blob([data.icsContent], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);

            const txt = q("#kb-btn-cal-ics-text");
            if (txt) {
              const orig = txt.textContent;
              txt.textContent = this.t("downloaded");
              setTimeout(() => { txt.textContent = orig; }, 2500);
            }
          } catch (err) {
            console.error("Error al generar archivo .ics:", err);
          }
        };
      }
    };
  }

  return {
    attachStep4Methods,
  };
});
