import { api } from "./api.js?v=79";
import { escapeHtml, dialogAlert, dialogConfirm, toast } from "./dom.js?v=79";
import { closeProfModal } from "./admin-profesionales-modals.js";
import { openDetailModal } from "./admin-profesionales-detail.js";
import {
  inputFirstName,
  inputLastName,
  inputEmail,
  inputTelefono,
  selectRole,
  btnSaveModal,
  getCurrentEditingUser,
  getCurrentDetailUser,
} from "./admin-profesionales-state.js";

export async function handleSaveProfessional(e, onReload) {
  if (e) e.preventDefault();
  const firstName = inputFirstName?.value?.trim() || "";
  const lastName = inputLastName?.value?.trim() || "";
  const email = inputEmail?.value?.trim() || "";
  const telefono = inputTelefono?.value?.trim() || "";
  const role = selectRole?.value || "professional";
  const currentEditingUser = getCurrentEditingUser();

  if (!firstName || !lastName) {
    dialogAlert("Completá el Nombre y el Apellido.");
    return;
  }
  if (!email || !email.includes("@")) {
    dialogAlert("Ingresá un correo electrónico válido.");
    return;
  }

  if (btnSaveModal) btnSaveModal.disabled = true;
  try {
    let updatedUser = null;
    if (currentEditingUser) {
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
      toast(res.message || "Profesional actualizado correctamente.", { type: "success" });
      updatedUser = res.user || {
        ...currentEditingUser,
        name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
        email,
        telefono,
        role,
      };
    } else {
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
      toast(res.message || "Usuario dado de alta. Se envió el link a su correo.", { type: "success" });
    }
    closeProfModal();
    if (typeof onReload === "function") await onReload();
    if (updatedUser) {
      openDetailModal(updatedUser);
    }
  } catch (err) {
    dialogAlert("Error al guardar: " + (err.message || "Error desconocido"), { type: "danger" });
  } finally {
    if (btnSaveModal) btnSaveModal.disabled = false;
  }
}

export async function handleToggleActive(prof, onReload) {
  const isActivating = !prof.active;
  const msg = isActivating
    ? `¿Deseás reactivar la cuenta de ${escapeHtml(prof.name)}? Volverá a tener acceso y aparecerá en las turneras y notificaciones.`
    : `¿Deseás dar de baja temporalmente a ${escapeHtml(prof.name)}? Su sesión quedará bloqueada y no podrá ingresar al sistema hasta que lo reactives.`;

  const ok = await dialogConfirm(msg);
  if (!ok) return;

  try {
    const res = await api("profesionales.php", {
      method: "POST",
      body: JSON.stringify({
        action: "toggle_active",
        username: prof.username,
        active: isActivating ? 1 : 0,
      }),
    });
    toast(res.message || (isActivating ? "Cuenta reactivada." : "Cuenta dada de baja."), { type: "success" });
    prof.active = isActivating ? 1 : 0;
    if (typeof onReload === "function") await onReload();
    const currentDetailUser = getCurrentDetailUser();
    if (currentDetailUser && currentDetailUser.username === prof.username) {
      openDetailModal(prof);
    }
  } catch (err) {
    dialogAlert("Error al modificar estado: " + (err.message || "Error desconocido"), { type: "danger" });
  }
}

export async function handleResendInvite(prof) {
  const ok = await dialogConfirm(
    `¿Deseás reenviar el correo de acceso a ${escapeHtml(prof.name)} (${escapeHtml(prof.email)})? Recibirá un enlace seguro para crear su contraseña.`
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
    toast(res.message || "Se envió el correo de acceso.", { type: "success" });
  } catch (err) {
    dialogAlert("Error al enviar el acceso: " + (err.message || "Error desconocido"), { type: "danger" });
  }
}
