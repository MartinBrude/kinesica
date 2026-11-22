(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KinesicaBookingWidgetTemplate = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function buildWidgetTemplate(widget) {
    const containerMod = widget.options.isModal ? "is-modal" : "is-inline";
    return `
      <div class="kinesica-booking-container ${containerMod}">
        <div class="kb-header">
          ${widget.options.isModal ? `<button type="button" class="kb-close-btn" aria-label="${widget.t("close")}" data-action="close-modal">&times;</button>` : ''}
          <h2>${widget.t("title")}</h2>
          <p>${widget.t("subtitle")}</p>
        </div>

        <div class="kb-stepper">
          <div class="kb-step-item active" data-step-indicator="1"><span class="kb-step-num">1</span> ${widget.t("step1")}</div>
          <div class="kb-step-item" data-step-indicator="2"><span class="kb-step-num">2</span> ${widget.t("step2")}</div>
          <div class="kb-step-item" data-step-indicator="3"><span class="kb-step-num">3</span> ${widget.t("step3")}</div>
          <div class="kb-step-item" data-step-indicator="4"><span class="kb-step-num">4</span> ${widget.t("step4")}</div>
        </div>

        <div class="kb-body">
          <div id="kb-error-banner" class="kb-error-banner"></div>

          <!-- PASO 1: PACIENTE → PROFESIONAL O TÉCNICA -->
          <div class="kb-step-panel active" id="kb-step-1">
            <div class="kb-section-title">${widget.t("qPatient")}</div>
            <div class="kb-choice-grid" id="kb-patient-grid" ${widget.options.adminMode ? 'style="display:none"' : ""}></div>

            <div id="kb-existing-box" class="kb-step1-followup" hidden>
              <div class="kb-section-title" style="font-size: 17px;">${widget.t("qWho")}</div>
              <p class="kb-section-hint" id="kb-existing-hint" ${widget.options.adminMode ? "hidden" : ""}>${widget.t("existingHint")}</p>
              <div class="kb-choice-grid" id="kb-existing-practitioner-grid"></div>
              <div id="kb-existing-leave-notice" class="kb-leave-notice" hidden role="status">
                <p class="kb-leave-notice-text" id="kb-existing-leave-notice-text"></p>
              </div>
            </div>

            <div id="kb-new-box" class="kb-step1-followup" hidden>
              <div class="kb-section-title" style="font-size: 17px;">${widget.t("qTechnique")}</div>
              <p class="kb-section-hint" id="kb-technique-hint" ${widget.options.adminMode ? "hidden" : ""}>${widget.t("techniqueHint")}</p>
              <div class="kb-choice-grid" id="kb-technique-grid"></div>
              <div id="kb-technique-leave-notice" class="kb-leave-notice kb-leave-notice--compact" hidden role="status">
                <p class="kb-leave-notice-text" id="kb-technique-leave-notice-text"></p>
              </div>
              <div id="kb-practitioner-box" class="kb-step1-followup" hidden>
                <div class="kb-section-title" style="font-size: 17px;">${widget.t("qPrefer")}</div>
                <div class="kb-choice-grid" id="kb-practitioner-grid"></div>
              </div>
            </div>

            <div class="kb-step1-footer">
              <button type="button" class="kb-btn kb-btn-whatsapp" id="kb-btn-wa-existing" hidden>${widget.t("openWhatsapp")}</button>
              <button type="button" class="kb-btn kb-btn-primary" id="kb-btn-next-1" disabled>${widget.t("seeSlots")}</button>
            </div>
          </div>

          <!-- PASO 2: DÍA Y HORA -->
          <div class="kb-step-panel" id="kb-step-2">
            <div class="kb-section-title">${widget.t("pickDay")}</div>
            <div class="kb-step2-pref-container" id="kb-step2-pref-container" style="display: none;">
              <button type="button" class="kb-step2-pref-pill" id="kb-step2-pref-pill" title="${widget.t("changePref")}">
                <svg class="kb-step2-pref-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span class="kb-step2-pref-label">${widget.t("prefTag")}</span>
                <strong class="kb-step2-pref-val" id="kb-step2-pref-val"></strong>
                <span class="kb-step2-pref-change">(${widget.t("changePref")})</span>
              </button>
            </div>
            <div class="kb-section-desc" id="kb-slots-subtitle" style="display: none;"></div>

            <label class="kb-slots-label">${widget.t("daysLabel")}</label>
            <div class="kb-date-scroll" id="kb-date-carousel"></div>

            <label class="kb-slots-label" id="kb-slots-grid-title">${widget.t("slotsLabel")}</label>
            <div id="kb-slots-container">
              <div id="kb-slots-loading" class="kb-state-box" style="display: none;">
                <div class="kb-spinner"></div>
                <span>${widget.t("loading")}</span>
              </div>
              <div id="kb-slots-empty" class="kb-state-box" style="display: none;">
                <span>${widget.t("emptyDay")}</span>
              </div>
              <div id="kb-slots-error" class="kb-state-box kb-state-box-error" role="alert" style="display: none;">
                <span id="kb-slots-error-text" class="kb-slots-error-title">${widget.t("slotError")}</span>
                <p id="kb-slots-error-fallback" class="kb-slots-error-fallback">${widget.t("slotFallbackText")}</p>
                <div class="kb-slots-error-actions">
                  <button type="button" class="kb-btn kb-btn-whatsapp kb-btn-whatsapp-primary" id="kb-btn-fallback-whatsapp">${widget.t("slotFallbackBtn")}</button>
                  <button type="button" class="kb-btn kb-btn-secondary" id="kb-btn-retry-slots">${widget.t("retry")}</button>
                </div>
              </div>
              <div class="kb-slots-grid" id="kb-slots-grid"></div>
            </div>

            <div class="kb-actions">
              <button class="kb-btn kb-btn-secondary" id="kb-btn-prev-2">${widget.t("back")}</button>
              <button class="kb-btn kb-btn-primary" id="kb-btn-next-2" disabled>${widget.t("toData")}</button>
            </div>
          </div>

          <!-- PASO 3: FORMULARIO -->
          <div class="kb-step-panel" id="kb-step-3">
            <div class="kb-section-title">${widget.t("dataTitle")}</div>
            <div class="kb-section-desc">${widget.t("dataDesc")}</div>

            <div class="kb-radio-group" ${widget.options.adminMode ? 'style="display:none"' : ""}>
              <div class="kb-radio-title">¿Para quién es el turno?</div>
              <div class="kb-radio-options">
                <label class="kb-radio-label">
                  <input type="radio" name="kb-for-whom" id="kb-radio-self" value="self" checked>
                  <span>Para mí</span>
                </label>
                <label class="kb-radio-label">
                  <input type="radio" name="kb-for-whom" id="kb-radio-other" value="other">
                  <span>Para otra persona</span>
                </label>
              </div>
            </div>

            <div id="kb-third-party-box" style="display: none; margin-bottom: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
              <div style="font-size: 12px; font-weight: 700; color: #166534; margin-bottom: 10px; text-transform: uppercase;">Tus datos (quien agenda el turno):</div>
              <div class="kb-form-group" style="margin-bottom: 8px;">
                <label for="kb-input-contacto-nombre">Tu Nombre y Apellido *</label>
                <input type="text" id="kb-input-contacto-nombre" placeholder="Ej: Laura Gómez" maxlength="100" autocomplete="name">
                <div class="kb-field-error" id="kb-err-contacto-nombre" role="alert" aria-live="assertive" hidden></div>
              </div>
              <div class="kb-form-row">
                <div class="kb-form-group" style="margin-bottom: 8px;">
                  <label for="kb-input-contacto-telefono">Tu Teléfono / WhatsApp *</label>
                  <input type="tel" id="kb-input-contacto-telefono" placeholder="${widget.t("phonePh")}" maxlength="24" inputmode="tel" autocomplete="tel">
                  <div class="kb-field-error" id="kb-err-contacto-telefono" role="alert" aria-live="assertive" hidden></div>
                </div>
                <div class="kb-form-group" style="margin-bottom: 8px;">
                  <label for="kb-input-contacto-notas">Relación o rol (opcional)</label>
                  <input type="text" id="kb-input-contacto-notas" placeholder="Ej: Cónyuge, Hijo/a, Secretaria" maxlength="80">
                </div>
              </div>
              <small style="color: #64748b; font-size: 12px; display: block;">Te enviaremos el comprobante y podrás consultar o anular el turno cuando lo necesites.</small>
            </div>

            <div id="kb-patient-header" style="display: none; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 10px; text-transform: uppercase;">Datos del paciente (quien asistirá a la sesión):</div>

            <div class="kb-form-group">
              <label for="kb-input-nombre" id="kb-label-nombre">${widget.t("name")}</label>
              <input type="text" id="kb-input-nombre" placeholder="${widget.t("namePh")}" maxlength="100" autocomplete="name" required>
              <div class="kb-field-error" id="kb-err-nombre" role="alert" aria-live="assertive" hidden></div>
            </div>

            <div class="kb-form-group">
              <label for="kb-input-email">${widget.t("email")}</label>
              <input type="email" id="kb-input-email" placeholder="${widget.t("emailPh")}" maxlength="120" inputmode="email" autocapitalize="off" spellcheck="false" required autocomplete="email">
              <div class="kb-field-error" id="kb-err-email" role="alert" aria-live="assertive" hidden></div>
            </div>

            <div class="kb-form-row">
              <div class="kb-form-group" id="kb-group-telefono">
                <label for="kb-input-telefono" id="kb-label-telefono">${widget.t("phone")}</label>
                <input type="tel" id="kb-input-telefono" placeholder="${widget.t("phonePh")}" maxlength="24" inputmode="tel" autocomplete="tel" required>
                <div class="kb-field-error" id="kb-err-telefono" role="alert" aria-live="assertive" hidden></div>
                <label id="kb-wrap-no-phone" class="kb-checkbox-label" style="display: none; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; color: #475569; cursor: pointer;">
                  <input type="checkbox" id="kb-check-no-phone">
                  <span>No tiene celular propio (usar mi número de WhatsApp)</span>
                </label>
              </div>
              <div class="kb-form-group">
                <label for="kb-input-dni" id="kb-label-dni">${widget.options.adminMode ? widget.t("dniOptionalLabel") : widget.t("dni")}</label>
                <input type="text" id="kb-input-dni" placeholder="${widget.options.adminMode ? widget.t("dniOptionalPh") : widget.t("dniPh")}" maxlength="20"${widget.options.adminMode ? "" : " required"}>
                <div class="kb-field-error" id="kb-err-dni" role="alert" aria-live="assertive" hidden></div>
              </div>
            </div>

            <div class="kb-actions">
              <button class="kb-btn kb-btn-secondary" id="kb-btn-prev-3">${widget.t("back")}</button>
              <button class="kb-btn kb-btn-primary" id="kb-btn-submit">${widget.t("confirm")}</button>
            </div>
            <p class="kb-privacy-notice">
              ${widget.t("privacyNoticeBefore")}<a href="${widget.t("privacyUrl")}" target="_blank" rel="noopener noreferrer">${widget.t("privacyPolicyLabel")}</a>${widget.t("privacyNoticeAfter")}
            </p>
          </div>

          <!-- PASO 4: CONFIRMACIÓN -->
          <div class="kb-step-panel" id="kb-step-4">
            <div class="kb-success-card">
              <div class="kb-success-icon">✓</div>
              <div class="kb-success-title" id="kb-success-title">${widget.t("success")}</div>
              <p id="kb-success-subtitle" style="color: var(--kin-text-muted);">${widget.t("saved")}</p>

              <div class="kb-summary-box" id="kb-success-summary"></div>

              <div class="kb-calendar-sync-box" id="kb-calendar-sync-box">
                <div class="kb-calendar-sync-header">
                  <span class="kb-calendar-sync-icon" aria-hidden="true">📅</span>
                  <div>
                    <div class="kb-calendar-sync-title">${widget.t("saveCal")}</div>
                    <div class="kb-calendar-sync-subtitle">${widget.t("saveCalSub")}</div>
                  </div>
                </div>
                <div class="kb-calendar-sync-actions">
                  <a href="#" target="_blank" rel="noopener noreferrer" class="kb-btn-cal kb-btn-cal-google" id="kb-btn-cal-google">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6c0-1.11-.89-2-2-2zm0 16H5V9h14v11z" fill="#4285F4"/>
                      <rect x="7" y="11" width="3" height="3" fill="#EA4335"/><rect x="11" y="11" width="3" height="3" fill="#FBBC05"/><rect x="15" y="11" width="3" height="3" fill="#34A853"/>
                    </svg>
                    <span>Google Calendar</span>
                  </a>
                  <button type="button" class="kb-btn-cal kb-btn-cal-ics" id="kb-btn-cal-ics">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span id="kb-btn-cal-ics-text">Apple / Outlook (.ics)</span>
                  </button>
                </div>
              </div>

              <div class="kb-clinic-rules" id="kb-success-clinic-rules" style="display: none;">
                <h4>${widget.t("rulesTitle")}</h4>
                <ul><li>${widget.t("rulesAddr")}</li><li>${widget.t("rulesTime")}</li><li>${widget.t("rulesCompany")}</li><li>${widget.t("rulesClothes")}</li><li>${widget.t("rulesStudies")}</li></ul>
                <div style="margin-top: 14px; text-align: center;"><a href="https://maps.app.goo.gl/urpkh4HYe7dSdjPS9" target="_blank" rel="noopener" class="kb-btn kb-btn-primary" style="display: inline-flex; text-decoration: none;">${widget.t("maps")}</a></div>
              </div>

              ${widget.options.isModal ? `
                <div style="margin-top: 22px; text-align: center;">
                  <button type="button" class="kb-btn kb-btn-secondary" data-action="close-modal" style="width: auto; padding: 10px 28px; font-weight: 600;">${widget.t("done")}</button>
                </div>
              ` : `
                <div style="margin-top: 22px; text-align: center;">
                  <button type="button" class="kb-btn kb-btn-secondary" data-action="reset-widget" style="width: auto; padding: 10px 28px; font-weight: 600;">${widget.t("newBooking")}</button>
                </div>
              `}
            </div>
          </div>

        </div>
      </div>
    `;
  }

  return {
    buildWidgetTemplate,
  };
});
