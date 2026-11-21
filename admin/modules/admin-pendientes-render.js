/**
 * Kinésica Admin — Renderizado y Drag & Drop de Tareas Pendientes
 */

import { formatDate } from "./api.js?v=79";
import { escapeHtml } from "./dom.js?v=79";

let draggedId = null;

function priorityClass(p) {
  if (p === 1) return "priority-p1";
  if (p === 2) return "priority-p2";
  if (p === 3) return "priority-p3";
  return "priority-default";
}

export function setupPendientesDragAndDrop(tbody, onReorder) {
  if (!tbody || tbody._dndInit) return;
  tbody._dndInit = true;

  tbody.addEventListener("dragstart", (e) => {
    if (e.target.closest("button, a, input, select, textarea")) {
      e.preventDefault();
      return;
    }
    const tr = e.target.closest("tr.is-draggable");
    if (!tr) return;
    draggedId = tr.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedId);
    tr.classList.add("is-dragging");
  });

  tbody.addEventListener("dragover", (e) => {
    const tr = e.target.closest("tr.is-draggable");
    if (!tr || !draggedId || tr.dataset.id === draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    tr.classList.add("is-drag-over");
  });

  tbody.addEventListener("dragleave", (e) => {
    const tr = e.target.closest("tr.is-draggable");
    if (tr) tr.classList.remove("is-drag-over");
  });

  tbody.addEventListener("dragend", () => {
    draggedId = null;
    tbody.querySelectorAll("tr").forEach((el) => el.classList.remove("is-dragging", "is-drag-over"));
  });

  tbody.addEventListener("drop", (e) => {
    e.preventDefault();
    const tr = e.target.closest("tr.is-draggable");
    tbody.querySelectorAll("tr").forEach((el) => el.classList.remove("is-dragging", "is-drag-over"));
    if (!tr || !draggedId || tr.dataset.id === draggedId) return;
    const src = draggedId;
    draggedId = null;
    if (typeof onReorder === "function") {
      onReorder(src, tr.dataset.id);
    }
  });
}

export function renderPendientesRows(filtered, { onToggle, onMovePriority }) {
  const pendingItems = filtered.filter((i) => i.estado !== "resuelto");

  return filtered.map((item) => {
    const tr = document.createElement("tr");
    const isResuelto = item.estado === "resuelto";
    tr.dataset.id = item.id;
    tr.className = `admin-pendiente-row${isResuelto ? " error-row-resolved" : " is-draggable"}`;
    if (!isResuelto) {
      tr.draggable = true;
    }

    const pendingIdx = pendingItems.findIndex((p) => p.id === item.id);
    const isFirst = pendingIdx === 0;
    const isLast = pendingIdx === pendingItems.length - 1;

    // 1. Columna Prioridad (Drag handle + Badge + Flechas)
    const tdPrioridad = document.createElement("td");
    tdPrioridad.className = "pendiente-priority-cell";

    if (isResuelto) {
      tdPrioridad.innerHTML = `
        <div class="pendiente-priority-wrap">
          <span class="pendiente-priority-badge priority-resolved" title="Tarea resuelta">✓</span>
        </div>`;
    } else {
      const pNum = Number(item.prioridad) || (pendingIdx + 1);
      const pCls = priorityClass(pNum);
      const wrap = document.createElement("div");
      wrap.className = "pendiente-priority-wrap";
      wrap.innerHTML = `
        <span class="pendiente-drag-handle" title="Arrastrar para reordenar prioridad (Drag & drop)">⋮⋮</span>
        <span class="pendiente-priority-badge ${pCls}" title="Índice de prioridad #${pNum}">#${pNum}</span>
      `;

      const arrows = document.createElement("div");
      arrows.className = "pendiente-priority-arrows";

      const btnUp = document.createElement("button");
      btnUp.type = "button";
      btnUp.className = "btn-priority-arrow btn-priority-up";
      btnUp.disabled = isFirst;
      btnUp.title = "Subir prioridad";
      btnUp.textContent = "▲";
      btnUp.addEventListener("click", (e) => {
        e.stopPropagation();
        onMovePriority?.(item.id, "up");
      });

      const btnDown = document.createElement("button");
      btnDown.type = "button";
      btnDown.className = "btn-priority-arrow btn-priority-down";
      btnDown.disabled = isLast;
      btnDown.title = "Bajar prioridad";
      btnDown.textContent = "▼";
      btnDown.addEventListener("click", (e) => {
        e.stopPropagation();
        onMovePriority?.(item.id, "down");
      });

      arrows.append(btnUp, btnDown);
      wrap.appendChild(arrows);
      tdPrioridad.appendChild(wrap);
    }

    // 2. Columna Estado
    const tdEstado = document.createElement("td");
    tdEstado.innerHTML = isResuelto
      ? '<span class="error-badge badge-resolved">✓ Resuelto</span>'
      : '<span class="error-badge badge-pending">⚡ Pendiente</span>';

    // 3. Columna Tarea
    const tdTitulo = document.createElement("td");
    tdTitulo.innerHTML = `
      <div class="error-info-title">${escapeHtml(item.titulo || "")}</div>
      <div class="error-info-sub">${
        isResuelto && item.resolved_at
          ? `Resuelto por <strong>${escapeHtml(item.resolved_by || "admin")}</strong> el ${escapeHtml(formatDate(String(item.resolved_at).slice(0, 10)))}`
          : `Prioridad #${item.prioridad || (pendingIdx + 1)} · Tarea administrativa`
      }</div>
    `;

    // 4. Columna Acciones
    const tdActions = document.createElement("td");
    tdActions.className = "prof-actions-td";
    const cell = document.createElement("div");
    cell.className = "prof-actions-cell";

    const btnToggle = document.createElement("button");
    btnToggle.type = "button";
    btnToggle.className = `btn ghost btn-sm ${isResuelto ? "btn-reopen" : "btn-resolve"}`;
    btnToggle.textContent = isResuelto ? "Reabrir" : "Marcar resuelto";
    btnToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      onToggle?.(item);
    });
    cell.appendChild(btnToggle);
    tdActions.appendChild(cell);

    tr.append(tdPrioridad, tdEstado, tdTitulo, tdActions);
    return tr;
  });
}
