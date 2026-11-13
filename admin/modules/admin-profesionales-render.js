import { getInitials, getAvatarColor } from "./admin-profesionales-avatar.js";
import { openDetailModal } from "./admin-profesionales-detail.js";
import { profTableBody, setReloadCallback } from "./admin-profesionales-state.js";

export function renderProfesionales(profesionales, onReload) {
  if (!profTableBody) return;
  setReloadCallback(onReload);
  profTableBody.replaceChildren(
    ...profesionales.map((prof) => {
      const tr = document.createElement("tr");
      if (!prof.active) tr.className = "is-inactive";
      tr.title = "Hacé clic en la fila para ver la ficha detallada";
      tr.addEventListener("click", () => openDetailModal(prof));

      const tdName = document.createElement("td");
      const userCell = document.createElement("div");
      userCell.className = "prof-user-cell";

      const displayName = prof.name || prof.display_name || prof.username;
      const avatar = document.createElement("div");
      avatar.className = "prof-avatar";
      avatar.textContent = getInitials(displayName);
      avatar.style.background = getAvatarColor(prof.username, displayName);

      const userMeta = document.createElement("div");
      userMeta.className = "prof-user-meta";

      const nameStrong = document.createElement("strong");
      nameStrong.className = "prof-name";
      nameStrong.textContent = displayName;

      const userSub = document.createElement("span");
      userSub.className = "prof-username";
      userSub.textContent = `@${prof.username}`;

      userMeta.append(nameStrong, userSub);
      userCell.append(avatar, userMeta);
      tdName.append(userCell);

      const tdRole = document.createElement("td");
      const roleBadge = document.createElement("span");
      let roleLabel = "Profesional";
      let roleClass = "professional";
      if (prof.role === "admin") {
        roleLabel = "Admin";
        roleClass = "admin";
      } else if (prof.role === "colaborador") {
        roleLabel = "Colaborador";
        roleClass = "colaborador";
      }
      roleBadge.className = `prof-role-badge ${roleClass}`;
      roleBadge.textContent = roleLabel;
      tdRole.append(roleBadge);

      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `prof-status-badge ${prof.active ? "active" : "inactive"}`;
      const statusDot = document.createElement("span");
      statusDot.className = "prof-status-dot";
      statusBadge.append(statusDot, document.createTextNode(prof.active ? "Activo" : "Inactivo"));
      tdStatus.append(statusBadge);

      const tdActions = document.createElement("td");
      tdActions.className = "prof-actions-td";
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "prof-actions-cell";

      const btnDetail = document.createElement("button");
      btnDetail.type = "button";
      btnDetail.className = "btn btn-prof-detail";
      btnDetail.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Ver detalle
      `;
      btnDetail.title = "Ver ficha y datos del profesional";
      btnDetail.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailModal(prof);
      });
      actionsWrap.append(btnDetail);

      tdActions.append(actionsWrap);
      tr.append(tdName, tdRole, tdStatus, tdActions);
      return tr;
    })
  );
}
