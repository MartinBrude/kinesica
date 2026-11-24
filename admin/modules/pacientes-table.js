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
import { formatPatientName } from "./pacientes-name.js?v=3";
import { patientMissingPhone } from "./pacientes-identifiers.js";
import { loadPacientes } from "./pacientes-load.js";
import { createPacientesSectionHeader, buildPacienteRow } from "./pacientes-table-row.js?v=2";

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

  list.sort((a, b) => {
    const nameA = formatPatientName(a);
    const nameB = formatPatientName(b);
    const cmpAp = nameA.apellido.localeCompare(nameB.apellido, "es", { sensitivity: "base" });
    return cmpAp !== 0 ? cmpAp : nameA.nombre.localeCompare(nameB.nombre, "es", { sensitivity: "base" });
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

  const missingPhone = filtered.filter((p) => patientMissingPhone(p));
  const withPhone = filtered.filter((p) => !patientMissingPhone(p));

  listEl.innerHTML = "";

  if (missingPhone.length > 0) {
    listEl.append(createPacientesSectionHeader("Sin teléfono", missingPhone.length, { accent: true }));
    missingPhone.forEach((p) => listEl.append(buildPacienteRow(p)));
  }

  if (withPhone.length > 0) {
    if (missingPhone.length > 0) {
      listEl.append(createPacientesSectionHeader("Resto del directorio", withPhone.length));
    }
    withPhone.forEach((p) => listEl.append(buildPacienteRow(p)));
  }

  listEl.querySelectorAll(".btn-edit-paciente").forEach((btn) => {
    btn.addEventListener("click", () => {
      const paciente = pacientesCache.find((p) => String(p.id) === String(btn.dataset.id));
      if (paciente) openFullPacienteModal(paciente, loadPacientes);
    });
  });

  listEl.querySelectorAll(".btn-merge-paciente").forEach((btn) => {
    btn.addEventListener("click", () => {
      const paciente = pacientesCache.find((p) => String(p.id) === String(btn.dataset.id));
      if (paciente) openFullPacienteModal(paciente, loadPacientes, { startInMerge: true });
    });
  });

  listEl.querySelectorAll("button.btn-encuesta-invite[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!id) return;
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
      if (!confirmed) return;
      try {
        await api(`pacientes.php?id=${btn.dataset.id}`, { method: "DELETE" });
        setPacientesCache(pacientesCache.filter((p) => String(p.id) !== String(btn.dataset.id)));
        invalidateDirectoryCache();
        renderPacientesTable();
      } catch (err) {
        dialogAlert(`No se pudo eliminar el paciente: ${err.message}`);
      }
    });
  });
}
