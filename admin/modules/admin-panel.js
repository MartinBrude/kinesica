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
const loginsContainer = document.querySelector("#admin-logins-container");
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
const gastosSubEur = document.querySelector("#admin-gastos-sub-eur");
const gastosTotalUsd = document.querySelector("#admin-gastos-total-usd");
const gastosSubUsd = document.querySelector("#admin-gastos-sub-usd");
const gastosTotalArs = document.querySelector("#admin-gastos-total-ars");
const gastosTotalConsolidado = document.querySelector("#admin-gastos-total-consolidado");
const gastosCountLabel = document.querySelector("#admin-gastos-count-label");
const inputRateEur = document.querySelector("#admin-rate-eur");
const inputRateUsd = document.querySelector("#admin-rate-usd");
const btnRefreshRates = document.querySelector("#admin-btn-refresh-rates");
const ratesUpdatedNote = document.querySelector("#admin-rates-updated-note");
const gastosTfootEur = document.querySelector("#admin-gastos-tfoot-eur");
const gastosTfootUsd = document.querySelector("#admin-gastos-tfoot-usd");
const gastosTfootArs = document.querySelector("#admin-gastos-tfoot-ars");
const gastosTfootTotalArs = document.querySelector("#admin-gastos-tfoot-total-ars");
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
const inputGastoTc = document.querySelector("#admin-gasto-tc");
const previewGastoArs = document.querySelector("#admin-gasto-preview-ars");
const btnCloseGastoModal = document.querySelector("#admin-gasto-modal-close");
const btnCancelGastoModal = document.querySelector("#admin-gasto-modal-cancel");
const btnSaveGastoModal = document.querySelector("#admin-gasto-modal-save");

let currentEditingUser = null;
let cachedProfesionales = [];

let currentEditingGasto = null;
let cachedGastos = [];

const exchangeRates = {
  EUR: 1450,
  USD: 1350,
  updatedAt: null,
};

try {
  const savedRates = localStorage.getItem("kinesica_gastos_rates");
  if (savedRates) {
    const parsed = JSON.parse(savedRates);
    if (parsed && typeof parsed === "object") {
      if (Number(parsed.EUR) > 0) exchangeRates.EUR = Number(parsed.EUR);
      if (Number(parsed.USD) > 0) exchangeRates.USD = Number(parsed.USD);
      if (parsed.updatedAt) exchangeRates.updatedAt = parsed.updatedAt;
    }
  }
} catch (_) {}

const SEED_GASTOS = [
  {
    id: "gasto_1",
    concepto: "AI automation apps",
    detalle: "",
    fecha: "2026-10-25",
    monto: 148.09,
    moneda: "EUR",
    tipo_cambio: null,
  },
  {
    id: "gasto_2",
    concepto: "AI automation apps",
    detalle: "",
    fecha: "2026-09-26",
    monto: 8.99,
    moneda: "EUR",
    tipo_cambio: null,
  },
  {
    id: "gasto_3",
    concepto: "Business Web Hosting",
    detalle: "kinesica.com.ar",
    fecha: "2026-02-03",
    monto: 65.88,
    moneda: "EUR",
    tipo_cambio: null,
  },
  {
    id: "gasto_4",
    concepto: "Premium Web Hosting",
    detalle: "kinesica.com.ar",
    fecha: "2025-03-28",
    monto: 35.88,
    moneda: "EUR",
    tipo_cambio: null,
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
    renderLogins(cachedProfesionales);
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

function renderLogins(profesionales) {
  if (!loginsContainer) return;
  loginsContainer.replaceChildren(
    ...profesionales.map((prof) => {
      const card = document.createElement("div");
      card.className = "login-stat-card";

      const name = document.createElement("span");
      name.className = "stat-name";
      name.textContent = prof.name || prof.username;

      const count = document.createElement("span");
      count.className = "stat-count";
      count.textContent = String(prof.login_count ?? 0);

      const role = document.createElement("span");
      role.className = "stat-role";
      role.textContent = prof.role === "admin" ? "Administrador" : "Profesional";

      card.append(name, count, role);
      return card;
    })
  );
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

function updateRatesUI() {
  if (inputRateEur) inputRateEur.value = String(exchangeRates.EUR);
  if (inputRateUsd) inputRateUsd.value = String(exchangeRates.USD);
  if (ratesUpdatedNote) {
    ratesUpdatedNote.textContent = exchangeRates.updatedAt
      ? `Cotización actualizada (${exchangeRates.updatedAt})`
      : "Cotización de referencia diaria";
  }
}

async function refreshDailyRates(notify = false) {
  try {
    const [resEur, resUsd] = await Promise.allSettled([
      fetch("https://dolarapi.com/v1/cotizaciones/eur").then((r) => r.json()),
      fetch("https://dolarapi.com/v1/dolares/tarjeta").then((r) => r.json()),
    ]);
    let updated = false;
    if (resEur.status === "fulfilled" && resEur.value && resEur.value.venta) {
      exchangeRates.EUR = Math.round(Number(resEur.value.venta));
      updated = true;
    }
    if (resUsd.status === "fulfilled" && resUsd.value && resUsd.value.venta) {
      exchangeRates.USD = Math.round(Number(resUsd.value.venta));
      updated = true;
    }
    if (updated) {
      exchangeRates.updatedAt = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      try {
        localStorage.setItem("kinesica_gastos_rates", JSON.stringify(exchangeRates));
      } catch (_) {}
      updateRatesUI();
      renderGastos(cachedGastos);
      if (notify) dialogAlert("Cotizaciones del día actualizadas correctamente.");
    } else if (notify) {
      dialogAlert("No se pudieron obtener cotizaciones en línea. Se mantienen los valores actuales.");
    }
  } catch (err) {
    if (notify) dialogAlert("Error al consultar cotizaciones: " + (err.message || "Sin conexión"));
  }
}

function getConvertedAmountInArs(gasto) {
  const monto = Number(gasto.monto) || 0;
  const moneda = (gasto.moneda || "EUR").toUpperCase();
  if (moneda === "ARS") {
    return { ars: monto, tc: 1 };
  }
  const customTc = Number(gasto.tipo_cambio);
  const tc = customTc > 0 ? customTc : (exchangeRates[moneda] || 1);
  return { ars: monto * tc, tc };
}

function renderGastos(gastos) {
  let subtotalEur = 0;
  let subtotalUsd = 0;
  let subtotalArs = 0;
  let totalConsolidadoArs = 0;

  for (const g of gastos) {
    const { ars } = getConvertedAmountInArs(g);
    totalConsolidadoArs += ars;
    const mon = (g.moneda || "EUR").toUpperCase();
    const val = Number(g.monto) || 0;
    if (mon === "EUR") subtotalEur += val;
    else if (mon === "USD") subtotalUsd += val;
    else subtotalArs += val;
  }

  // Actualizar Tarjetas KPI
  if (gastosTotalEur) gastosTotalEur.textContent = formatMoney(subtotalEur, "EUR");
  if (gastosSubEur) {
    gastosSubEur.textContent = subtotalEur > 0
      ? `≈ ${formatMoney(subtotalEur * exchangeRates.EUR, "ARS")} al cambio`
      : "Sin gastos en euros";
  }

  if (gastosTotalUsd) gastosTotalUsd.textContent = formatMoney(subtotalUsd, "USD");
  if (gastosSubUsd) {
    gastosSubUsd.textContent = subtotalUsd > 0
      ? `≈ ${formatMoney(subtotalUsd * exchangeRates.USD, "ARS")} al cambio`
      : "Sin gastos en dólares";
  }

  if (gastosTotalArs) gastosTotalArs.textContent = formatMoney(subtotalArs, "ARS");
  if (gastosTotalConsolidado) gastosTotalConsolidado.textContent = formatMoney(totalConsolidadoArs, "ARS");
  if (gastosCountLabel) {
    gastosCountLabel.textContent = `${gastos.length} gasto${gastos.length === 1 ? "" : "s"} registrado${gastos.length === 1 ? "" : "s"}`;
  }

  // Actualizar pie de tabla
  if (gastosTfootEur) gastosTfootEur.textContent = formatMoney(subtotalEur, "EUR");
  if (gastosTfootUsd) gastosTfootUsd.textContent = formatMoney(subtotalUsd, "USD");
  if (gastosTfootArs) gastosTfootArs.textContent = formatMoney(subtotalArs, "ARS");
  if (gastosTfootTotalArs) gastosTfootTotalArs.textContent = formatMoney(totalConsolidadoArs, "ARS");

  if (!gastosTableBody) return;

  if (gastos.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
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
      const { ars, tc } = getConvertedAmountInArs(gasto);

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

      // Columna 3: EUR (€)
      const tdEur = document.createElement("td");
      tdEur.className = "num-col";
      if (mon === "EUR") {
        tdEur.textContent = formatMoney(gasto.monto, "EUR");
      } else {
        const dash = document.createElement("span");
        dash.className = "gasto-none-dash";
        dash.textContent = "—";
        tdEur.appendChild(dash);
      }

      // Columna 4: USD ($)
      const tdUsd = document.createElement("td");
      tdUsd.className = "num-col";
      if (mon === "USD") {
        tdUsd.textContent = formatMoney(gasto.monto, "USD");
      } else {
        const dash = document.createElement("span");
        dash.className = "gasto-none-dash";
        dash.textContent = "—";
        tdUsd.appendChild(dash);
      }

      // Columna 5: ARS ($)
      const tdArs = document.createElement("td");
      tdArs.className = "num-col";
      if (mon === "ARS") {
        tdArs.textContent = formatMoney(gasto.monto, "ARS");
      } else {
        const dash = document.createElement("span");
        dash.className = "gasto-none-dash";
        dash.textContent = "—";
        tdArs.appendChild(dash);
      }

      // Columna 6: Al cambio (ARS)
      const tdEquivArs = document.createElement("td");
      tdEquivArs.className = "num-col";
      tdEquivArs.textContent = formatMoney(ars, "ARS");
      if (mon !== "ARS" && tc > 1) {
        const tcSub = document.createElement("span");
        tcSub.className = "gasto-tc-sub";
        tcSub.textContent = `TC: $ ${Math.round(tc).toLocaleString("es-AR")}`;
        tdEquivArs.appendChild(tcSub);
      }

      // Columna 7: Acciones (Editar, Eliminar)
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

      tr.append(tdConcepto, tdFecha, tdEur, tdUsd, tdArs, tdEquivArs, tdActions);
      return tr;
    })
  );
}

function updateModalPreview() {
  if (!previewGastoArs) return;
  const monto = parseFloat(inputGastoMonto?.value || "0");
  const moneda = selectGastoMoneda?.value || "EUR";
  const customTc = parseFloat(inputGastoTc?.value || "0");
  const tcGroup = document.querySelector("#admin-gasto-tc-group");

  if (moneda === "ARS") {
    if (tcGroup) tcGroup.style.opacity = "0.4";
    previewGastoArs.textContent = monto > 0
      ? `Gasto directo en moneda local: ${formatMoney(monto, "ARS")}`
      : "Gasto directo en moneda local.";
  } else {
    if (tcGroup) tcGroup.style.opacity = "1";
    const tcApplied = customTc > 0 ? customTc : (exchangeRates[moneda] || 1);
    const equiv = monto * tcApplied;
    previewGastoArs.textContent = monto > 0
      ? `Equivalente estimado: ${formatMoney(equiv, "ARS")} (TC aplicado: $ ${Math.round(tcApplied).toLocaleString("es-AR")} / ${moneda})`
      : `Se aplicará la cotización del día: 1 ${moneda} = $ ${Math.round(tcApplied).toLocaleString("es-AR")} ARS.`;
  }
}

function openCreateGastoModal() {
  currentEditingGasto = null;
  if (modalGastoTitle) modalGastoTitle.textContent = "Nuevo Gasto";
  if (inputGastoId) inputGastoId.value = "";
  if (inputGastoConcepto) inputGastoConcepto.value = "";
  if (inputGastoDetalle) inputGastoDetalle.value = "";
  if (inputGastoFecha) {
    inputGastoFecha.value = new Date().toISOString().split("T")[0];
  }
  if (inputGastoMonto) inputGastoMonto.value = "";
  if (selectGastoMoneda) selectGastoMoneda.value = "EUR";
  if (inputGastoTc) inputGastoTc.value = "";
  updateModalPreview();

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
  if (selectGastoMoneda) selectGastoMoneda.value = gasto.moneda || "EUR";
  if (inputGastoTc) inputGastoTc.value = gasto.tipo_cambio ? String(gasto.tipo_cambio) : "";
  updateModalPreview();

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
  const moneda = selectGastoMoneda?.value || "EUR";
  const customTc = parseFloat(inputGastoTc?.value || "0");
  const tipoCambio = customTc > 0 ? customTc : null;

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

  btnSaveGastoModal.disabled = true;
  try {
    if (currentEditingGasto) {
      try {
        await api("gastos.php", {
          method: "POST",
          body: JSON.stringify({
            action: "update",
            id: currentEditingGasto.id,
            concepto,
            detalle,
            fecha,
            monto,
            moneda,
            tipo_cambio: tipoCambio,
          }),
        });
      } catch (_err) {
        const idx = cachedGastos.findIndex((g) => g.id === currentEditingGasto.id);
        if (idx !== -1) {
          cachedGastos[idx] = {
            ...cachedGastos[idx],
            concepto,
            detalle,
            fecha,
            monto,
            moneda,
            tipo_cambio: tipoCambio,
          };
        }
      }
      dialogAlert("Gasto actualizado correctamente.");
    } else {
      try {
        await api("gastos.php", {
          method: "POST",
          body: JSON.stringify({
            action: "create",
            concepto,
            detalle,
            fecha,
            monto,
            moneda,
            tipo_cambio: tipoCambio,
          }),
        });
      } catch (_err) {
        const newLocalGasto = {
          id: "gasto_" + Date.now(),
          concepto,
          detalle,
          fecha,
          monto,
          moneda,
          tipo_cambio: tipoCambio,
        };
        cachedGastos.unshift(newLocalGasto);
      }
      dialogAlert("Gasto registrado correctamente.");
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

  updateRatesUI();
  inputRateEur?.addEventListener("change", (e) => {
    const val = parseFloat(e.target.value);
    if (val > 0) {
      exchangeRates.EUR = val;
      try {
        localStorage.setItem("kinesica_gastos_rates", JSON.stringify(exchangeRates));
      } catch (_) {}
      renderGastos(cachedGastos);
    }
  });

  inputRateUsd?.addEventListener("change", (e) => {
    const val = parseFloat(e.target.value);
    if (val > 0) {
      exchangeRates.USD = val;
      try {
        localStorage.setItem("kinesica_gastos_rates", JSON.stringify(exchangeRates));
      } catch (_) {}
      renderGastos(cachedGastos);
    }
  });

  btnRefreshRates?.addEventListener("click", () => refreshDailyRates(true));

  inputGastoMonto?.addEventListener("input", updateModalPreview);
  selectGastoMoneda?.addEventListener("change", updateModalPreview);
  inputGastoTc?.addEventListener("input", updateModalPreview);

  // Intentar refrescar cotización en segundo plano al inicializar
  refreshDailyRates(false).catch(() => {});

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
