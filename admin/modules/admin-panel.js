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
const gastosSumaTotal = document.querySelector("#admin-gastos-suma-total");
const gastosTfootTotal = document.querySelector("#admin-gastos-tfoot-total");
const gastosCountLabel = document.querySelector("#admin-gastos-count-label");
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
const btnCloseGastoModal = document.querySelector("#admin-gasto-modal-close");
const btnCancelGastoModal = document.querySelector("#admin-gasto-modal-cancel");
const btnSaveGastoModal = document.querySelector("#admin-gasto-modal-save");

let currentEditingUser = null;
let cachedProfesionales = [];

let currentEditingGasto = null;
let cachedGastos = [];

const SEED_GASTOS = [
  {
    id: "gasto_1",
    concepto: "AI automation apps",
    detalle: "",
    fecha: "2026-10-25",
    monto: 148.09,
    moneda: "EUR",
  },
  {
    id: "gasto_2",
    concepto: "AI automation apps",
    detalle: "",
    fecha: "2026-09-26",
    monto: 8.99,
    moneda: "EUR",
  },
  {
    id: "gasto_3",
    concepto: "Business Web Hosting",
    detalle: "kinesica.com.ar",
    fecha: "2026-02-03",
    monto: 65.88,
    moneda: "EUR",
  },
  {
    id: "gasto_4",
    concepto: "Premium Web Hosting",
    detalle: "kinesica.com.ar",
    fecha: "2025-03-28",
    monto: 35.88,
    moneda: "EUR",
  },
];

function formatCurrency(amount, currency = "EUR") {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (currency === "EUR") {
    return `${formatted} €`;
  }
  const sym = currency === "USD" ? "USD" : "$";
  return `${sym} ${formatted}`;
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

function renderGastos(gastos) {
  let total = 0;
  for (const g of gastos) {
    total += Number(g.monto) || 0;
  }
  const totalFormatted = formatCurrency(total, "EUR");
  if (gastosSumaTotal) gastosSumaTotal.textContent = totalFormatted;
  if (gastosTfootTotal) gastosTfootTotal.textContent = totalFormatted;
  if (gastosCountLabel) {
    gastosCountLabel.textContent = `${gastos.length} gasto${gastos.length === 1 ? "" : "s"} registrado${gastos.length === 1 ? "" : "s"}`;
  }

  if (!gastosTableBody) return;

  if (gastos.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
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

      // Servicio / Concepto
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

      // Pagado el (Fecha)
      const tdFecha = document.createElement("td");
      tdFecha.textContent = gasto.fecha || "—";

      // Cantidad (Monto)
      const tdMonto = document.createElement("td");
      tdMonto.style.textAlign = "right";
      tdMonto.textContent = formatCurrency(gasto.monto, gasto.moneda || "EUR");

      // Acciones (Editar, Eliminar)
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

      tr.append(tdConcepto, tdFecha, tdMonto, tdActions);
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
  if (inputGastoFecha) {
    inputGastoFecha.value = new Date().toISOString().split("T")[0];
  }
  if (inputGastoMonto) inputGastoMonto.value = "";
  if (selectGastoMoneda) selectGastoMoneda.value = "EUR";

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
  const formattedAmount = formatCurrency(gasto.monto, gasto.moneda || "EUR");
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
