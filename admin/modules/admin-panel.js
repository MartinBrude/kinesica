/**
 * Kinésica Admin - Módulo de Administración ("Admin del Admin")
 * Exclusivo para usuarios con rol 'admin'.
 * Permite supervisar contadores de logins y gestionar el equipo de profesionales:
 * altas, bajas (desactivación lógica), edición de datos y reenvío de invitaciones.
 */

import { api } from "./api.js?v=77";
import { getSessionUser } from "./auth.js?v=80";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";

const viewAdmin = document.querySelector("#view-admin");
const profTableBody = document.querySelector("#admin-prof-tbody");
const btnNuevoProf = document.querySelector("#admin-btn-nuevo-prof");

// Modal de profesional
const modalEl = document.querySelector("#admin-prof-modal");
const modalTitle = document.querySelector("#admin-prof-modal-title");
const formEl = document.querySelector("#admin-prof-form");
const inputUsername = document.querySelector("#admin-prof-username");
const inputFirstName = document.querySelector("#admin-prof-firstname");
const inputLastName = document.querySelector("#admin-prof-lastname");
const inputEmail = document.querySelector("#admin-prof-email");
const inputTelefono = document.querySelector("#admin-prof-telefono");
const selectRole = document.querySelector("#admin-prof-role");
const btnCloseModal = document.querySelector("#admin-prof-modal-close");
const btnCancelModal = document.querySelector("#admin-prof-modal-cancel");
const btnSaveModal = document.querySelector("#admin-prof-modal-save");

// Elementos de la subsección de Gastos
const gastosTableBody = document.querySelector("#admin-gastos-tbody");
const gastosTotalEur = document.querySelector("#admin-gastos-total-eur");
const gastosTotalUsd = document.querySelector("#admin-gastos-total-usd");
const gastosTotalArs = document.querySelector("#admin-gastos-total-ars");
const gastosCountLabel = document.querySelector("#admin-gastos-count-label");
const gastosTfootEur = document.querySelector("#admin-gastos-tfoot-eur");
const gastosTfootUsd = document.querySelector("#admin-gastos-tfoot-usd");
const gastosTfootArs = document.querySelector("#admin-gastos-tfoot-ars");
const btnNuevoGasto = document.querySelector("#admin-btn-nuevo-gasto");

// Modal de gasto
const modalGastoEl = document.querySelector("#admin-gasto-modal");
const modalGastoTitle = document.querySelector("#admin-gasto-modal-title");
const formGastoEl = document.querySelector("#admin-gasto-form");
const inputGastoId = document.querySelector("#admin-gasto-id");
const inputGastoConcepto = document.querySelector("#admin-gasto-concepto");
const inputGastoDetalle = document.querySelector("#admin-gasto-detalle");
const inputGastoFecha = document.querySelector("#admin-gasto-fecha");
const inputGastoMonto = document.querySelector("#admin-gasto-monto");
const selectGastoMoneda = document.querySelector("#admin-gasto-moneda");
const inputGastoMontoEur = document.querySelector("#admin-gasto-monto-eur");
const inputGastoMontoUsd = document.querySelector("#admin-gasto-monto-usd");
const inputGastoMontoArs = document.querySelector("#admin-gasto-monto-ars");
const btnFetchFechaTc = document.querySelector("#admin-btn-fetch-fecha-tc");
const statusGastoTc = document.querySelector("#admin-gasto-tc-status");
const btnCloseGastoModal = document.querySelector("#admin-gasto-modal-close");
const btnCancelGastoModal = document.querySelector("#admin-gasto-modal-cancel");
const btnSaveGastoModal = document.querySelector("#admin-gasto-modal-save");

let currentEditingUser = null;
let cachedProfesionales = [];

let currentEditingGasto = null;
let cachedGastos = [];

// Caché de cotizaciones históricas por fecha (YYYY-MM-DD -> { eurUsd, eurArs })
const historicalRatesByDate = {
  "2026-10-25": { eurUsd: 1.082, eurArs: 1450.0 },
  "2026-09-26": { eurUsd: 1.112, eurArs: 1425.8 },
  "2026-02-03": { eurUsd: 1.045, eurArs: 1295.4 },
  "2025-03-28": { eurUsd: 1.083, eurArs: 1160.5 },
};

let modalCurrentRates = { eurUsd: 1.082, eurArs: 1450.0 };

const SEED_GASTOS = [
  {
    id: "gasto_1",
    concepto: "AI automation apps",
    detalle: "",
    fecha: "2026-10-25",
    moneda: "EUR",
    monto: 148.09,
    monto_eur: 148.09,
    monto_usd: 160.23,
    monto_ars: 214730.50,
    tc_eur_usd: 1.082,
    tc_eur_ars: 1450.00,
  },
  {
    id: "gasto_2",
    concepto: "AI automation apps",
    detalle: "",
    fecha: "2026-09-26",
    moneda: "EUR",
    monto: 8.99,
    monto_eur: 8.99,
    monto_usd: 10.00,
    monto_ars: 12817.94,
    tc_eur_usd: 1.112,
    tc_eur_ars: 1425.80,
  },
  {
    id: "gasto_3",
    concepto: "Business Web Hosting",
    detalle: "kinesica.com.ar",
    fecha: "2026-02-03",
    moneda: "EUR",
    monto: 65.88,
    monto_eur: 65.88,
    monto_usd: 68.84,
    monto_ars: 85340.95,
    tc_eur_usd: 1.045,
    tc_eur_ars: 1295.40,
  },
  {
    id: "gasto_4",
    concepto: "Premium Web Hosting",
    detalle: "kinesica.com.ar",
    fecha: "2025-03-28",
    moneda: "EUR",
    monto: 35.88,
    monto_eur: 35.88,
    monto_usd: 38.86,
    monto_ars: 41638.74,
    tc_eur_usd: 1.083,
    tc_eur_ars: 1160.50,
  },
];

function formatMoney(amount, currency = "ARS") {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (currency === "EUR") return `${formatted} €`;
  if (currency === "USD") return `US$ ${formatted}`;
  return `$ ${formatted}`;
}

export function showAdminView() {
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    dialogAlert("Sección reservada exclusivamente a administradores.");
    return;
  }

  if (viewAdmin) {
    viewAdmin.hidden = false;
    const views = [
      "#view-dashboard",
      "#view-library",
      "#view-pacientes",
      "#view-consultorio",
      "#view-clara",
      "#view-configuracion",
      "#view-form",
      "#view-compare",
      "#view-gate",
    ];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });

    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "admin" }));
    } catch {}

    loadAdminData();
  }
}

export function hideAdminView() {
  if (viewAdmin) {
    viewAdmin.hidden = true;
  }
}

export async function loadAdminData() {
  await Promise.allSettled([loadProfesionalesData(), loadGastosData()]);
}

async function loadProfesionalesData() {
  try {
    const data = await api("profesionales.php");
    if (!data || !Array.isArray(data.profesionales)) {
      return;
    }
    cachedProfesionales = data.profesionales;
    renderProfesionales(cachedProfesionales);
  } catch (err) {
    dialogAlert("Error al cargar datos de administración: " + (err.message || "Error desconocido"));
  }
}

async function loadGastosData() {
  try {
    const data = await api("gastos.php");
    if (data && Array.isArray(data.gastos)) {
      cachedGastos = data.gastos;
    } else if (!cachedGastos.length) {
      cachedGastos = [...SEED_GASTOS];
    }
  } catch (_err) {
    if (!cachedGastos.length) {
      cachedGastos = [...SEED_GASTOS];
    }
  }
  renderGastos(cachedGastos);
}

function renderProfesionales(profesionales) {
  if (!profTableBody) return;
  profTableBody.replaceChildren(
    ...profesionales.map((prof) => {
      const tr = document.createElement("tr");
      if (!prof.active) {
        tr.className = "is-inactive";
      }

      // Nombre y usuario
      const tdName = document.createElement("td");
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = prof.name;
      const userSub = document.createElement("div");
      userSub.style.fontSize = "12px";
      userSub.style.color = "var(--muted)";
      userSub.textContent = `@${prof.username}`;
      tdName.append(nameStrong, userSub);

      // Email
      const tdEmail = document.createElement("td");
      tdEmail.textContent = prof.email || "—";

      // Teléfono
      const tdPhone = document.createElement("td");
      tdPhone.textContent = prof.telefono || "—";

      // Rol
      const tdRole = document.createElement("td");
      const roleBadge = document.createElement("span");
      roleBadge.className = `prof-role-badge ${prof.role === "admin" ? "admin" : "professional"}`;
      roleBadge.textContent = prof.role === "admin" ? "Admin" : "Profesional";
      tdRole.append(roleBadge);

      // Estado
      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `prof-status-badge ${prof.active ? "active" : "inactive"}`;
      statusBadge.textContent = prof.active ? "Activo" : "Inactivo";
      tdStatus.append(statusBadge);

      // Acciones
      const tdActions = document.createElement("td");
      tdActions.className = "prof-actions-td";

      const actionsWrap = document.createElement("div");
      actionsWrap.className = "prof-actions-cell";

      // Botón Editar
      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn ghost btn-prof-edit";
      btnEdit.textContent = "Editar";
      btnEdit.addEventListener("click", () => openEditModal(prof));
      actionsWrap.append(btnEdit);

      // Botón Dar de baja / Reactivar (no disponible para martin)
      if (prof.username !== "martin") {
        const btnToggle = document.createElement("button");
        btnToggle.type = "button";
        btnToggle.className = `btn ${prof.active ? "ghost" : "green"} btn-prof-toggle`;
        btnToggle.style.color = prof.active ? "#dc2626" : "";
        btnToggle.textContent = prof.active ? "Dar de baja" : "Reactivar";
        btnToggle.addEventListener("click", () => handleToggleActive(prof));
        actionsWrap.append(btnToggle);
      } else {
        const spacer = document.createElement("span");
        spacer.className = "btn-prof-spacer";
        spacer.setAttribute("aria-hidden", "true");
        actionsWrap.append(spacer);
      }

      tdActions.append(actionsWrap);
      tr.append(tdName, tdEmail, tdPhone, tdRole, tdStatus, tdActions);
      return tr;
    })
  );
}

function openCreateModal() {
  currentEditingUser = null;
  if (modalTitle) modalTitle.textContent = "Nuevo Profesional";
  if (inputUsername) {
    inputUsername.value = "";
    inputUsername.parentElement.hidden = true;
  }
  if (inputFirstName) inputFirstName.value = "";
  if (inputLastName) inputLastName.value = "";
  if (inputEmail) inputEmail.value = "";
  if (inputTelefono) inputTelefono.value = "";
  if (selectRole) selectRole.value = "professional";

  if (modalEl) modalEl.hidden = false;
  inputFirstName?.focus();
}

function openEditModal(prof) {
  currentEditingUser = prof;
  if (modalTitle) modalTitle.textContent = `Editar a ${prof.name}`;
  if (inputUsername) {
    inputUsername.value = prof.username;
    inputUsername.parentElement.hidden = false;
  }
  if (inputFirstName) inputFirstName.value = prof.first_name || "";
  if (inputLastName) inputLastName.value = prof.last_name || "";
  if (inputEmail) inputEmail.value = prof.email || "";
  if (inputTelefono) inputTelefono.value = prof.telefono || "";
  if (selectRole) {
    selectRole.value = prof.role || "professional";
    selectRole.disabled = prof.username === "martin";
  }

  if (modalEl) modalEl.hidden = false;
  inputFirstName?.focus();
}

function closeModal() {
  if (modalEl) modalEl.hidden = true;
  currentEditingUser = null;
}

async function handleSaveProfessional(e) {
  e.preventDefault();
  const firstName = inputFirstName?.value?.trim() || "";
  const lastName = inputLastName?.value?.trim() || "";
  const email = inputEmail?.value?.trim() || "";
  const telefono = inputTelefono?.value?.trim() || "";
  const role = selectRole?.value || "professional";

  if (!firstName || !lastName) {
    dialogAlert("Completá el Nombre y el Apellido.");
    return;
  }
  if (!email || !email.includes("@")) {
    dialogAlert("Ingresá un correo electrónico válido.");
    return;
  }

  btnSaveModal.disabled = true;
  try {
    if (currentEditingUser) {
      // Modificar
      const res = await api("profesionales.php", {
        method: "POST",
        body: JSON.stringify({
          action: "update",
          username: currentEditingUser.username,
          first_name: firstName,
          last_name: lastName,
          email,
          telefono,
          role,
        }),
      });
      dialogAlert(res.message || "Profesional actualizado correctamente.");
    } else {
      // Alta
      const res = await api("profesionales.php", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          first_name: firstName,
          last_name: lastName,
          email,
          telefono,
          role,
        }),
      });
      dialogAlert(res.message || "Profesional dado de alta. Se envió el link a su correo.");
    }
    closeModal();
    await loadAdminData();
  } catch (err) {
    dialogAlert("Error al guardar: " + (err.message || "Error desconocido"));
  } finally {
    btnSaveModal.disabled = false;
  }
}

async function handleToggleActive(prof) {
  const isActivating = !prof.active;
  const msg = isActivating
    ? `¿Deseás reactivar la cuenta de ${escapeHtml(prof.name)}? Volverá a tener acceso y aparecerá en las turneras y notificaciones.`
    : `¿Estás seguro de dar de baja a ${escapeHtml(prof.name)}? La cuenta quedará suspendida (no podrá iniciar sesión ni se ofrecerá en reservas activas). Las historias clínicas existentes no se perderán.`;

  const ok = await dialogConfirm(msg);
  if (!ok) return;

  try {
    const res = await api("profesionales.php", {
      method: "POST",
      body: JSON.stringify({
        action: "toggle_active",
        username: prof.username,
      }),
    });
    dialogAlert(res.message || "Estado actualizado.");
    await loadAdminData();
  } catch (err) {
    dialogAlert("Error al cambiar estado: " + (err.message || "Error desconocido"));
  }
}

async function handleResendInvite(prof) {
  const ok = await dialogConfirm(
    `¿Reenviar enlace de configuración de contraseña a ${escapeHtml(prof.name)} (${escapeHtml(prof.email)})?`
  );
  if (!ok) return;

  try {
    const res = await api("profesionales.php", {
      method: "POST",
      body: JSON.stringify({
        action: "resend_invite",
        username: prof.username,
      }),
    });
    dialogAlert(res.message || "Enlace enviado exitosamente.");
  } catch (err) {
    dialogAlert("Error al reenviar enlace: " + (err.message || "Error desconocido"));
  }
}

/**
 * Obtiene los valores en las 3 monedas guardados en el registro (o los calcula con la cotización de su fecha).
 */
function getRecordDailyAmounts(gasto) {
  const mon = (gasto.moneda || "EUR").toUpperCase();
  const monto = Number(gasto.monto) || 0;
  const dateRates = historicalRatesByDate[gasto.fecha] || { eurUsd: 1.082, eurArs: 1450.0 };
  const tcEurUsd = Number(gasto.tc_eur_usd) > 0 ? Number(gasto.tc_eur_usd) : dateRates.eurUsd;
  const tcEurArs = Number(gasto.tc_eur_ars) > 0 ? Number(gasto.tc_eur_ars) : dateRates.eurArs;
  const tcUsdArs = tcEurUsd > 0 ? tcEurArs / tcEurUsd : 1340.0;

  let eur = Number(gasto.monto_eur);
  let usd = Number(gasto.monto_usd);
  let ars = Number(gasto.monto_ars);

  if (!(eur > 0) || !(usd > 0) || !(ars > 0)) {
    if (mon === "EUR") {
      eur = monto;
      usd = Math.round(monto * tcEurUsd * 100) / 100;
      ars = Math.round(monto * tcEurArs * 100) / 100;
    } else if (mon === "USD") {
      usd = monto;
      eur = Math.round((monto / tcEurUsd) * 100) / 100;
      ars = Math.round(monto * tcUsdArs * 100) / 100;
    } else {
      ars = monto;
      eur = Math.round((monto / tcEurArs) * 100) / 100;
      usd = Math.round((monto / tcUsdArs) * 100) / 100;
    }
  }

  return { eur, usd, ars, tcEurUsd, tcEurArs };
}

/**
 * Consulta la cotización histórica para una fecha determinada (YYYY-MM-DD).
 */
async function fetchRatesForDate(fecha, notify = false) {
  const cleanDate = (fecha || "").trim();
  if (historicalRatesByDate[cleanDate] && !notify) {
    modalCurrentRates = { ...historicalRatesByDate[cleanDate] };
    updateModalTcStatus(cleanDate, false);
    recalcModalCurrencies();
    return;
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const dateTag = cleanDate && cleanDate <= today ? cleanDate : "latest";
    const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateTag}/v1/currencies/eur.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.eur) {
        const eurUsd = Number(data.eur.usd) || 1.082;
        const eurArs = Number(data.eur.ars) || 1450.0;
        modalCurrentRates = {
          eurUsd: Math.round(eurUsd * 10000) / 10000,
          eurArs: Math.round(eurArs * 100) / 100,
        };
        if (cleanDate) {
          historicalRatesByDate[cleanDate] = { ...modalCurrentRates };
        }
        updateModalTcStatus(cleanDate, true);
        recalcModalCurrencies();
        if (notify) {
          dialogAlert(`Cotización del ${cleanDate || "día"} aplicada: 1 EUR = US$ ${modalCurrentRates.eurUsd} | $ ${modalCurrentRates.eurArs.toLocaleString("es-AR")} ARS.`);
        }
        return;
      }
    }
  } catch (_) {}

  if (cleanDate && historicalRatesByDate[cleanDate]) {
    modalCurrentRates = { ...historicalRatesByDate[cleanDate] };
  }
  updateModalTcStatus(cleanDate, false);
  recalcModalCurrencies();
  if (notify) {
    dialogAlert("Se aplicó la cotización histórica de referencia para la fecha seleccionada.");
  }
}

function updateModalTcStatus(fecha, fromOnline = false) {
  if (!statusGastoTc) return;
  const labelFecha = fecha || "la fecha seleccionada";
  const src = fromOnline ? "cotización histórica verificada" : "cotización registrada del día";
  statusGastoTc.textContent = `Cambio del ${labelFecha} (${src}): 1 EUR = US$ ${modalCurrentRates.eurUsd.toLocaleString("es-AR")} | $ ${modalCurrentRates.eurArs.toLocaleString("es-AR")} ARS.`;
}

function recalcModalCurrencies() {
  const monto = parseFloat(inputGastoMonto?.value || "0");
  const mon = (selectGastoMoneda?.value || "EUR").toUpperCase();
  const { eurUsd, eurArs } = modalCurrentRates;
  const usdArs = eurUsd > 0 ? eurArs / eurUsd : 1340.0;

  if (inputGastoMontoEur) inputGastoMontoEur.readOnly = mon === "EUR";
  if (inputGastoMontoUsd) inputGastoMontoUsd.readOnly = mon === "USD";
  if (inputGastoMontoArs) inputGastoMontoArs.readOnly = mon === "ARS";

  if (!(monto > 0)) {
    if (inputGastoMontoEur) inputGastoMontoEur.value = "";
    if (inputGastoMontoUsd) inputGastoMontoUsd.value = "";
    if (inputGastoMontoArs) inputGastoMontoArs.value = "";
    return;
  }

  let eur = 0;
  let usd = 0;
  let ars = 0;

  if (mon === "EUR") {
    eur = monto;
    usd = Math.round(monto * eurUsd * 100) / 100;
    ars = Math.round(monto * eurArs * 100) / 100;
  } else if (mon === "USD") {
    usd = monto;
    eur = Math.round((monto / eurUsd) * 100) / 100;
    ars = Math.round(monto * usdArs * 100) / 100;
  } else {
    ars = monto;
    eur = Math.round((monto / eurArs) * 100) / 100;
    usd = Math.round((monto / usdArs) * 100) / 100;
  }

  if (inputGastoMontoEur) inputGastoMontoEur.value = eur.toFixed(2);
  if (inputGastoMontoUsd) inputGastoMontoUsd.value = usd.toFixed(2);
  if (inputGastoMontoArs) inputGastoMontoArs.value = ars.toFixed(2);
}

function renderGastos(gastos) {
  let totalEur = 0;
  let totalUsd = 0;
  let totalArs = 0;

  for (const g of gastos) {
    const { eur, usd, ars } = getRecordDailyAmounts(g);
    totalEur += eur;
    totalUsd += usd;
    totalArs += ars;
  }

  // Actualizar las 3 Tarjetas KPI
  if (gastosTotalEur) gastosTotalEur.textContent = formatMoney(totalEur, "EUR");
  if (gastosTotalUsd) gastosTotalUsd.textContent = formatMoney(totalUsd, "USD");
  if (gastosTotalArs) gastosTotalArs.textContent = formatMoney(totalArs, "ARS");
  if (gastosCountLabel) {
    gastosCountLabel.textContent = `${gastos.length} gasto${gastos.length === 1 ? "" : "s"} registrado${gastos.length === 1 ? "" : "s"}`;
  }

  // Actualizar pie de tabla (Suma Total por cada columna)
  if (gastosTfootEur) gastosTfootEur.textContent = formatMoney(totalEur, "EUR");
  if (gastosTfootUsd) gastosTfootUsd.textContent = formatMoney(totalUsd, "USD");
  if (gastosTfootArs) gastosTfootArs.textContent = formatMoney(totalArs, "ARS");

  if (!gastosTableBody) return;

  if (gastos.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.style.textAlign = "center";
    td.style.color = "var(--muted)";
    td.style.padding = "28px 16px";
    td.textContent = "No hay gastos registrados todavía.";
    tr.appendChild(td);
    gastosTableBody.replaceChildren(tr);
    return;
  }

  gastosTableBody.replaceChildren(
    ...gastos.map((gasto) => {
      const tr = document.createElement("tr");
      const mon = (gasto.moneda || "EUR").toUpperCase();
      const { eur, usd, ars, tcEurUsd, tcEurArs } = getRecordDailyAmounts(gasto);

      // Columna 1: Servicio / Concepto
      const tdConcepto = document.createElement("td");
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = gasto.concepto;
      tdConcepto.appendChild(nameStrong);

      if (gasto.detalle && gasto.detalle.trim()) {
        const sub = document.createElement("div");
        sub.className = "gasto-detalle-sub";
        sub.textContent = gasto.detalle.trim();
        tdConcepto.appendChild(sub);
      }

      // Columna 2: Pagado el (Fecha)
      const tdFecha = document.createElement("td");
      tdFecha.textContent = gasto.fecha || "—";
      const pagadoEnSub = document.createElement("span");
      pagadoEnSub.className = "gasto-tc-sub";
      pagadoEnSub.textContent = `Pagado en ${mon}`;
      tdFecha.appendChild(pagadoEnSub);

      // Columna 3: EUR (€) en ese día
      const tdEur = document.createElement("td");
      tdEur.className = "num-col";
      tdEur.textContent = formatMoney(eur, "EUR");
      if (mon === "EUR") {
        const badge = document.createElement("span");
        badge.className = "gasto-orig-badge";
        badge.textContent = "Original";
        tdEur.appendChild(badge);
      } else {
        const sub = document.createElement("span");
        sub.className = "gasto-tc-sub";
        sub.textContent = `Cambio del ${gasto.fecha}`;
        tdEur.appendChild(sub);
      }

      // Columna 4: USD ($) en ese día
      const tdUsd = document.createElement("td");
      tdUsd.className = "num-col";
      tdUsd.textContent = formatMoney(usd, "USD");
      if (mon === "USD") {
        const badge = document.createElement("span");
        badge.className = "gasto-orig-badge";
        badge.textContent = "Original";
        tdUsd.appendChild(badge);
      } else {
        const sub = document.createElement("span");
        sub.className = "gasto-tc-sub";
        sub.textContent = `TC día: ${tcEurUsd.toLocaleString("es-AR")} US$/€`;
        tdUsd.appendChild(sub);
      }

      // Columna 5: ARS ($) en ese día
      const tdArs = document.createElement("td");
      tdArs.className = "num-col";
      tdArs.textContent = formatMoney(ars, "ARS");
      if (mon === "ARS") {
        const badge = document.createElement("span");
        badge.className = "gasto-orig-badge";
        badge.textContent = "Original";
        tdArs.appendChild(badge);
      } else {
        const sub = document.createElement("span");
        sub.className = "gasto-tc-sub";
        sub.textContent = `TC día: $ ${tcEurArs.toLocaleString("es-AR")}/€`;
        tdArs.appendChild(sub);
      }

      // Columna 6: Acciones (Editar, Eliminar)
      const tdActions = document.createElement("td");
      tdActions.className = "prof-actions-td";

      const actionsWrap = document.createElement("div");
      actionsWrap.className = "prof-actions-cell";

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn ghost btn-prof-edit";
      btnEdit.textContent = "Editar";
      btnEdit.addEventListener("click", () => openEditGastoModal(gasto));
      actionsWrap.appendChild(btnEdit);

      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "btn ghost btn-prof-toggle btn-gasto-delete";
      btnDelete.textContent = "Eliminar";
      btnDelete.addEventListener("click", () => handleDeleteGasto(gasto));
      actionsWrap.appendChild(btnDelete);

      tdActions.appendChild(actionsWrap);

      tr.append(tdConcepto, tdFecha, tdEur, tdUsd, tdArs, tdActions);
      return tr;
    })
  );
}

function openCreateGastoModal() {
  currentEditingGasto = null;
  if (modalGastoTitle) modalGastoTitle.textContent = "Nuevo Gasto";
  if (inputGastoId) inputGastoId.value = "";
  if (inputGastoConcepto) inputGastoConcepto.value = "";
  if (inputGastoDetalle) inputGastoDetalle.value = "";
  const today = new Date().toISOString().split("T")[0];
  if (inputGastoFecha) inputGastoFecha.value = today;
  if (inputGastoMonto) inputGastoMonto.value = "";
  if (selectGastoMoneda) selectGastoMoneda.value = "EUR";
  if (inputGastoMontoEur) inputGastoMontoEur.value = "";
  if (inputGastoMontoUsd) inputGastoMontoUsd.value = "";
  if (inputGastoMontoArs) inputGastoMontoArs.value = "";

  fetchRatesForDate(today, false);

  if (modalGastoEl) modalGastoEl.hidden = false;
  inputGastoConcepto?.focus();
}

function openEditGastoModal(gasto) {
  currentEditingGasto = gasto;
  if (modalGastoTitle) modalGastoTitle.textContent = "Editar Gasto";
  if (inputGastoId) inputGastoId.value = gasto.id || "";
  if (inputGastoConcepto) inputGastoConcepto.value = gasto.concepto || "";
  if (inputGastoDetalle) inputGastoDetalle.value = gasto.detalle || "";
  if (inputGastoFecha) inputGastoFecha.value = gasto.fecha || "";
  if (inputGastoMonto) inputGastoMonto.value = gasto.monto != null ? String(gasto.monto) : "";
  const mon = (gasto.moneda || "EUR").toUpperCase();
  if (selectGastoMoneda) selectGastoMoneda.value = mon;

  const { eur, usd, ars, tcEurUsd, tcEurArs } = getRecordDailyAmounts(gasto);
  modalCurrentRates = { eurUsd: tcEurUsd, eurArs: tcEurArs };
  updateModalTcStatus(gasto.fecha, false);

  if (inputGastoMontoEur) {
    inputGastoMontoEur.value = eur.toFixed(2);
    inputGastoMontoEur.readOnly = mon === "EUR";
  }
  if (inputGastoMontoUsd) {
    inputGastoMontoUsd.value = usd.toFixed(2);
    inputGastoMontoUsd.readOnly = mon === "USD";
  }
  if (inputGastoMontoArs) {
    inputGastoMontoArs.value = ars.toFixed(2);
    inputGastoMontoArs.readOnly = mon === "ARS";
  }

  if (modalGastoEl) modalGastoEl.hidden = false;
  inputGastoConcepto?.focus();
}

function closeGastoModal() {
  if (modalGastoEl) modalGastoEl.hidden = true;
  currentEditingGasto = null;
}

async function handleSaveGasto(e) {
  e.preventDefault();
  const concepto = inputGastoConcepto?.value?.trim() || "";
  const detalle = inputGastoDetalle?.value?.trim() || "";
  const fecha = inputGastoFecha?.value?.trim() || "";
  const monto = parseFloat(inputGastoMonto?.value || "0");
  const moneda = (selectGastoMoneda?.value || "EUR").toUpperCase();
  const montoEur = parseFloat(inputGastoMontoEur?.value || "0");
  const montoUsd = parseFloat(inputGastoMontoUsd?.value || "0");
  const montoArs = parseFloat(inputGastoMontoArs?.value || "0");

  if (!concepto) {
    dialogAlert("Completá el concepto o servicio del gasto.");
    return;
  }
  if (!fecha) {
    dialogAlert("Seleccioná la fecha de pago.");
    return;
  }
  if (isNaN(monto) || monto <= 0) {
    dialogAlert("Ingresá un monto válido mayor a 0.");
    return;
  }
  if (!(montoEur > 0) || !(montoUsd > 0) || !(montoArs > 0)) {
    dialogAlert("Verificá que los valores equivalentes en las 3 monedas (EUR, USD y ARS) sean mayores a 0.");
    return;
  }

  const tcEurUsd = Math.round((montoUsd / montoEur) * 10000) / 10000;
  const tcEurArs = Math.round((montoArs / montoEur) * 100) / 100;

  const payloadFields = {
    concepto,
    detalle,
    fecha,
    monto,
    moneda,
    monto_eur: montoEur,
    monto_usd: montoUsd,
    monto_ars: montoArs,
    tc_eur_usd: tcEurUsd,
    tc_eur_ars: tcEurArs,
  };

  btnSaveGastoModal.disabled = true;
  try {
    if (currentEditingGasto) {
      try {
        await api("gastos.php", {
          method: "POST",
          body: JSON.stringify({
            action: "update",
            id: currentEditingGasto.id,
            ...payloadFields,
          }),
        });
      } catch (_err) {
        const idx = cachedGastos.findIndex((g) => g.id === currentEditingGasto.id);
        if (idx !== -1) {
          cachedGastos[idx] = {
            ...cachedGastos[idx],
            ...payloadFields,
          };
        }
      }
      dialogAlert("Gasto actualizado con sus equivalencias del día.");
    } else {
      try {
        await api("gastos.php", {
          method: "POST",
          body: JSON.stringify({
            action: "create",
            ...payloadFields,
          }),
        });
      } catch (_err) {
        const newLocalGasto = {
          id: "gasto_" + Date.now(),
          ...payloadFields,
        };
        cachedGastos.unshift(newLocalGasto);
      }
      dialogAlert("Gasto registrado con sus equivalencias del día.");
    }
    closeGastoModal();
    await loadGastosData();
  } catch (err) {
    dialogAlert("Error al guardar gasto: " + (err.message || "Error desconocido"));
  } finally {
    btnSaveGastoModal.disabled = false;
  }
}

async function handleDeleteGasto(gasto) {
  const formattedAmount = formatMoney(gasto.monto, gasto.moneda || "EUR");
  const ok = await dialogConfirm(
    `¿Estás seguro de eliminar el gasto "${escapeHtml(gasto.concepto)}" por ${formattedAmount}?`
  );
  if (!ok) return;

  try {
    try {
      await api("gastos.php", {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          id: gasto.id,
        }),
      });
    } catch (_err) {
      cachedGastos = cachedGastos.filter((g) => g.id !== gasto.id);
    }
    dialogAlert("Gasto eliminado exitosamente.");
    await loadGastosData();
  } catch (err) {
    dialogAlert("Error al eliminar gasto: " + (err.message || "Error desconocido"));
  }
}

export function initAdminModule() {
  btnNuevoProf?.addEventListener("click", openCreateModal);
  btnCloseModal?.addEventListener("click", closeModal);
  btnCancelModal?.addEventListener("click", closeModal);
  formEl?.addEventListener("submit", handleSaveProfessional);

  btnNuevoGasto?.addEventListener("click", openCreateGastoModal);
  btnCloseGastoModal?.addEventListener("click", closeGastoModal);
  btnCancelGastoModal?.addEventListener("click", closeGastoModal);
  formGastoEl?.addEventListener("submit", handleSaveGasto);

  inputGastoMonto?.addEventListener("input", recalcModalCurrencies);
  selectGastoMoneda?.addEventListener("change", recalcModalCurrencies);
  inputGastoFecha?.addEventListener("change", (e) => {
    fetchRatesForDate(e.target.value, false);
  });
  btnFetchFechaTc?.addEventListener("click", () => {
    fetchRatesForDate(inputGastoFecha?.value || "", true);
  });

  // Cerrar al hacer clic en el backdrop
  modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      closeModal();
    }
  });

  modalGastoEl?.addEventListener("click", (e) => {
    if (e.target === modalGastoEl) {
      closeGastoModal();
    }
  });

  // Tecla Escape para cerrar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modalEl && !modalEl.hidden) {
        closeModal();
      }
      if (modalGastoEl && !modalGastoEl.hidden) {
        closeGastoModal();
      }
    }
  });
}
