/**
 * Kinésica Admin - Toggles de Estado (Clara & Booking) y Vista Previa de Recordatorios
 * Controla activación/pausa de canales y sincronización en tiempo real.
 */

import { api } from "./api.js?v=77";
import { renderReminderPreview } from "./menu-texts.js?v=2";

export function bindPolicyElements() {
  return {
    cancellation: document.querySelector("#cfg-cancellation-policy"),
    confirmation: document.querySelector("#cfg-confirmation-notes"),
    reminderText: document.querySelector("#cfg-reminder-text"),
    reminderNotes: document.querySelector("#cfg-reminder-notes"),
    claraReminderText: document.querySelector("#cfg-clara-reminder-text"),
    claraReminderNotes: document.querySelector("#cfg-clara-reminder-notes"),
    reminderPreview: document.querySelector("#cfg-reminder-preview"),
    claraReminderPreview: document.querySelector("#cfg-clara-reminder-preview"),
  };
}

export function bindToggleElements() {
  return {
    cfgClaraDot: document.querySelector("#cfg-clara-dot"),
    cfgClaraText: document.querySelector("#cfg-clara-status-text"),
    cfgClaraToggleBtn: document.querySelector("#cfg-btn-toggle-clara"),
    cfgBookingDot: document.querySelector("#cfg-booking-dot"),
    cfgBookingText: document.querySelector("#cfg-booking-status-text"),
    cfgBookingToggleBtn: document.querySelector("#cfg-btn-toggle-booking"),
  };
}

export function updateReminderPreview({ inputNotes, inputClaraNotes, previewEl, claraPreviewEl, defaultNotes }) {
  const notes = inputNotes?.value?.trim() || inputClaraNotes?.value?.trim() || defaultNotes;
  const preview = renderReminderPreview(notes);
  if (previewEl) previewEl.textContent = preview;
  if (claraPreviewEl) claraPreviewEl.textContent = preview;
}

export function updateStatusToggles({
  cfgClaraDot,
  cfgClaraText,
  cfgClaraToggleBtn,
  cfgBookingDot,
  cfgBookingText,
  cfgBookingToggleBtn,
  isClaraOn,
  isBookingOn,
}) {
  if (cfgClaraDot) cfgClaraDot.className = `dash-status-dot ${isClaraOn ? "active" : "inactive"}`;
  if (cfgClaraText) cfgClaraText.textContent = isClaraOn ? "Clara: Visible en web + recordatorios" : "Clara: Oculta en web (sin recordatorios)";
  if (cfgClaraToggleBtn) cfgClaraToggleBtn.textContent = isClaraOn ? "Ocultar en web" : "Mostrar en web";

  if (cfgBookingDot) cfgBookingDot.className = `dash-status-dot ${isBookingOn ? "active" : "inactive"}`;
  if (cfgBookingText) cfgBookingText.textContent = isBookingOn ? "Reservas Web: Activas" : "Reservas Web: Pausadas";
  if (cfgBookingToggleBtn) cfgBookingToggleBtn.textContent = isBookingOn ? "Pausar turnera" : "Activar turnera";
}

export function setupConfigToggles({
  cfgClaraToggleBtn,
  cfgBookingToggleBtn,
  getClaraActive,
  getBookingActive,
  onClaraChanged,
  onBookingChanged,
  onAlert,
}) {
  cfgClaraToggleBtn?.addEventListener("click", async () => {
    const nextState = !getClaraActive();
    cfgClaraToggleBtn.disabled = true;
    try {
      await api("settings.php", {
        method: "POST",
        body: JSON.stringify({ clara_active: nextState })
      });
      localStorage.setItem("kinesica_clara_active", nextState ? "1" : "0");
      onClaraChanged(nextState);
    } catch {
      if (typeof onAlert === "function") onAlert("No se pudo cambiar el estado de Clara.");
    } finally {
      cfgClaraToggleBtn.disabled = false;
    }
  });

  cfgBookingToggleBtn?.addEventListener("click", async () => {
    const nextState = !getBookingActive();
    cfgBookingToggleBtn.disabled = true;
    try {
      await api("settings.php", {
        method: "POST",
        body: JSON.stringify({ booking_active: nextState })
      });
      localStorage.setItem("kinesica_booking_active", nextState ? "1" : "0");
      onBookingChanged(nextState);
    } catch {
      if (typeof onAlert === "function") onAlert("No se pudo cambiar el estado de la turnera.");
    } finally {
      cfgBookingToggleBtn.disabled = false;
    }
  });
}
