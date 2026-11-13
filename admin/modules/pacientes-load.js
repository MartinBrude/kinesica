import { api } from "./api.js?v=79";
import { escapeHtml } from "./dom.js?v=79";
import { setListControlsEnabled } from "./list-controls.js?v=1";
import { invalidateDirectoryCache } from "./form-patient.js";
import { openFullPacienteModal } from "./pacientes-modal.js?v=3";
import { deduplicatePatientsInMemory } from "./pacientes-dedupe.js";
import {
  listEl,
  searchInput,
  profFilter,
  setPacientesCache,
  getPendingSearchFromUrl,
  setPendingSearchFromUrl,
} from "./pacientes-state.js";
import { renderPacientesTable } from "./pacientes-table.js";

export async function loadPacientes() {
  if (!listEl) return;
  const toolbar = document.querySelector(".pacientes-toolbar");
  setListControlsEnabled(toolbar, false, { extra: [searchInput, profFilter] });
  listEl.innerHTML = `<tr><td colspan="6" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando directorio de pacientes…</span></td></tr>`;
  try {
    const res = await api("pacientes.php");
    const raw = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    const deduplicated = deduplicatePatientsInMemory(raw);
    setPacientesCache(deduplicated);
    invalidateDirectoryCache();
    renderPacientesTable();

    try {
      const storedQuery = (typeof sessionStorage !== "undefined" && sessionStorage.getItem("kinesica_pending_paciente_search")) || "";
      const currentUrlQuery = (typeof window !== "undefined" && window.location)
        ? (new URLSearchParams(window.location.search).get("buscar") || new URLSearchParams(window.location.search).get("q") || "")
        : "";
      const initialQuery = (currentUrlQuery || storedQuery || getPendingSearchFromUrl() || "").trim();

      if (initialQuery) {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("kinesica_pending_paciente_search");
        }
        setPendingSearchFromUrl("");

        if (searchInput) {
          searchInput.value = initialQuery;
          renderPacientesTable();
        }

        if (!window._kinesicaPatientModalAutoOpened) {
          window._kinesicaPatientModalAutoOpened = true;
          const normQ = initialQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, " ").trim();
          const qTokens = normQ.split(/\s+/).filter(Boolean);
          const cache = deduplicated;

          const found = cache.find((p) => {
            const raw = `${p.nombre_completo || ""} ${p.apellido || ""} ${p.nombre || ""}`;
            const normP = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, " ");
            return qTokens.length > 0 && qTokens.every((t) => normP.includes(t));
          });

          if (found) {
            openFullPacienteModal(found, loadPacientes);
          } else {
            const parts = initialQuery.replace(/,/g, " ").trim().split(/\s+/);
            const nombre = parts[0] || "";
            const apellido = parts.slice(1).join(" ") || "";
            openFullPacienteModal({ nombre, apellido, nombre_completo: initialQuery }, loadPacientes);
          }
        }
      }
    } catch { /* ignore */ }
  } catch (err) {
    listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #dc2626;">Error al cargar pacientes: ${escapeHtml(err.message)}</td></tr>`;
  } finally {
    setListControlsEnabled(toolbar, true, { extra: [searchInput, profFilter] });
  }
}
