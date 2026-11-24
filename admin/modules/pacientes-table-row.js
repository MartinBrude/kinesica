/**
 * Kinésica Admin - Construcción de filas y encabezados de sección de la tabla de pacientes.
 */

import { escapeHtml } from "./dom.js?v=79";
import { formatDisplayPhone, capitalizePersonName } from "./pacientes-format.js";
import { getSessionUser } from "./auth.js?v=83";
import { formatPatientName } from "./pacientes-name.js?v=4";
import {
  getPatientFirstName,
  buildReviewInviteMessage,
  patientEncuestaEnviada,
  patientHasReview,
} from "./pacientes-patient-meta.js?v=3";
import { patientMissingPhone } from "./pacientes-identifiers.js";

export function createPacientesSectionHeader(title, count, { accent = false } = {}) {
  const tr = document.createElement("tr");
  tr.className = `pacientes-section-row${accent ? " is-missing-phone" : ""}`;
  tr.setAttribute("role", "rowheader");
  const td = document.createElement("td");
  td.colSpan = 6;
  td.innerHTML = `
    <span class="pacientes-section-title">${escapeHtml(title)}</span>
    <span class="pacientes-section-meta">${count} paciente${count === 1 ? "" : "s"}</span>
  `;
  tr.append(td);
  return tr;
}

export function buildPacienteRow(p) {
  const tr = document.createElement("tr");
  const formattedName = formatPatientName(p);
  const displayName = formattedName.display;
  const fullNameForConfirm = capitalizePersonName(
    p.nombre_completo || [formattedName.nombre, formattedName.apellido].filter(Boolean).join(" ") || displayName
  );

  const contactBadge = (p.contacto_nombre || p.contacto_telefono)
    ? `<div style="font-size: 11px; color: #475569; margin-top: 3px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block;">
         👤 Contacto / Agendó: <strong>${escapeHtml(capitalizePersonName(p.contacto_nombre) || "Familiar")}</strong>${p.contacto_telefono ? ` (${escapeHtml(formatDisplayPhone(p.contacto_telefono))})` : ""}${p.contacto_notas ? ` • ${escapeHtml(p.contacto_notas)}` : ""}
       </div>`
    : "";

  const rawTel = p.telefono || "";
  const isSinTel = patientMissingPhone(p);
  const cleanDigits = isSinTel ? "" : String(rawTel).replace(/\D/g, "");
  const waLink = cleanDigits ? `https://wa.me/${cleanDigits}` : "#";
  const displayTel = isSinTel ? "" : formatDisplayPhone(rawTel);

  const hasReview = patientHasReview(p);
  const encuestaEnviada = patientEncuestaEnviada(p);
  const firstName = getPatientFirstName(p);
  const hasLoadedName = Boolean(firstName);
  const reviewMsg = buildReviewInviteMessage(p);
  const waReviewLink = (cleanDigits && hasLoadedName) ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(reviewMsg)}` : "#";

  const disabledActionStyle = "opacity:0.45; cursor:not-allowed; pointer-events:none; gap:4px; font-size:12px; padding:4px 9px;";

  const reviewAction = hasReview
    ? `<span class="badge-review-ok" title="Ya dejó una reseña en Google" style="display:inline-flex; align-items:center; gap:4px; font-size:11.5px; padding:3px 8px; border-radius:6px; background:#fef9c3; color:#854d0e; font-weight:600; border:1px solid #fde047;">
         <span aria-hidden="true">⭐</span> Con review
       </span>`
    : (cleanDigits && hasLoadedName
        ? `<a class="btn light btn-review-invite" href="${waReviewLink}" target="_blank" rel="noopener" title="Enviar WhatsApp a ${escapeHtml(firstName)} invitándole a dejar una reseña en Google" style="color:#0f766e; border-color:#99f6e4; background:#f0fdfa; gap:4px; font-size:12px; padding:4px 9px; font-weight:600; text-decoration:none;">
             <span aria-hidden="true">⭐</span><span>Pedir review</span>
           </a>`
        : `<span class="btn light is-disabled" aria-disabled="true" title="${!hasLoadedName ? "El nombre del paciente debe estar cargado para pedirle review" : "Sin teléfono para WhatsApp"}" style="${disabledActionStyle}">
             <span aria-hidden="true">⭐</span><span>Pedir review</span>
           </span>`);

  const isColaborador = getSessionUser()?.role === "colaborador";

  let encuestaAction;
  if (encuestaEnviada) {
    encuestaAction = `<span class="badge-encuesta-ok" title="Clara ya envió la invitación a la encuesta" style="display:inline-flex; align-items:center; gap:4px; font-size:11.5px; padding:3px 8px; border-radius:6px; background:#eef2ff; color:#3730a3; font-weight:600; border:1px solid #c7d2fe;">
         <span aria-hidden="true">📋</span> Encuesta enviada
       </span>`;
  } else if (isColaborador) {
    encuestaAction = `<span class="btn light is-disabled" aria-disabled="true" title="Los colaboradores no pueden disparar envíos de Clara" style="${disabledActionStyle}">
         <span aria-hidden="true">📋</span><span>Pedir encuesta</span>
       </span>`;
  } else if (cleanDigits && hasLoadedName) {
    encuestaAction = `<button type="button" class="btn light btn-encuesta-invite" data-id="${p.id}" data-name="${escapeHtml(firstName)}" title="Que Clara envíe por WhatsApp la invitación a la breve encuesta" style="color:#4338ca; border-color:#c7d2fe; background:#eef2ff; gap:4px; font-size:12px; padding:4px 9px; font-weight:600;">
         <span aria-hidden="true">📋</span><span>Pedir encuesta</span>
       </button>`;
  } else {
    encuestaAction = `<span class="btn light is-disabled" aria-disabled="true" title="${!hasLoadedName ? "El nombre del paciente debe estar cargado para pedirle la encuesta" : "Sin teléfono para WhatsApp"}" style="${disabledActionStyle}">
         <span aria-hidden="true">📋</span><span>Pedir encuesta</span>
       </span>`;
  }

  const deleteBtn = isColaborador
    ? ""
    : `<button type="button" class="btn ghost btn-delete-paciente btn-icon-del" data-id="${p.id}" data-name="${escapeHtml(fullNameForConfirm)}" title="Eliminar paciente" aria-label="Eliminar paciente">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>`;

  tr.innerHTML = `
    <td><strong style="color: var(--navy);">${escapeHtml(displayName)}</strong>${contactBadge}</td>
    <td><div class="phone-cell">${cleanDigits ? `<a class="phone-link" href="${waLink}" target="_blank" rel="noopener" title="Abrir chat de WhatsApp (${escapeHtml(displayTel)})">WhatsApp</a>` : '<span class="badge-sin-tel" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:2px 7px; border-radius:5px; background:#fef2f2; color:#b91c1c; font-weight:600; border:1px solid #fecaca;"><span aria-hidden="true">⚠️</span> Sin teléfono</span>'}</div></td>
    <td>${p.email ? `<a class="email-link" href="mailto:${escapeHtml(p.email)}" title="Enviar correo a ${escapeHtml(p.email)}">Email</a>` : '<span style="color:var(--muted)">—</span>'}</td>
    <td><span class="badge-prof ${escapeHtml(p.profesional_habitual || "indistinto")}">${escapeHtml(p.profesional_habitual || "indistinto")}</span></td>
    <td><small>${p.motivo_consulta ? escapeHtml(p.motivo_consulta) : "—"}</small></td>
    <td style="text-align: right;">
      <div class="pacientes-actions">
        ${reviewAction}
        ${encuestaAction}
        <button type="button" class="btn light btn-edit-paciente" data-id="${p.id}" title="${isColaborador ? "Ver datos del paciente" : "Editar paciente"}">${isColaborador ? "Ver datos" : "Editar"}</button>
        ${!isColaborador ? `<button type="button" class="btn light btn-merge-paciente" data-id="${p.id}" title="Unificar o fusionar con otra ficha" style="color: #0369a1; border-color: #bae6fd; background: #f0f9ff; gap: 4px; font-size: 12px; padding: 4px 9px; font-weight: 600;"><span aria-hidden="true">🔄</span><span>Unificar</span></button>` : ""}
        ${deleteBtn}
      </div>
    </td>
  `;
  return tr;
}
