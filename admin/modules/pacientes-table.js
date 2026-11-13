import { api } from "./api.js?v=79";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=79";
import { phoneMatches } from "./phone-search.js?v=3";
import { formatDisplayPhone, capitalizePersonName } from "./pacientes-format.js";
import { openFullPacienteModal } from "./pacientes-modal.js?v=3";
import { getSessionUser } from "./auth.js?v=83";
import { invalidateDirectoryCache } from "./form-patient.js";
import {
  getPacientesCache,
  setPacientesCache,
  getActiveFilterProf,
  listEl,
  searchInput,
  countEl,
} from "./pacientes-state.js";
import { syncPacientesBadgeFromCache } from "./pacientes-badge.js";
import { formatPatientName } from "./pacientes-name.js";
import {
  getPatientFirstName,
  buildReviewInviteMessage,
  patientEncuestaEnviada,
  patientHasReview,
} from "./pacientes-patient-meta.js";
import { patientMissingPhone } from "./pacientes-identifiers.js";
import { loadPacientes } from "./pacientes-load.js";

function filterPacientes() {
  const query = (searchInput?.value || "").toLowerCase().trim();
  const normQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, " ").trim();
  const qTokens = normQuery.split(/\s+/).filter(Boolean);
  const pacientesCache = getPacientesCache();
  const activeFilterProf = getActiveFilterProf();

  const list = pacientesCache.filter((p) => {
    if (activeFilterProf !== "todos" && p.profesional_habitual !== activeFilterProf) return false;
    if (!query) return true;

    const rawPatientNames = `${p.nombre_completo || ""} ${p.apellido || ""} ${p.nombre || ""}`;
    const normPatient = rawPatientNames.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, " ");
    const tokenMatch = qTokens.length > 0 && qTokens.every((tok) => normPatient.includes(tok));

    const nameMatch = tokenMatch ||
                      (p.nombre_completo || "").toLowerCase().includes(query) ||
                      (p.nombre || "").toLowerCase().includes(query) ||
                      (p.apellido || "").toLowerCase().includes(query);
    const phoneMatch = (p.telefono || "").includes(query) || phoneMatches(p.telefono, query);
    const emailMatch = (p.email || "").toLowerCase().includes(query);
    const dniMatch = (p.dni || "").toLowerCase().includes(query);
    const motivoMatch = (p.motivo_consulta || "").toLowerCase().includes(query);
    const contactMatch = (p.contacto_nombre || "").toLowerCase().includes(query) ||
                         (p.contacto_telefono || "").includes(query) || phoneMatches(p.contacto_telefono, query) ||
                         (p.contacto_notas || "").toLowerCase().includes(query);
    const isSinTel = patientMissingPhone(p);
    const sinTelMatch = isSinTel && (
      query.includes("sin tel") ||
      query.includes("falta tel") ||
      query.includes("sin telefono") ||
      query.includes("sin teléfono") ||
      query === "sin"
    );
    return nameMatch || phoneMatch || emailMatch || dniMatch || motivoMatch || contactMatch || sinTelMatch;
  });

  list.sort((a, B) => {
    const nameA = formatPatientName(a);
    const nameB = formatPatientName(B);
    const cmpAp = nameA.apellido.localeCompare(nameB.apellido, "es", { sensitivity: "base" });
    if (cmpAp !== 0) return cmpAp;
    return nameA.nombre.localeCompare(nameB.nombre, "es", { sensitivity: "base" });
  });

  return list;
}

export function renderPacientesTable() {
  syncPacientesBadgeFromCache();
  if (!listEl) return;
  const filtered = filterPacientes();
  const pacientesCache = getPacientesCache();

  if (countEl) {
    countEl.textContent = `${filtered.length} paciente${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 32px; color: var(--muted);">No se encontraron pacientes que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach((p) => {
    const tr = document.createElement("tr");
    const formattedName = formatPatientName(p);
    const displayName = formattedName.display;
    const fullNameForConfirm = capitalizePersonName(p.nombre_completo || [formattedName.nombre, formattedName.apellido].filter(Boolean).join(" ") || displayName);

    const contactBadge = (p.contacto_nombre || p.contacto_telefono)
      ? `<div style="font-size: 11px; color: #475569; margin-top: 3px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block;">
           👤 Contacto / Agendó: <strong>${escapeHtml(capitalizePersonName(p.contacto_nombre) || "Familiar")}</strong>${p.contacto_telefono ? ` (${escapeHtml(formatDisplayPhone(p.contacto_telefono))})` : ""}${p.contacto_notas ? ` • ${escapeHtml(p.contacto_notas)}` : ""}
         </div>`
      : "";

    const rawTel = p.telefono || "";
    const isPlaceholderTel = String(rawTel).startsWith("sin-tel-") || String(rawTel).startsWith("sin-telefono-") || String(rawTel).startsWith("ficha-");
    const cleanDigits = isPlaceholderTel ? "" : String(rawTel).replace(/\D/g, "");
    const waLink = cleanDigits ? `https://wa.me/${cleanDigits}` : "#";
    const displayTel = isPlaceholderTel ? "" : formatDisplayPhone(rawTel);

    const hasReview = patientHasReview(p);
    const encuestaEnviada = patientEncuestaEnviada(p);
    const firstName = getPatientFirstName(p);
    const hasLoadedName = Boolean(firstName);
    const reviewMsg = buildReviewInviteMessage(p);
    const waReviewLink = (cleanDigits && hasLoadedName) ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(reviewMsg)}` : "#";

    const reviewAction = hasReview
      ? `<span class="badge-review-ok" title="Ya dejó una reseña en Google" style="display:inline-flex; align-items:center; gap:4px; font-size:11.5px; padding:3px 8px; border-radius:6px; background:#fef9c3; color:#854d0e; font-weight:600; border:1px solid #fde047;">
           <span aria-hidden="true">⭐</span> Con review
         </span>`
      : (cleanDigits && hasLoadedName
          ? `<a class="btn light btn-review-invite" href="${waReviewLink}" target="_blank" rel="noopener" title="Enviar WhatsApp a ${escapeHtml(firstName)} invitándole a dejar una reseña en Google" style="color:#0f766e; border-color:#99f6e4; background:#f0fdfa; gap:4px; font-size:12px; padding:4px 9px; font-weight:600; text-decoration:none;">
               <span aria-hidden="true">⭐</span><span>Pedir review</span>
             </a>`
          : `<span class="btn light btn-review-invite" title="${!hasLoadedName ? "El nombre del paciente debe estar cargado para pedirle review" : "Sin teléfono para WhatsApp"}" style="opacity:0.45; cursor:not-allowed; gap:4px; font-size:12px; padding:4px 9px;">
               <span aria-hidden="true">⭐</span><span>Pedir review</span>
             </span>`);

    const isColaborador = getSessionUser()?.role === "colaborador";

    let encuestaAction;
    if (encuestaEnviada) {
      encuestaAction = `<span class="badge-encuesta-ok" title="Clara ya envió la invitación a la encuesta" style="display:inline-flex; align-items:center; gap:4px; font-size:11.5px; padding:3px 8px; border-radius:6px; background:#eef2ff; color:#3730a3; font-weight:600; border:1px solid #c7d2fe;">
           <span aria-hidden="true">📋</span> Encuesta enviada
         </span>`;
    } else if (isColaborador) {
      encuestaAction = `<span class="btn light btn-encuesta-invite" title="Los colaboradores no pueden disparar envíos de Clara" style="opacity:0.45; cursor:not-allowed; gap:4px; font-size:12px; padding:4px 9px;">
           <span aria-hidden="true">📋</span><span>Pedir encuesta</span>
         </span>`;
    } else if (cleanDigits && hasLoadedName) {
      encuestaAction = `<button type="button" class="btn light btn-encuesta-invite" data-id="${p.id}" data-name="${escapeHtml(firstName)}" title="Que Clara envíe por WhatsApp la invitación a la breve encuesta" style="color:#4338ca; border-color:#c7d2fe; background:#eef2ff; gap:4px; font-size:12px; padding:4px 9px; font-weight:600;">
           <span aria-hidden="true">📋</span><span>Pedir encuesta</span>
         </button>`;
    } else {
      encuestaAction = `<span class="btn light btn-encuesta-invite" title="${!hasLoadedName ? "El nombre del paciente debe estar cargado para pedirle la encuesta" : "Sin teléfono para WhatsApp"}" style="opacity:0.45; cursor:not-allowed; gap:4px; font-size:12px; padding:4px 9px;">
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
          ${deleteBtn}
        </div>
      </td>
    `;
    listEl.append(tr);
  });

  listEl.querySelectorAll(".btn-edit-paciente").forEach((btn) => {
    btn.addEventListener("click", () => {
      const paciente = pacientesCache.find((p) => String(p.id) === String(btn.dataset.id));
      if (paciente) openFullPacienteModal(paciente, loadPacientes);
    });
  });

  listEl.querySelectorAll(".btn-encuesta-invite").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name || "el paciente";
      const confirmed = await dialogConfirm(
        `¿Que Clara le envíe a ${name} la invitación a la breve encuesta por WhatsApp?\n\nSolo se puede enviar una vez.`,
        { okText: "Enviar", cancelText: "Cancelar" }
      );
      if (!confirmed) return;

      btn.disabled = true;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = "Enviando…";
      try {
        await api("pacientes.php", {
          method: "POST",
          body: JSON.stringify({ action: "send_encuesta_invite", id: Number(id) }),
        });
        const paciente = pacientesCache.find((p) => String(p.id) === String(id));
        if (paciente) paciente.encuesta_enviada = 1;
        renderPacientesTable();
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        const msg = String(err?.payload?.message || err?.payload?.error || err?.message || err || "Error desconocido");
        if (/ya fue enviada/i.test(msg) || err?.status === 409) {
          const paciente = pacientesCache.find((p) => String(p.id) === String(id));
          if (paciente) paciente.encuesta_enviada = 1;
          renderPacientesTable();
          return;
        }
        await dialogAlert(`No se pudo enviar la encuesta: ${msg}`);
      }
    });
  });

  listEl.querySelectorAll(".btn-delete-paciente").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = await dialogConfirm(
        `¿Confirmás que querés eliminar al paciente "${btn.dataset.name}" del directorio?`,
        { danger: true, okText: "Eliminar", cancelText: "Cancelar" }
      );
      if (confirmed) {
        try {
          await api(`pacientes.php?id=${btn.dataset.id}`, { method: "DELETE" });
          setPacientesCache(pacientesCache.filter((p) => String(p.id) !== String(btn.dataset.id)));
          invalidateDirectoryCache();
          renderPacientesTable();
        } catch (err) {
          dialogAlert(`No se pudo eliminar el paciente: ${err.message}`);
        }
      }
    });
  });
}
