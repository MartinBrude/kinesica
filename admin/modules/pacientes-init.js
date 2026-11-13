import { debounce, dialogAlert } from "./dom.js?v=79";
import { openFullPacienteModal } from "./pacientes-modal.js?v=3";
import {
  searchInput,
  profFilter,
  btnNuevo,
  btnBackupSql,
  setActiveFilterProf,
} from "./pacientes-state.js";
import { refreshPacientesMissingPhoneBadge, startPacientesBadgePoll } from "./pacientes-badge.js";
import { renderPacientesTable } from "./pacientes-table.js";
import { loadPacientes } from "./pacientes-load.js";

export function initPacientesModule() {
  startPacientesBadgePoll();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshPacientesMissingPhoneBadge();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => renderPacientesTable(), 150));
  }
  if (profFilter) {
    profFilter.addEventListener("change", (e) => {
      setActiveFilterProf(e.target.value);
      renderPacientesTable();
    });
  }
  if (btnNuevo) {
    btnNuevo.addEventListener("click", () => openFullPacienteModal(null, loadPacientes));
  }
  if (btnBackupSql) {
    btnBackupSql.addEventListener("click", async () => {
      try {
        const res = await fetch("api/backup.php", {
          headers: { "X-Kinesica": "1" },
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) {
          let errMsg = "No se pudo descargar el backup SQL.";
          try {
            const data = await res.json();
            if (data?.error) errMsg = data.error;
          } catch { /* ignore */ }
          await dialogAlert(errMsg);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kinesica-backup-${new Date().toISOString().slice(0, 10)}.sql`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (_) {
        await dialogAlert("Error de conexión al descargar el backup SQL.");
      }
    });
  }
}
