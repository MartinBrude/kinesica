/**
 * Kinésica Admin - Módulo de Configuración de Honorarios y Medios de Pago
 * Permite a Norberto y María configurar los dos valores de sesión (ATM y General)
 * y los medios de pago (efectivo / transferencia), sincronizándose en tiempo real con Clara.
 */

import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert } from "./dom.js?v=78";

const viewHonorarios = document.querySelector("#view-honorarios");
const inputAtm = document.querySelector("#input-fee-atm");
const inputGeneral = document.querySelector("#input-fee-general");
const inputPayment = document.querySelector("#input-fee-payment-methods");
const statusBanner = document.querySelector("#honorarios-status-banner");
const lastUpdatedEl = document.querySelector("#honorarios-last-updated");
const previewEl = document.querySelector("#honorarios-preview");
const btnSave = document.querySelector("#btn-save-honorarios");

export const DEFAULT_FEES = {
  atm: 65000,
  general: 75000,
  payment_methods: "Efectivo o transferencia bancaria",
};

let currentFees = { ...DEFAULT_FEES };

export function showHonorariosView() {
  if (viewHonorarios) {
    viewHonorarios.hidden = false;
    const views = ["#view-dashboard", "#view-library", "#view-pacientes", "#view-horarios", "#view-form", "#view-compare", "#view-gate"];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });

    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "honorarios" }));
    } catch {}

    loadHonorarios();
  }
}

export function hideHonorariosView() {
  if (viewHonorarios) {
    viewHonorarios.hidden = true;
  }
}

function updatePreview() {
  const atmVal = parseInt(inputAtm?.value, 10) || DEFAULT_FEES.atm;
  const genVal = parseInt(inputGeneral?.value, 10) || DEFAULT_FEES.general;
  const payVal = inputPayment?.value?.trim() || DEFAULT_FEES.payment_methods;

  const atmStr = `$${atmVal.toLocaleString("es-AR")}`;
  const genStr = `$${genVal.toLocaleString("es-AR")}`;

  if (previewEl) {
    previewEl.textContent = `💳 *Honorarios y Cobertura*
• *Honorarios:* ${atmStr} para ATM (bruxismo / dolor mandibular) y ${genStr} para el resto de las consultas (kinesiología general, osteopatía, RPG, etc.). Las sesiones son individuales y de 60 minutos.
• *Medios de pago:* Se puede abonar en ${payVal.toLowerCase()}.
• *Cobertura:* Atendemos de forma particular. Al finalizar tu sesión te entregamos la factura oficial para que puedas presentarla en tu prepaga u obra social y solicitar el reintegro correspondiente según tu plan 📄.

_(Escribí *MENU* para volver a ver las opciones)_`;
  }
}

export async function loadHonorarios() {
  try {
    const data = await api("settings.php");
    if (data && data.fees) {
      currentFees = {
        atm: data.fees.atm || DEFAULT_FEES.atm,
        general: data.fees.general || DEFAULT_FEES.general,
        payment_methods: data.fees.payment_methods || DEFAULT_FEES.payment_methods,
      };

      if (inputAtm) inputAtm.value = currentFees.atm;
      if (inputGeneral) inputGeneral.value = currentFees.general;
      if (inputPayment) inputPayment.value = currentFees.payment_methods;

      if (lastUpdatedEl) {
        if (data.fees.updated_at) {
          const dt = new Date(data.fees.updated_at);
          const who = data.fees.updated_by ? ` por ${escapeHtml(data.fees.updated_by)}` : "";
          lastUpdatedEl.textContent = `Última modificación: ${dt.toLocaleDateString("es-AR")} ${dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs${who}`;
        } else {
          lastUpdatedEl.textContent = "Valores estándar del consultorio";
        }
      }
      updatePreview();
    }
  } catch (err) {
    console.error("Error al cargar honorarios:", err);
  }
}

export function initHonorariosModule() {
  const restrictNumericFee = (el) => {
    if (!el) return;
    el.addEventListener("input", () => {
      const clean = String(el.value || "").replace(/\D/g, "").slice(0, 8);
      if (clean !== el.value) el.value = clean;
      updatePreview();
    });
  };
  restrictNumericFee(inputAtm);
  restrictNumericFee(inputGeneral);
  inputPayment?.addEventListener("input", () => {
    const clean = String(inputPayment.value || "").replace(/[<>]/g, "").slice(0, 160);
    if (clean !== inputPayment.value) inputPayment.value = clean;
    updatePreview();
  });

  btnSave?.addEventListener("click", async () => {
    btnSave.disabled = true;
    if (statusBanner) statusBanner.hidden = true;

    const atm = parseInt(inputAtm?.value, 10);
    const general = parseInt(inputGeneral?.value, 10);
    const payment = inputPayment?.value?.trim() || DEFAULT_FEES.payment_methods;

    if (isNaN(atm) || atm <= 0 || isNaN(general) || general <= 0) {
      dialogAlert("Por favor ingresá valores válidos y positivos para los honorarios de ATM y General.");
      btnSave.disabled = false;
      return;
    }

    try {
      const res = await api("settings.php", {
        method: "POST",
        body: JSON.stringify({
          fees: {
            atm,
            general,
            payment_methods: payment,
          },
        }),
      });

      if (statusBanner) {
        statusBanner.className = "horarios-alert-box is-success";
        statusBanner.textContent = "✅ Honorarios actualizados correctamente. Ya están vigentes en las respuestas de WhatsApp de Clara.";
        statusBanner.hidden = false;
      }
      loadHonorarios();
    } catch (err) {
      dialogAlert("Error al guardar honorarios: " + (err.message || "Problema de conexión"));
    } finally {
      btnSave.disabled = false;
    }
  });
}
