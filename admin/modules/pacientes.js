/**
 * Kinésica Admin - Módulo de Gestión de Pacientes y Directorio de Teléfonos
 * Permite buscar, ver, dar de alta y editar teléfonos para WhatsApp y recordatorios.
 */

import { api } from "./api.js?v=79";
import { escapeHtml, debounce, dialogAlert, dialogConfirm, switchActiveView } from "./dom.js?v=79";
import { phoneMatches } from "./phone-search.js?v=3";
import { formatDisplayPhone, capitalizePersonName } from "./pacientes-format.js";
import { openFullPacienteModal } from "./pacientes-modal.js?v=2";
import { getSessionUser } from "./auth.js?v=83";
import { invalidateDirectoryCache } from "./form-patient.js";
import { setListControlsEnabled } from "./list-controls.js?v=1";

export { formatDisplayPhone };

export const GOOGLE_REVIEW_INVITE_URL = "https://search.google.com/local/writereview?placeid=ChIJZ2mPW9K1vJUR3J5kGRi5gws";

/**
 * Extrae y formatea el nombre de pila del paciente garantizando que esté cargado.
 * @param {object} p
 * @returns {string}
 */
export function getPatientFirstName(p) {
  let raw = (p?.nombre_pila || "").trim();
  if (!raw) {
    const formatted = formatPatientName(p);
    raw = (formatted?.nombre || "").trim();
  }
  if (!raw && p?.nombre) {
    raw = String(p.nombre).trim();
  }
  if (!raw && p?.nombre_completo) {
    const clean = String(p.nombre_completo).trim().replace(/^(lic\.|dr\.|dra\.|sr\.|sra\.)\s+/i, "");
    if (clean.includes(",")) {
      const parts = clean.split(",");
      raw = (parts[1] || parts[0]).trim();
    } else {
      raw = clean;
    }
  }

  if (!raw || raw.toLowerCase() === "paciente" || raw.toLowerCase() === "sin nombre") {
    return "";
  }

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  let first = words[0];
  if (words.length >= 2) {
    const compound = first.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (["maria", "juan", "ana", "jose"].includes(compound)) {
      first = `${first} ${words[1]}`;
    }
  }

  return first
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Genera el mensaje personalizado de WhatsApp para invitar al paciente a dejar una reseña.
 * @param {object} p
 * @returns {string}
 */
export function buildReviewInviteMessage(p) {
  const firstName = getPatientFirstName(p);
  const saludo = firstName ? `Hola ${firstName}!` : "Hola!";
  return `${saludo}\nTe escribo de Kinésica. Esperamos que te estés sintiendo muy bien.\nSi tenés un minuto, nos ayudaría mucho a crecer una breve reseña de tu experiencia: ${GOOGLE_REVIEW_INVITE_URL}\n¡Muchas gracias por tu apoyo!`;
}

/**
 * Determina si ya se envió la invitación a la encuesta vía Clara.
 * @param {object} p
 * @returns {boolean}
 */
export function patientEncuestaEnviada(p) {
  return Boolean(p && (Number(p.encuesta_enviada) === 1 || p.encuesta_enviada === true || p.encuesta_enviada === "1"));
}

/**
 * Determina si un paciente ya dejó una reseña (por flag manual o match con Google Reviews).
 * @param {object} p
 * @returns {boolean}
 */
export function patientHasReview(p) {
  if (p && (Number(p.dejo_review) === 1 || p.dejo_review === true || p.dejo_review === "1")) {
    return true;
  }
  const reviews = typeof window !== "undefined" && window.KINESICA_GOOGLE_REVIEWS?.reviews;
  if (!Array.isArray(reviews) || reviews.length === 0) return false;

  const normalize = (str) =>
    String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

  const pFull = normalize(p?.nombre_completo || `${p?.nombre || ""} ${p?.apellido || ""}`);
  const pNom = normalize(p?.nombre || "");
  const pAp = normalize(p?.apellido || "");

  return reviews.some((r) => {
    const auth = normalize(r?.author || "");
    if (!auth) return false;
    if (pFull && (auth === pFull || auth.includes(pFull) || pFull.includes(auth))) return true;
    if (pNom && pAp && auth.includes(pNom) && auth.includes(pAp)) return true;
    return false;
  });
}

const viewPacientes = typeof document !== "undefined" ? document.querySelector("#view-pacientes") : null;
const listEl = typeof document !== "undefined" ? document.querySelector("#pacientes-list-tbody") : null;
const searchInput = typeof document !== "undefined" ? document.querySelector("#search-pacientes") : null;
const profFilter = typeof document !== "undefined" ? document.querySelector("#filter-pacientes-prof") : null;
const btnNuevo = typeof document !== "undefined" ? document.querySelector("#btn-nuevo-paciente") : null;
const btnBackupSql = typeof document !== "undefined" ? document.querySelector("#btn-backup-sql") : null;
const countEl = typeof document !== "undefined" ? document.querySelector("#pacientes-total-count") : null;

let pacientesCache = [];
let activeFilterProf = "todos";

export function showPacientesView() {
  const isColaborador = getSessionUser()?.role === "colaborador";
  if (btnNuevo) btnNuevo.hidden = isColaborador;
  const view = switchActiveView("view-pacientes");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "pacientes" }));
    } catch { /* ignore */ }
    loadPacientes();
  }
}

export function hidePacientesView() {
  if (viewPacientes) viewPacientes.hidden = true;
}

/**
 * Genera una clave canónica a partir del nombre del paciente (ignorando acentos, orden y prefijos honoríficos).
 * @param {string} str
 * @returns {string}
 */
export function canonicalPatientNameKey(str) {
  if (!str) return "";
  let s = String(str).trim();
  s = s.replace(/^(?:lic\.|lic|dr\.|dr|dra\.|dra|sr\.|sr|sra\.|sra)\s+/iu, "");
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, " ");
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  if (tokens.length >= 2) tokens.sort();
  return tokens.join(" ");
}

/**
 * Limpia y normaliza el DNI del paciente.
 * @param {string|number|null} raw
 * @returns {string}
 */
export function cleanPatientDni(raw) {
  if (!raw) return "";
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "no provisto" || s === "null") return "";
  const digits = s.replace(/\D/g, "");
  return digits.length >= 5 ? digits : "";
}

/**
 * Determina si el número es un identificador placeholder temporal.
 * @param {string} phone
 * @returns {boolean}
 */
export function isPlaceholderPhone(phone) {
  const p = String(phone || "").trim();
  if (!p) return true;
  return p.startsWith("sin-tel-") || p.startsWith("sin-tel") || p.startsWith("sin-telefono") || p.startsWith("ficha-");
}

/**
 * Deduplica una lista de pacientes en memoria consolidando según las reglas de negocio:
 * - "si uno dice con review y otro sin, queda que si"
 * - "si uno dice indistinto y otro dice con tal, queda tal"
 * - teléfono real prevalece sobre placeholder
 * - preserva DNI, email, motivos y notas
 * @param {Array} items
 * @returns {Array}
 */
export function deduplicatePatientsInMemory(items = []) {
  if (!Array.isArray(items) || items.length <= 1) return items || [];

  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    if (parent[i] === i) return i;
    return (parent[i] = find(parent[i]));
  };
  const union = (i, j) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  };

  const byDni = new Map();
  const byName = new Map();
  const byPhone = new Map();

  items.forEach((p, idx) => {
    let dni = cleanPatientDni(p.dni);
    if (!dni && String(p.telefono || "").startsWith("sin-tel-dni-")) {
      dni = String(p.telefono).slice(12);
    }
    if (dni) {
      if (byDni.has(dni)) union(idx, byDni.get(dni));
      else byDni.set(dni, idx);
    }

    const rawPhone = String(p.telefono || "").trim();
    const cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone && !isPlaceholderPhone(rawPhone)) {
      if (byPhone.has(cleanPhone)) union(idx, byPhone.get(cleanPhone));
      else byPhone.set(cleanPhone, idx);
    }

    const full = (p.nombre_completo || "").trim() || `${p.nombre || ""} ${p.apellido || ""}`.trim();
    const nameKey = canonicalPatientNameKey(full);
    // Homónimos con WhatsApp reales distintos no se unen solo por nombre.
    if (nameKey && nameKey.includes(" ")) {
      if (byName.has(nameKey)) {
        const other = items[byName.get(nameKey)];
        const otherPhone = String(other?.telefono || "").trim();
        const otherClean = otherPhone.replace(/\D/g, "");
        const aReal = cleanPhone && !isPlaceholderPhone(rawPhone);
        const bReal = otherClean && !isPlaceholderPhone(otherPhone);
        if (!(aReal && bReal && cleanPhone !== otherClean)) {
          union(idx, byName.get(nameKey));
        }
      } else {
        byName.set(nameKey, idx);
      }
    }
  });

  const clusters = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(items[i]);
  }

  const result = [];
  for (const cluster of clusters.values()) {
    if (cluster.length === 1) {
      result.push(cluster[0]);
      continue;
    }

    cluster.sort((a, b) => {
      const aReal = !isPlaceholderPhone(a.telefono);
      const bReal = !isPlaceholderPhone(b.telefono);
      if (aReal !== bReal) return aReal ? -1 : 1;

      const aReview = Boolean(a.dejo_review && Number(a.dejo_review) !== 0);
      const bReview = Boolean(b.dejo_review && Number(b.dejo_review) !== 0);
      if (aReview !== bReview) return aReview ? -1 : 1;

      const aProf = a.profesional_habitual === "norberto" || a.profesional_habitual === "maria";
      const bProf = b.profesional_habitual === "norberto" || b.profesional_habitual === "maria";
      if (aProf !== bProf) return aProf ? -1 : 1;

      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    const survivor = { ...cluster[0] };

    // Regla: si uno dice con review y otro sin, queda que si
    const hasReview = cluster.some((p) => Boolean(p.dejo_review && Number(p.dejo_review) !== 0));
    survivor.dejo_review = hasReview ? 1 : 0;

    // Regla: si uno dice indistinto y otro dice con tal, queda tal.
    // Si no fue asignado a ninguno, indistinto es un valor completamente válido.
    const specificProf = cluster.find((p) => p.profesional_habitual === "norberto" || p.profesional_habitual === "maria");
    survivor.profesional_habitual = specificProf ? specificProf.profesional_habitual : "indistinto";

    // Teléfono: real sobre placeholder
    const realPhoneRecord = cluster.find((p) => !isPlaceholderPhone(p.telefono));
    if (realPhoneRecord) {
      survivor.telefono = realPhoneRecord.telefono;
    }

    // DNI
    if (!survivor.dni) {
      const withDni = cluster.find((p) => cleanPatientDni(p.dni));
      if (withDni) survivor.dni = cleanPatientDni(withDni.dni);
    }

    // Email
    if (!survivor.email) {
      const withEmail = cluster.find((p) => p.email && String(p.email).includes("@"));
      if (withEmail) survivor.email = withEmail.email;
    }

    // Motivo
    const motivos = cluster.map((p) => (p.motivo_consulta || "").trim()).filter(Boolean);
    if (motivos.length > 0) {
      survivor.motivo_consulta = Array.from(new Set(motivos)).join(" / ");
    }

    // Notas
    const notasList = cluster.map((p) => (p.notas || "").trim()).filter(Boolean);
    if (notasList.length > 0) {
      survivor.notas = Array.from(new Set(notasList)).join("\n");
    }

    // Contacto
    if (!survivor.contacto_nombre) {
      const withContact = cluster.find((p) => p.contacto_nombre);
      if (withContact) {
        survivor.contacto_nombre = withContact.contacto_nombre;
        survivor.contacto_telefono = withContact.contacto_telefono || survivor.contacto_telefono;
        survivor.contacto_email = withContact.contacto_email || survivor.contacto_email;
        survivor.contacto_notas = withContact.contacto_notas || survivor.contacto_notas;
      }
    }

    // Nombre con acento
    const accentedName = cluster.find((p) => /[áéíóúÁÉÍÓÚñÑ]/.test(p.nombre_completo || ""));
    if (accentedName && !/[áéíóúÁÉÍÓÚñÑ]/.test(survivor.nombre_completo || "")) {
      survivor.nombre_completo = accentedName.nombre_completo;
      if (accentedName.nombre) survivor.nombre = accentedName.nombre;
      if (accentedName.apellido) survivor.apellido = accentedName.apellido;
    }

    result.push(survivor);
  }

  return result;
}

export async function loadPacientes() {
  if (!listEl) return;
  const toolbar = document.querySelector(".pacientes-toolbar");
  setListControlsEnabled(toolbar, false, { extra: [searchInput, profFilter] });
  listEl.innerHTML = `<tr><td colspan="6" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando directorio de pacientes…</span></td></tr>`;
  try {
    const res = await api("pacientes.php");
    const raw = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    const deduplicated = deduplicatePatientsInMemory(raw);
    pacientesCache = deduplicated;
    invalidateDirectoryCache();
    renderPacientesTable();

    // Dedupe en memoria alcanza para la UI. No disparar POST deduplicate en cada
    // carga: competía con el alta y podía timeout/ocultar pacientes recién creados.
  } catch (err) {
    listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #dc2626;">Error al cargar pacientes: ${escapeHtml(err.message)}</td></tr>`;
  } finally {
    setListControlsEnabled(toolbar, true, { extra: [searchInput, profFilter] });
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
        nom = parts.slice(0, parts.length > 2 ? 2 : 1).join(" ");
        ap = parts.slice(parts.length > 2 ? 2 : 1).join(" ");
      }
    }
  }

  ap = capitalizePersonName(ap);
  nom = capitalizePersonName(nom);

  let display = "";
  if (ap && nom) display = `${ap}, ${nom}`;
  else if (ap) display = ap;
  else if (nom) display = nom;
  else display = capitalizePersonName((p?.nombre_completo || "").trim()) || "Paciente";

  return { apellido: ap, nombre: nom, display };
}

function filterPacientes() {
  const query = (searchInput?.value || "").toLowerCase().trim();
  const list = pacientesCache.filter((p) => {
    if (activeFilterProf !== "todos" && p.profesional_habitual !== activeFilterProf) return false;
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
      <td><div class="phone-cell">${cleanDigits ? `<a class="phone-link" href="${waLink}" target="_blank" rel="noopener" title="Abrir chat de WhatsApp (${escapeHtml(displayTel)})">WhatsApp</a>` : '<span style="color:var(--muted)">Sin teléfono</span>'}</div></td>
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
          pacientesCache = pacientesCache.filter((p) => String(p.id) !== String(btn.dataset.id));
          invalidateDirectoryCache();
          renderPacientesTable();
        } catch (err) {
          dialogAlert(`No se pudo eliminar el paciente: ${err.message}`);
        }
      }
    });
  });
}

export function initPacientesModule() {
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => renderPacientesTable(), 150));
  }
  if (profFilter) {
    profFilter.addEventListener("change", (e) => {
      activeFilterProf = e.target.value;
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
