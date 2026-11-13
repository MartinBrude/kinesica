/** Estado y referencias DOM — gestión de profesionales. */

export const profTableBody = document.querySelector("#admin-prof-tbody");
export const btnNuevoProf = document.querySelector("#admin-btn-nuevo-prof");
export const modalEl = document.querySelector("#admin-prof-modal");
export const modalTitle = document.querySelector("#admin-prof-modal-title");
export const formEl = document.querySelector("#admin-prof-form");
export const inputUsername = document.querySelector("#admin-prof-username");
export const inputFirstName = document.querySelector("#admin-prof-firstname");
export const inputLastName = document.querySelector("#admin-prof-lastname");
export const inputEmail = document.querySelector("#admin-prof-email");
export const inputTelefono = document.querySelector("#admin-prof-telefono");
export const selectRole = document.querySelector("#admin-prof-role");
export const btnCloseModal = document.querySelector("#admin-prof-modal-close");
export const btnCancelModal = document.querySelector("#admin-prof-modal-cancel");
export const btnSaveModal = document.querySelector("#admin-prof-modal-save");

export const detailModalEl = document.querySelector("#admin-prof-detail-modal");
export const detailCloseBtn = document.querySelector("#admin-prof-detail-close");
export const detailModalCloseBtn = document.querySelector("#admin-prof-detail-modal-close");
export const detailBtnEdit = document.querySelector("#admin-prof-detail-btn-edit");
export const detailBtnInvite = document.querySelector("#admin-prof-detail-btn-invite");
export const detailBtnToggle = document.querySelector("#admin-prof-detail-btn-toggle");

export const detailAvatar = document.querySelector("#admin-prof-detail-avatar");
export const detailName = document.querySelector("#admin-prof-detail-name");
export const detailUsername = document.querySelector("#admin-prof-detail-username");
export const detailRoleBadge = document.querySelector("#admin-prof-detail-role-badge");
export const detailStatusBadge = document.querySelector("#admin-prof-detail-status-badge");
export const detailEmail = document.querySelector("#admin-prof-detail-email");
export const detailEmailLink = document.querySelector("#admin-prof-detail-email-link");
export const detailCopyEmailBtn = document.querySelector("#admin-prof-detail-copy-email");
export const detailPhone = document.querySelector("#admin-prof-detail-phone");
export const detailPhoneLink = document.querySelector("#admin-prof-detail-phone-link");
export const detailWaBtn = document.querySelector("#admin-prof-detail-wa-btn");
export const detailRoleDesc = document.querySelector("#admin-prof-detail-role-desc");
export const detailTotp = document.querySelector("#admin-prof-detail-totp");
export const detailLogins = document.querySelector("#admin-prof-detail-logins");

let currentEditingUser = null;
let currentDetailUser = null;
let cachedProfesionales = [];
let reloadCallback = null;

export function getCurrentEditingUser() { return currentEditingUser; }
export function setCurrentEditingUser(user) { currentEditingUser = user; }

export function getCurrentDetailUser() { return currentDetailUser; }
export function setCurrentDetailUser(user) { currentDetailUser = user; }

export function getCachedProfesionales() { return cachedProfesionales; }
export function setCachedProfesionales(list) { cachedProfesionales = Array.isArray(list) ? list : []; }

/** True si este usuario es el único admin activo (protección last-admin, sin hardcode de nombres). */
export function isSoleActiveAdmin(prof) {
  if (!prof || prof.role !== "admin" || !prof.active) return false;
  const others = cachedProfesionales.filter(
    (p) => p.role === "admin" && p.active && p.username !== prof.username
  );
  return others.length === 0;
}

export function getReloadCallback() { return reloadCallback; }
export function setReloadCallback(fn) { reloadCallback = fn; }
