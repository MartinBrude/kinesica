/**
 * Kinésica Admin — Turnos de campaña
 * Listado desde Google Calendar, flag por paciente y export CSV.
 */

import { api } from "./api.js?v=78";
import { escapeHtml, dialogAlert } from "./dom.js?v=79";

let cachedItems = [];
let loading = false;

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 2);
  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { from: iso(from), to: iso(to) };
}

function ensureDefaultDates() {
  const fromEl = document.getElementById("admin-campana-from");
  const toEl = document.getElementById("admin-campana-to");
  if (!fromEl || !toEl) return;
  if (!fromEl.value || !toEl.value) {
    const { from, to } = defaultDateRange();
    if (!fromEl.value) fromEl.value = from;
    if (!toEl.value) toEl.value = to;
  }
}

function updateCountLabel(total) {
  const el = document.getElementById("admin-campana-count-label");
  if (!el) return;
  el.textContent = `${total} ${total === 1 ? "fila" : "filas"}`;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(items) {
  const exportable = items.filter((it) => it.viene_de_campana !== false && Number(it.viene_de_campana) !== 0);
  const lines = ["nombre,apellido,fecha"];
  for (const it of exportable) {
    lines.push([csvEscape(it.nombre), csvEscape(it.apellido), csvEscape(it.fecha)].join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const from = document.getElementById("admin-campana-from")?.value || "desde";
  const to = document.getElementById("admin-campana-to")?.value || "hasta";
  a.href = url;
  a.download = `turnos-campana_${from}_${to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderCampanaRows(items) {
  const tbody = document.getElementById("admin-campana-tbody");
  if (!tbody) return;

  updateCountLabel(items.length);

  if (!items.length) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:28px 16px;">No hay turnos en el rango seleccionado.</td></tr>';
    return;
  }

  tbody.replaceChildren(
    ...items.map((item, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = String(index);

      const tdNombre = document.createElement("td");
      tdNombre.innerHTML = `<strong>${escapeHtml(item.nombre || "—")}</strong>`;

      const tdApellido = document.createElement("td");
      tdApellido.textContent = item.apellido || "—";

      const tdFecha = document.createElement("td");
      tdFecha.textContent = item.fecha || "—";

      const tdFlag = document.createElement("td");
      tdFlag.className = "campana-flag-td";
      const checked = item.viene_de_campana !== false && Number(item.viene_de_campana) !== 0;
      const label = document.createElement("label");
      label.className = "campana-toggle";
      label.title = "¿Viene de la campaña?";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      input.setAttribute("aria-label", "¿Viene de la campaña?");
      input.addEventListener("change", () => onToggleCampana(item, index, input));
      const span = document.createElement("span");
      span.textContent = checked ? "Sí" : "No";
      label.append(input, span);
      tdFlag.appendChild(label);

      tr.append(tdNombre, tdApellido, tdFecha, tdFlag);
      return tr;
    })
  );
}

async function onToggleCampana(item, index, input) {
  const next = Boolean(input.checked);
  const labelSpan = input.parentElement?.querySelector("span");
  input.disabled = true;
  try {
    const res = await api("campana_turnos.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_campana",
        paciente_id: item.paciente_id || null,
        viene_de_campana: next,
        nombre: item.nombre || "",
        apellido: item.apellido || "",
        telefono: item.telefono || "",
        patient_name_raw: item.patient_name_raw || `${item.nombre || ""} ${item.apellido || ""}`.trim(),
      }),
    });
    const id = res?.paciente_id ?? item.paciente_id;
    cachedItems[index] = {
      ...item,
      paciente_id: id,
      viene_de_campana: next,
    };
    if (labelSpan) labelSpan.textContent = next ? "Sí" : "No";
  } catch (err) {
    input.checked = !next;
    await dialogAlert(`No se pudo guardar el flag: ${err?.message || "Error"}`);
  } finally {
    input.disabled = false;
  }
}

export async function loadCampanaData() {
  const card = document.getElementById("admin-campana-card");
  if (!card || card.hidden) return;

  ensureDefaultDates();
  const from = document.getElementById("admin-campana-from")?.value || "";
  const to = document.getElementById("admin-campana-to")?.value || "";
  const unique = Boolean(document.getElementById("admin-campana-unique")?.checked);
  const tbody = document.getElementById("admin-campana-tbody");

  if (loading) return;
  loading = true;
  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando turnos del calendario…</span></td></tr>';
  }

  try {
    const qs = new URLSearchParams({ from, to, unique: unique ? "1" : "0" });
    const data = await api(`campana_turnos.php?${qs.toString()}`);
    cachedItems = Array.isArray(data?.items) ? data.items : [];
    renderCampanaRows(cachedItems);
  } catch (err) {
    cachedItems = [];
    updateCountLabel(0);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger, #b3261e); padding:28px 16px;">${escapeHtml(err?.message || "No se pudieron cargar los turnos")}</td></tr>`;
    }
  } finally {
    loading = false;
  }
}

export function initCampanaUI() {
  ensureDefaultDates();

  document.getElementById("admin-btn-campana-filtrar")?.addEventListener("click", () => {
    loadCampanaData();
  });

  document.getElementById("admin-campana-unique")?.addEventListener("change", () => {
    loadCampanaData();
  });

  document.getElementById("admin-btn-campana-csv")?.addEventListener("click", () => {
    const exportable = cachedItems.filter(
      (it) => it.viene_de_campana !== false && Number(it.viene_de_campana) !== 0
    );
    if (!exportable.length) {
      dialogAlert("No hay filas con «¿Viene de la campaña?» en sí para exportar.");
      return;
    }
    downloadCsv(cachedItems);
  });

  ["admin-campana-from", "admin-campana-to"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadCampanaData();
      }
    });
  });
}
