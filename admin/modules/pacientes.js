/**
 * Kinésica Admin - Módulo de Gestión de Pacientes y Directorio de Teléfonos
 * Permite buscar, ver, dar de alta y editar teléfonos para WhatsApp y recordatorios.
 */

import { api } from "./api.js?v=77";
import { escapeHtml, node, debounce, dialogAlert, dialogConfirm } from "./dom.js?v=78";
import { phoneMatches } from "./phone-search.js?v=1";

const viewPacientes = typeof document !== "undefined" ? document.querySelector("#view-pacientes") : null;
const listEl = typeof document !== "undefined" ? document.querySelector("#pacientes-list-tbody") : null;
const searchInput = typeof document !== "undefined" ? document.querySelector("#search-pacientes") : null;
const profFilter = typeof document !== "undefined" ? document.querySelector("#filter-pacientes-prof") : null;
const btnNuevo = typeof document !== "undefined" ? document.querySelector("#btn-nuevo-paciente") : null;
const btnBackupSql = typeof document !== "undefined" ? document.querySelector("#btn-backup-sql") : null;
const countEl = typeof document !== "undefined" ? document.querySelector("#pacientes-total-count") : null;

let pacientesCache = [];
let activeFilterProf = "todos";

/**
 * Formatea un número de teléfono para lectura clara (ej: 5491161164311 -> (+54) 9 11 6116 4311)
 * @param {string} raw
 * @returns {string}
 */
export function formatDisplayPhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return raw;

  // Argentina: 549 + código de área + número local (ej: 5491161164311 -> (+54) 9 11 6116 4311)
  if (digits.startsWith("549")) {
    const rest = digits.slice(3); // ej: "1161164311"
    if (rest.startsWith("11") && rest.length === 10) {
      return `(+54) 9 11 ${rest.slice(2, 6)} ${rest.slice(6)}`;
    }
    if (rest.length === 10) {
      return `(+54) 9 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
    if (rest.length >= 8) {
      const p1 = rest.slice(rest.length - 8, rest.length - 4);
      const p2 = rest.slice(rest.length - 4);
      const area = rest.slice(0, rest.length - 8);
      return `(+54) 9 ${area} ${p1} ${p2}`;
    }
    return `(+54) 9 ${rest}`;
  }

  // Argentina sin 9 intermedio (ej: 5411...)
  if (digits.startsWith("54") && digits.length >= 10) {
    const rest = digits.slice(2);
    if (rest.startsWith("11") && rest.length === 10) {
      return `(+54) 11 ${rest.slice(2, 6)} ${rest.slice(6)}`;
    }
    return `(+54) ${rest}`;
  }

  // España: 34 + 9 dígitos (ej: 34612345678 -> (+34) 612 345 678)
  if (digits.startsWith("34") && digits.length === 11) {
    const rest = digits.slice(2);
    return `(+34) ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }

  // Local 10 dígitos (ej: 1161164311)
  if (digits.startsWith("11") && digits.length === 10) {
    return `11 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }

  return `+${digits}`;
}

export function isValidAdminEmail(raw) {
  const s = String(raw || "").trim();
  if (!s) return true; // opcional en pacientes del admin
  if (s.length > 120 || /\s/.test(s)) return false;
  const parts = s.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || local.length > 64 || domain.length > 253) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,24}$/.test(tld)) return false;
  return labels.every((lbl) => lbl.length > 0 && lbl.length <= 63 && /^[A-Za-z0-9-]+$/.test(lbl) && !lbl.startsWith("-") && !lbl.endsWith("-"));
}

export function suggestAdminEmailDomain(raw) {
  const s = String(raw || "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at === -1) return null;
  const domain = s.slice(at + 1);
  if (!domain) return null;

  const typoMap = {
    "gmai.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmail.con": "gmail.com",
    "gemail.com": "gmail.com",
    "gmail.co": "gmail.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hotamail.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "hotmail.con": "hotmail.com",
    "outloo.com": "outlook.com",
    "outlok.com": "outlook.com",
    "outlock.com": "outlook.com",
    "outlook.con": "outlook.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yahoo.con": "yahoo.com",
    "iclud.com": "icloud.com",
    "icoud.com": "icloud.com",
    "icloud.con": "icloud.com",
  };
  if (typoMap[domain]) return typoMap[domain];
  if (domain.endsWith(".con") && domain.length > 5) {
    return domain.slice(0, -4) + ".com";
  }
  return null;
}

export function inspectAdminPhone(raw) {
  const trimmed = String(raw || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 16 || /^(\d)\1+$/.test(digits)) {
    return { valid: false, standard: false, digits };
  }
  const hasIntlPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  const isStandardAr =
    (/^549?\d{10}$/.test(digits)) ||
    (/^0?(?:11|[23]\d{2,3})\d{6,8}$/.test(digits) && digits.length >= 10 && digits.length <= 11) ||
    (/^0?1115\d{8}$/.test(digits)) ||
    (/^15\d{8}$/.test(digits)) ||
    (/^\d{8}$/.test(digits) && !hasIntlPrefix);
  const isStandardIntl =
    (hasIntlPrefix && digits.length >= 8 && digits.length <= 15) ||
    (/^(?:34\d{9}|598\d{8,9}|56\d{9}|55\d{10,11}|595\d{9}|591\d{8}|51\d{9}|57\d{10}|52\d{10}|1\d{10}|44\d{10}|33\d{9}|39\d{9,10}|49\d{10,11})$/.test(digits));
  return {
    valid: true,
    standard: Boolean(isStandardAr || isStandardIntl),
    digits,
  };
}

export function showPacientesView() {
  if (viewPacientes) {
    viewPacientes.hidden = false;
    // Ocultar otras vistas
    const views = ["#view-dashboard", "#view-library", "#view-horarios", "#view-form", "#view-compare", "#view-gate"];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "pacientes" }));
    } catch {}
    loadPacientes();
  }
}

export function hidePacientesView() {
  if (viewPacientes) {
    viewPacientes.hidden = true;
  }
}

export async function loadPacientes() {
  if (!listEl) return;
  listEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--muted);">Cargando directorio de pacientes…</td></tr>`;
  try {
    const res = await api("pacientes.php");
    pacientesCache = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    renderPacientesTable();
  } catch (err) {
    listEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: #dc2626;">Error al cargar pacientes: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/**
 * Devuelve el apellido y nombre(s) estructurados a partir de un objeto paciente.
 * @param {object} p
 * @returns {{ apellido: string, nombre: string, display: string }}
 */
export function formatPatientName(p) {
  let ap = (p?.apellido || "").trim();
  let nom = (p?.nombre || "").trim();

  if (!ap && !nom) {
    const full = (p?.nombre_completo || "").trim();
    if (full) {
      const parts = full.split(/\s+/);
      if (parts.length === 1) {
        nom = parts[0];
      } else {
        // En español el primer token suele ser el nombre de pila y el resto los apellidos (ej: "Juan Pérez", "Ana María Gómez")
        nom = parts.slice(0, parts.length > 2 ? 2 : 1).join(" ");
        ap = parts.slice(parts.length > 2 ? 2 : 1).join(" ");
      }
    }
  }

  let display = "";
  if (ap && nom) {
    display = `${ap}, ${nom}`;
  } else if (ap) {
    display = ap;
  } else if (nom) {
    display = nom;
  } else {
    display = (p?.nombre_completo || "").trim() || "Paciente";
  }

  return { apellido: ap, nombre: nom, display };
}

function filterPacientes() {
  const query = (searchInput?.value || "").toLowerCase().trim();
  const list = pacientesCache.filter((p) => {
    if (activeFilterProf !== "todos" && p.profesional_habitual !== activeFilterProf) {
      return false;
    }
    if (!query) return true;
    const nameMatch = (p.nombre_completo || "").toLowerCase().includes(query) ||
                      (p.nombre || "").toLowerCase().includes(query) ||
                      (p.apellido || "").toLowerCase().includes(query);
    const phoneMatch = (p.telefono || "").includes(query) || phoneMatches(p.telefono, query);
    const emailMatch = (p.email || "").toLowerCase().includes(query);
    const dniMatch = (p.dni || "").toLowerCase().includes(query);
    const motivoMatch = (p.motivo_consulta || "").toLowerCase().includes(query);
    const contactMatch = (p.contacto_nombre || "").toLowerCase().includes(query) ||
                         (p.contacto_telefono || "").includes(query) || phoneMatches(p.contacto_telefono, query) ||
                         (p.contacto_notas || "").toLowerCase().includes(query);
    return nameMatch || phoneMatch || emailMatch || dniMatch || motivoMatch || contactMatch;
  });

  // Ordenar alfabéticamente por Apellido, y secundariamente por Nombre
  list.sort((a, b) => {
    const nameA = formatPatientName(a);
    const nameB = formatPatientName(b);
    const cmpAp = nameA.apellido.localeCompare(nameB.apellido, "es", { sensitivity: "base" });
    if (cmpAp !== 0) return cmpAp;
    return nameA.nombre.localeCompare(nameB.nombre, "es", { sensitivity: "base" });
  });

  return list;
}

export function renderPacientesTable() {
  if (!listEl) return;
  const filtered = filterPacientes();

  if (countEl) {
    countEl.textContent = `${filtered.length} paciente${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 32px; color: var(--muted);">No se encontraron pacientes que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach((p) => {
    const tr = document.createElement("tr");

    // Formato de nombre: Apellido, Nombre(s)
    const formattedName = formatPatientName(p);
    const displayName = formattedName.display;
    const fullNameForConfirm = p.nombre_completo || [p.nombre, p.apellido].filter(Boolean).join(" ") || displayName;

    // Badge si fue agendado por un tercero o tiene familiar/secretaria asociada
    const contactBadge = (p.contacto_nombre || p.contacto_telefono)
      ? `<div style="font-size: 11px; color: #475569; margin-top: 3px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block;">
           👤 Contacto / Agendó: <strong>${escapeHtml(p.contacto_nombre || "Familiar")}</strong>${p.contacto_telefono ? ` (${escapeHtml(formatDisplayPhone(p.contacto_telefono))})` : ""}${p.contacto_notas ? ` • ${escapeHtml(p.contacto_notas)}` : ""}
         </div>`
      : "";

    // Teléfono formateado para lectura y link a WhatsApp
    const rawTel = p.telefono || "";
    const waLink = rawTel ? `https://wa.me/${rawTel}` : "#";
    const displayTel = formatDisplayPhone(rawTel);

    tr.innerHTML = `
      <td>
        <strong style="color: var(--navy);">${escapeHtml(displayName)}</strong>
        ${contactBadge}
      </td>
      <td>
        <div class="phone-cell">
          ${rawTel ? `<a class="phone-link" href="${waLink}" target="_blank" rel="noopener" title="Abrir chat de WhatsApp">📲 ${escapeHtml(displayTel)}</a>` : '<span style="color:var(--muted)">Sin teléfono</span>'}
        </div>
      </td>
      <td>
        ${p.email ? `<a class="email-link" href="mailto:${escapeHtml(p.email)}" title="Enviar correo a ${escapeHtml(p.email)}">✉️ ${escapeHtml(p.email)}</a>` : '<span style="color:var(--muted)">—</span>'}
      </td>
      <td>${p.dni ? escapeHtml(p.dni) : '<span style="color:var(--muted)">—</span>'}</td>
      <td>
        <span class="badge-prof ${escapeHtml(p.profesional_habitual || "indistinto")}">
          ${escapeHtml(p.profesional_habitual || "indistinto")}
        </span>
      </td>
      <td><small>${p.motivo_consulta ? escapeHtml(p.motivo_consulta) : "—"}</small></td>
      <td style="text-align: right;">
        <div class="pacientes-actions">
          <button type="button" class="btn light btn-edit-paciente" data-id="${p.id}" title="Editar paciente">Editar</button>
          <button type="button" class="btn ghost btn-delete-paciente btn-icon-del" data-id="${p.id}" data-name="${escapeHtml(fullNameForConfirm)}" title="Eliminar paciente" aria-label="Eliminar paciente">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </td>
    `;
    listEl.append(tr);
  });

  // Event Listeners para acciones en filas

  listEl.querySelectorAll(".btn-edit-paciente").forEach((btn) => {
    btn.addEventListener("click", () => {
      const paciente = pacientesCache.find((p) => String(p.id) === String(btn.dataset.id));
      if (paciente) openFullPacienteModal(paciente);
    });
  });

  listEl.querySelectorAll(".btn-delete-paciente").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = await dialogConfirm(
        `¿Confirmás que querés eliminar al paciente "${btn.dataset.name}" del directorio?`,
        "Eliminar",
        "Cancelar",
        true
      );
      if (confirmed) {
        try {
          await api(`pacientes.php?id=${btn.dataset.id}`, { method: "DELETE" });
          pacientesCache = pacientesCache.filter((p) => String(p.id) !== String(btn.dataset.id));
          renderPacientesTable();
        } catch (err) {
          dialogAlert(`No se pudo eliminar el paciente: ${err.message}`);
        }
      }
    });
  });
}



// Modal de alta o edición completa de paciente
function openFullPacienteModal(paciente = null) {
  const isEdit = Boolean(paciente);
  const backdrop = document.createElement("div");
  backdrop.className = "paciente-modal-backdrop";

  // Desglosar nombre y apellido si ya vienen separados o juntos
  let nombreVal = paciente?.nombre || "";
  let apellidoVal = paciente?.apellido || "";
  if (!nombreVal && !apellidoVal && paciente?.nombre_completo) {
    const parts = paciente.nombre_completo.trim().split(/\s+/);
    nombreVal = parts[0] || "";
    apellidoVal = parts.slice(1).join(" ") || "";
  }

  backdrop.innerHTML = `
    <div class="paciente-modal-card">
      <div class="paciente-modal-header">
        <h2>${isEdit ? "Editar Paciente" : "Nuevo Paciente"}</h2>
        <button type="button" class="btn ghost btn-close-modal">✕</button>
      </div>
      <form id="form-full-paciente">
        <div class="paciente-modal-body">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>Nombre *</label>
              <input type="text" id="modal-p-nombre" value="${escapeHtml(nombreVal)}" placeholder="Ej: Florencia" maxlength="60" required autofocus>
            </div>
            <div class="paciente-modal-field">
              <label>Apellido *</label>
              <input type="text" id="modal-p-apellido" value="${escapeHtml(apellidoVal)}" placeholder="Ej: González" maxlength="60" required>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>Teléfono (WhatsApp) *</label>
              <input type="tel" id="modal-p-tel" value="${escapeHtml(paciente?.telefono || "")}" placeholder="Ej: 11 6123-4567 o +34..." maxlength="24" inputmode="tel" required>
              <small>Para WhatsApp y recordatorios automáticos.</small>
            </div>
            <div class="paciente-modal-field">
              <label>Email</label>
              <input type="email" id="modal-p-email" value="${escapeHtml(paciente?.email || "")}" placeholder="ejemplo@email.com" maxlength="120" inputmode="email" autocapitalize="off" spellcheck="false">
              <small>Para avisos y confirmaciones de turnos.</small>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>DNI / Documento</label>
              <input type="text" id="modal-p-dni" value="${escapeHtml(paciente?.dni || "")}" placeholder="Opcional" maxlength="20">
            </div>
            <div class="paciente-modal-field">
              <label>Profesional Habitual</label>
              <select id="modal-p-prof">
                <option value="indistinto" ${paciente?.profesional_habitual === "indistinto" ? "selected" : ""}>Indistinto</option>
                <option value="norberto" ${paciente?.profesional_habitual === "norberto" ? "selected" : ""}>Norberto</option>
                <option value="maria" ${paciente?.profesional_habitual === "maria" ? "selected" : ""}>María</option>
              </select>
            </div>
          </div>
          <div class="paciente-modal-field">
            <label>Motivo de Consulta / Disciplina</label>
            <input type="text" id="modal-p-motivo" value="${escapeHtml(paciente?.motivo_consulta || "")}" placeholder="Ej: ATM, RPG, Cervicalgia, Lumbalgia" maxlength="255">
          </div>
          <div class="paciente-modal-field">
            <label>Notas Clínicas / Administrativas</label>
            <textarea id="modal-p-notas" rows="2" placeholder="Observaciones opcionales" maxlength="2000">${escapeHtml(paciente?.notas || "")}</textarea>
          </div>
          <div style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase;">
              👤 Contacto / Agendado por (opcional):
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
              <div class="paciente-modal-field">
                <label>Nombre de quien agenda</label>
                <input type="text" id="modal-p-contacto-nombre" value="${escapeHtml(paciente?.contacto_nombre || "")}" placeholder="Ej: Laura Gómez (familiar / cónyuge / secretaria)" maxlength="120">
              </div>
              <div class="paciente-modal-field">
                <label>Teléfono de contacto (WhatsApp)</label>
                <input type="tel" id="modal-p-contacto-tel" value="${escapeHtml(paciente?.contacto_telefono || "")}" placeholder="Ej: 11 6123-4567 o +34..." maxlength="24" inputmode="tel">
              </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="paciente-modal-field">
                <label>Email de contacto</label>
                <input type="email" id="modal-p-contacto-email" value="${escapeHtml(paciente?.contacto_email || "")}" placeholder="contacto@ejemplo.com" maxlength="120" inputmode="email" autocapitalize="off" spellcheck="false">
              </div>
              <div class="paciente-modal-field">
                <label>Relación o rol</label>
                <input type="text" id="modal-p-contacto-notas" value="${escapeHtml(paciente?.contacto_notas || "")}" placeholder="Ej: Cónyuge, Hijo/a, Secretaria" maxlength="100">
              </div>
            </div>
          </div>
          <p id="modal-p-error" style="color:#dc2626; font-size:13px; margin:0;" hidden></p>
        </div>
        <div class="paciente-modal-footer">
          <button type="button" class="btn light btn-close-modal">Cancelar</button>
          <button type="submit" class="btn green" id="btn-submit-paciente">${isEdit ? "Guardar Cambios" : "Crear Paciente"}</button>
        </div>
      </form>
    </div>
  `;

  document.body.append(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelectorAll(".btn-close-modal").forEach((b) => b.addEventListener("click", close));

  const form = backdrop.querySelector("#form-full-paciente");
  const errorEl = backdrop.querySelector("#modal-p-error");
  const submitBtn = backdrop.querySelector("#btn-submit-paciente");
  const confirmedWeirdPhones = new Set();
  const confirmedSuspiciousEmails = new Set();

  // Restricción de input en tiempo real en el modal
  ["#modal-p-tel", "#modal-p-contacto-tel"].forEach((sel) => {
    const el = backdrop.querySelector(sel);
    if (el) {
      el.addEventListener("input", () => {
        const cleaned = el.value.replace(/[^0-9+\-().\s]/g, "");
        const hasPlus = cleaned.trimStart().startsWith("+");
        const noPlus = cleaned.replace(/\+/g, "");
        const next = (hasPlus ? "+" + noPlus : noPlus).slice(0, 24);
        if (next !== el.value) el.value = next;
        errorEl.hidden = true;
      });
    }
  });
  ["#modal-p-email", "#modal-p-contacto-email"].forEach((sel) => {
    const el = backdrop.querySelector(sel);
    if (el) {
      el.addEventListener("input", () => {
        const next = el.value.replace(/[\s<>(),;:"[\]\\]/g, "").slice(0, 120);
        if (next !== el.value) el.value = next;
        errorEl.hidden = true;
      });
    }
  });
  ["#modal-p-nombre", "#modal-p-apellido", "#modal-p-contacto-nombre"].forEach((sel) => {
    const el = backdrop.querySelector(sel);
    if (el) {
      el.addEventListener("input", () => {
        const next = el.value.replace(/[^\p{L}\p{M}\s'.\-]/gu, "").replace(/\s{2,}/g, " ");
        if (next !== el.value) el.value = next;
        errorEl.hidden = true;
      });
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = backdrop.querySelector("#modal-p-nombre").value.trim();
    const apellido = backdrop.querySelector("#modal-p-apellido").value.trim();
    const tel = backdrop.querySelector("#modal-p-tel").value.trim();
    const email = backdrop.querySelector("#modal-p-email").value.trim();
    const dni = backdrop.querySelector("#modal-p-dni").value.trim();
    const prof = backdrop.querySelector("#modal-p-prof").value;
    const motivo = backdrop.querySelector("#modal-p-motivo").value.trim();
    const notas = backdrop.querySelector("#modal-p-notas").value.trim();
    const contactoNombre = backdrop.querySelector("#modal-p-contacto-nombre")?.value.trim() || "";
    const contactoTel = backdrop.querySelector("#modal-p-contacto-tel")?.value.trim() || "";
    const contactoEmail = backdrop.querySelector("#modal-p-contacto-email")?.value.trim() || "";
    const contactoNotas = backdrop.querySelector("#modal-p-contacto-notas")?.value.trim() || "";

    if (!nombre || !apellido || !tel) {
      errorEl.textContent = "Nombre, apellido y teléfono son obligatorios.";
      errorEl.hidden = false;
      return;
    }

    if (!isValidAdminEmail(email)) {
      errorEl.textContent = "El correo electrónico ingresado no tiene un formato válido.";
      errorEl.hidden = false;
      return;
    }
    if (email) {
      const eLower = email.toLowerCase();
      const suggested = suggestAdminEmailDomain(eLower);
      if (suggested && !confirmedSuspiciousEmails.has(eLower)) {
        confirmedSuspiciousEmails.add(eLower);
        errorEl.textContent = `¿El correo (${email}) es correcto? Quizás quisiste escribir @${suggested}. Si está bien, volvé a tocar Guardar.`;
        errorEl.hidden = false;
        return;
      }
    }

    if (!isValidAdminEmail(contactoEmail)) {
      errorEl.textContent = "El correo electrónico de contacto no tiene un formato válido.";
      errorEl.hidden = false;
      return;
    }
    if (contactoEmail) {
      const ceLower = contactoEmail.toLowerCase();
      const suggestedContact = suggestAdminEmailDomain(ceLower);
      if (suggestedContact && !confirmedSuspiciousEmails.has(ceLower)) {
        confirmedSuspiciousEmails.add(ceLower);
        errorEl.textContent = `¿El correo de contacto (${contactoEmail}) es correcto? Quizás quisiste escribir @${suggestedContact}. Si está bien, volvé a tocar Guardar.`;
        errorEl.hidden = false;
        return;
      }
    }

    const telInfo = inspectAdminPhone(tel);
    if (!telInfo.valid) {
      errorEl.textContent = "Por favor ingresá un número de teléfono válido.";
      errorEl.hidden = false;
      return;
    }
    if (!telInfo.standard && !confirmedWeirdPhones.has(telInfo.digits)) {
      confirmedWeirdPhones.add(telInfo.digits);
      errorEl.textContent = "¿El teléfono es correcto? Si es de otro país o ya lo revisaste, volvé a tocar Guardar para confirmar.";
      errorEl.hidden = false;
      return;
    }

    if (contactoTel) {
      const cTelInfo = inspectAdminPhone(contactoTel);
      if (!cTelInfo.valid) {
        errorEl.textContent = "El teléfono de contacto no es válido.";
        errorEl.hidden = false;
        return;
      }
      if (!cTelInfo.standard && !confirmedWeirdPhones.has(cTelInfo.digits)) {
        confirmedWeirdPhones.add(cTelInfo.digits);
        errorEl.textContent = "¿El teléfono de contacto es correcto? Si es de otro país o ya lo revisaste, volvé a tocar Guardar.";
        errorEl.hidden = false;
        return;
      }
    }

    const nombreCompleto = `${nombre} ${apellido}`.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    errorEl.hidden = true;

    try {
      if (isEdit) {
        await api("pacientes.php", {
          method: "PUT",
          body: JSON.stringify({
            id: paciente.id,
            nombre: nombre,
            apellido: apellido,
            nombre_completo: nombreCompleto,
            telefono: tel,
            email: email,
            dni: dni,
            profesional_habitual: prof,
            motivo_consulta: motivo,
            notas: notas,
            contacto_nombre: contactoNombre,
            contacto_telefono: contactoTel,
            contacto_email: contactoEmail,
            contacto_notas: contactoNotas,
          }),
        });
      } else {
        await api("pacientes.php", {
          method: "POST",
          body: JSON.stringify({
            action: "insert",
            nombre: nombre,
            apellido: apellido,
            nombre_completo: nombreCompleto,
            telefono: tel,
            email: email,
            dni: dni,
            profesional_habitual: prof,
            motivo_consulta: motivo,
            notas: notas,
            contacto_nombre: contactoNombre,
            contacto_telefono: contactoTel,
            contacto_email: contactoEmail,
            contacto_notas: contactoNotas,
            origen: "admin",
          }),
        });
      }
      close();
      await loadPacientes();
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "Guardar Cambios" : "Crear Paciente";
      errorEl.textContent = err.message || "Error al procesar la solicitud";
      errorEl.hidden = false;
    }
  });
}

// Inicialización del módulo de pacientes
export function initPacientesModule() {
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(() => {
        renderPacientesTable();
      }, 150)
    );
  }

  if (profFilter) {
    profFilter.addEventListener("change", (e) => {
      activeFilterProf = e.target.value;
      renderPacientesTable();
    });
  }

  if (btnNuevo) {
    btnNuevo.addEventListener("click", () => {
      openFullPacienteModal();
    });
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
          } catch (_) {}
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
