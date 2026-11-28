import { api } from "./api.js?v=79";
import { dialogAlert, dialogConfirm } from "./dom.js?v=79";
import { phoneMatches } from "./phone-search.js?v=3";
import { openFullPacienteModal } from "./pacientes-modal.js?v=7";
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
import { formatPatientName } from "./pacientes-name.js?v=4";
import { patientMissingPhone } from "./pacientes-identifiers.js";
import { loadPacientes } from "./pacientes-load.js";
import { createPacientesSectionHeader, buildPacienteRow } from "./pacientes-table-row.js?v=2";

const esCollator = new Intl.Collator("es", { sensitivity: "base" });
let listDelegationBound = false;

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
    const sinTelMatch = patientMissingPhone(p) && (
      query.includes("sin tel") ||
      query.includes("falta tel") ||
      query.includes("sin telefono") ||
      query.includes("sin teléfono") ||
      query === "sin"
    );
    return nameMatch || phoneMatch || emailMatch || dniMatch || motivoMatch || contactMatch || sinTelMatch;
  });

  const keyed = list.map((p) => ({ p, name: formatPatientName(p) }));
  keyed.sort((a, b) => {
    const cmpAp = esCollator.compare(a.name.apellido, b.name.apellido);
    return cmpAp !== 0 ? cmpAp : esCollator.compare(a.name.nombre, b.name.nombre);
  });

  return keyed.map((k) => k.p);
}

function bindPacientesTableEvents() {
  if (listDelegationBound || !listEl) return;
  listDelegationBound = true;
  listEl.addEventListener("click", async (e) => {
    const pacientesCache = getPacientesCache();
    const editBtn = e.target.closest(".btn-edit-paciente");
    if (editBtn) {
      const paciente = pacientesCache.find((p) => String(p.id) === String(editBtn.dataset.id));
      if (paciente) openFullPacienteModal(paciente, loadPacientes);
      return;
    }
    const mergeBtn = e.target.closest(".btn-merge-paciente");
    if (mergeBtn) {
      const paciente = pacientesCache.find((p) => String(p.id) === String(mergeBtn.dataset.id));
      if (paciente) openFullPacienteModal(paciente, loadPacientes, { startInMerge: true });
      return;
    }
    const inviteBtn = e.target.closest("button.btn-encuesta-invite[data-id]");
    if (inviteBtn) {
      const id = inviteBtn.dataset.id;
      if (!id) return;
      const name = inviteBtn.dataset.name || "el paciente";
      const confirmed = await dialogConfirm(
        `¿Que Clara le envíe a ${name} la invitación a la breve encuesta por WhatsApp?\n\nSolo se puede enviar una vez.`,
        { okText: "Enviar", cancelText: "Cancelar" }
      );
      if (!confirmed) return;
      inviteBtn.disabled = true;
      const originalHtml = inviteBtn.innerHTML;
      inviteBtn.innerHTML = "Enviando…";
      try {
        await api("pacientes.php", {
          method: "POST",
          body: JSON.stringify({ action: "send_encuesta_invite", id: Number(id) }),
        });
        const paciente = pacientesCache.find((p) => String(p.id) === String(id));
        if (paciente) paciente.encuesta_enviada = 1;
        renderPacientesTable();
      } catch (err) {
        inviteBtn.disabled = false;
        inviteBtn.innerHTML = originalHtml;
        const msg = String(err?.payload?.message || err?.payload?.error || err?.message || err || "Error desconocido");
        if (/ya fue enviada/i.test(msg) || err?.status === 409) {
          const paciente = pacientesCache.find((p) => String(p.id) === String(id));
          if (paciente) paciente.encuesta_enviada = 1;
          renderPacientesTable();
          return;
        }
        await dialogAlert(`No se pudo enviar la encuesta: ${msg}`);
      }
      return;
    }
    const delBtn = e.target.closest(".btn-delete-paciente");
    if (delBtn) {
      const confirmed = await dialogConfirm(
        `¿Confirmás que querés eliminar al paciente "${delBtn.dataset.name}" del directorio?`,
        { danger: true, okText: "Eliminar", cancelText: "Cancelar" }
      );
      if (!confirmed) return;
      try {
        await api(`pacientes.php?id=${delBtn.dataset.id}`, { method: "DELETE" });
        setPacientesCache(pacientesCache.filter((p) => String(p.id) !== String(delBtn.dataset.id)));
        invalidateDirectoryCache();
        renderPacientesTable();
      } catch (err) {
        dialogAlert(`No se pudo eliminar el paciente: ${err.message}`);
      }
    }
  });
}

export function renderPacientesTable() {
  syncPacientesBadgeFromCache();
  if (!listEl) return;
  bindPacientesTableEvents();
  const filtered = filterPacientes();

  if (countEl) {
    countEl.textContent = `${filtered.length} paciente${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 32px; color: var(--muted);">No se encontraron pacientes que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  const missingPhone = filtered.filter((p) => patientMissingPhone(p));
  const withPhone = filtered.filter((p) => !patientMissingPhone(p));

  const frag = document.createDocumentFragment();

  if (missingPhone.length > 0) {
    frag.append(createPacientesSectionHeader("Sin teléfono", missingPhone.length, { accent: true }));
    missingPhone.forEach((p) => frag.append(buildPacienteRow(p)));
  }

  if (withPhone.length > 0) {
    if (missingPhone.length > 0) {
      frag.append(createPacientesSectionHeader("Resto del directorio", withPhone.length));
    }
    withPhone.forEach((p) => frag.append(buildPacienteRow(p)));
  }

  listEl.replaceChildren(frag);
}
