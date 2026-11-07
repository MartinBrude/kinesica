/**
 * Kinésica Admin — Historial de recordatorios WhatsApp 24h.
 */

import { api } from "./api.js?v=78";
import { switchActiveView, escapeHtml } from "./dom.js?v=78";
import { dialogAlert } from "./dom-dialogs.js?v=77";
import { normalizePhoneForWhatsApp } from "./phone-format.js?v=5";
import { getSessionUser } from "./auth.js?v=83";
import {
  renderRecordatoriosList,
  renderRecordatoriosPager,
  buildRecordatorioPages,
} from "./recordatorios-render.js?v=12";
import {
  filterRecordatoriosList,
  renderRecordatoriosStats,
} from "./recordatorios-filter.js?v=8";
import { renderRecordatoriosRules } from "./recordatorios-rules.js?v=7";
import { setListControlsEnabled } from "./list-controls.js?v=1";

let cachedItems = [];
let cachedCounts = {};
let filteredItems = [];
let currentPage = 0;
let activeStatusFilter = "all";
let autoRefreshTimer = null;
let isRefreshing = false;
let hasLoadedOnce = false;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 60000;

export function isBlockedRecordatorio(item) {
  if (!item || typeof item !== "object") return false;
  const status = String(item.status || "").toLowerCase();
  if (status === "run_skipped") return true;
  const reason = String(item.skip_reason || "").toLowerCase();
  if (reason === "blocked" || reason === "clara_inactive") return true;
  const name = String(item.patient_name || "").toLowerCase();
  const summary = String(item.event_summary || "").toLowerCase();
  return (
    name.includes("no dar") ||
    summary.includes("no dar") ||
    name.includes("bloqueado") ||
    summary.includes("bloqueado")
  );
}

function recalculateCounts() {
  const counts = {
    pending: 0,
    sent: 0,
    sent_email: 0,
    failed: 0,
    missing_phone: 0,
    skipped: 0,
    run_skipped: 0,
  };
  for (const it of cachedItems) {
    if (isBlockedRecordatorio(it)) continue;
    const st = it.status;
    if (counts[st] !== undefined) {
      counts[st]++;
    }
  }
  cachedCounts = counts;
  return counts;
}

export function showRecordatoriosView() {
  const view = switchActiveView("view-recordatorios");
  if (!view) return;
  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "recordatorios" }));
  } catch { /* ignore */ }
  renderRecordatoriosRules(document.getElementById("recordatorios-rules"));

  const isFresh = hasLoadedOnce && (Date.now() - lastLoadedAt < CACHE_TTL_MS);
  if (isFresh) {
    applyFiltersAndRender();
  } else {
    loadRecordatorios(false);
  }
  startAutoRefresh();
}

export function hideRecordatoriosView() {
  const view = document.getElementById("view-recordatorios");
  if (view) view.hidden = true;
  stopAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(() => {
    const view = document.getElementById("view-recordatorios");
    if (
      view &&
      !view.hidden &&
      document.visibilityState === "visible" &&
      !document.querySelector(".recordatorio-modal-backdrop") &&
      Date.now() - lastLoadedAt >= 30000
    ) {
      loadRecordatorios(false);
    }
  }, 45000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function updateHeaderAndTotal(total) {
  const totalEl = document.getElementById("recordatorios-total");
  if (!totalEl) return;
  const countText = `${total} registro${total === 1 ? "" : "s"}`;
  if (isRefreshing) {
    totalEl.innerHTML = `${countText} <span class="recordatorios-reloading-badge"><span class="recordatorios-spinner-sm" aria-hidden="true"></span> Recargando…</span>`;
  } else {
    totalEl.textContent = countText;
  }
}

function applyFiltersAndRender() {
  const container = document.getElementById("recordatorios-list-container");
  const search = document.getElementById("recordatorios-search")?.value || "";

  if (!hasLoadedOnce && isRefreshing) {
    if (container) {
      renderRecordatoriosList(container, [], {
        isLoading: true,
        isRefreshing: true,
        hasLoadedOnce: false,
        totalCached: 0,
        activeStatusFilter,
        searchTerm: search,
      });
    }
    renderRecordatoriosStats(document.getElementById("recordatorios-stats"), {
      counts: cachedCounts,
      activeStatusFilter,
    });
    updateHeaderAndTotal(0);
    return;
  }

  filteredItems = filterRecordatoriosList(cachedItems, search, activeStatusFilter);
  const total = filteredItems.length;
  const pages = buildRecordatorioPages(filteredItems);
  const maxPage = Math.max(0, pages.length - 1);
  if (currentPage > maxPage) currentPage = maxPage;
  const page = pages[currentPage] || { items: [], label: "" };
  const slice = page.items || [];

  renderRecordatoriosList(container, slice, {
    isLoading: false,
    isRefreshing,
    hasLoadedOnce,
    totalCached: cachedItems.length,
    activeStatusFilter,
    searchTerm: search,
  });

  renderRecordatoriosPager(document.getElementById("recordatorios-pager"), {
    currentPage,
    totalPages: Math.max(1, pages.length),
    pageLabel: page.label || "",
    onPageChange: (p) => {
      currentPage = p;
      applyFiltersAndRender();
    },
  });

  const counts = recalculateCounts();
  renderRecordatoriosStats(document.getElementById("recordatorios-stats"), {
    counts,
    activeStatusFilter,
  });

  updateHeaderAndTotal(total);
}

function renderRecordatoriosSync(resp) {
  const el = document.getElementById("recordatorios-sync");
  if (!el) return;
  const sync = resp?.sync;
  const rec = resp?.reconcile && typeof resp.reconcile === "object" ? resp.reconcile : null;
  const status = (sync && sync.status) || (rec && rec.status) || "";
  const imported = sync && typeof sync.imported === "number" ? sync.imported : rec?.imported_last_run;
  const msg = (sync && sync.message) || (rec && rec.message) || "";
  if (!status && imported == null && !msg) {
    el.hidden = true;
    el.textContent = "";
    el.className = "recordatorios-sync";
    return;
  }
  const bits = [];
  if (status === "not_configured") {
    bits.push("Sync n8n: sin configurar");
  } else if (status === "busy") {
    bits.push("Sync n8n: en curso…");
  } else if (status === "partial") {
    bits.push("Sync n8n: parcial");
  } else if (status === "ok") {
    bits.push("Sync n8n: al día");
  } else if (status) {
    bits.push(`Sync n8n: ${status}`);
  }
  if (typeof imported === "number" && imported > 0) {
    bits.push(`+${imported} importado${imported === 1 ? "" : "s"}`);
  }
  if (msg && status !== "ok") {
    bits.push(msg);
  }
  el.textContent = bits.join(" · ");
  el.hidden = bits.length === 0;
  el.className = "recordatorios-sync" + (status === "partial" || status === "not_configured" ? " is-partial" : status === "ok" ? " is-ok" : "");
}

function recordatorioDedupeScore(it) {
  const st = String(it?.status || "");
  let score = 0;
  if (it?.wa_id) score += 8;
  if (it?.email) score += 2;
  if (st === "sent" || st === "sent_email") score += 16;
  else if (st === "pending" && it?.wa_id) score += 6;
  else if (st === "failed") score += 1;
  else if (st === "missing_phone") score -= 4;
  return score;
}

function deduplicateRecordatorios(items) {
  const best = new Map();
  for (const it of items) {
    const calId = (it.calendar_event_id || "").trim();
    const pName = (it.patient_name || "").trim().toLowerCase();
    const apptDate = (it.appointment_date || "").trim();
    const apptTime = (it.appointment_time || "").trim();
    const slotKey = pName && apptDate ? `${pName}|${apptDate}|${apptTime}` : "";
    const key = calId && calId !== "_run" ? `cal:${calId}` : slotKey ? `slot:${slotKey}` : `id:${it.id}`;
    const prev = best.get(key);
    if (!prev || recordatorioDedupeScore(it) > recordatorioDedupeScore(prev)) {
      best.set(key, it);
    }
  }
  return Array.from(best.values());
}

export async function loadRecordatorios(force = false) {
  const container = document.getElementById("recordatorios-list-container");
  const refreshBtn = document.getElementById("btn-refresh-recordatorios");
  if (!container || isRefreshing) return;
  isRefreshing = true;
  const filterRoots = [
    document.querySelector(".recordatorios-toolbar"),
    document.getElementById("recordatorios-stats"),
  ];
  setListControlsEnabled(filterRoots, false);

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `<span class="recordatorios-spinner-sm" aria-hidden="true"></span> Actualizando...`;
    refreshBtn.style.opacity = "0.75";
  }

  if (!hasLoadedOnce || !cachedItems.length) {
    container.innerHTML = `
      <div class="recordatorios-empty is-loading">
        <span class="loading-spinner" aria-hidden="true"></span>
        <p>Cargando recordatorios...</p>
      </div>`;
  }
  updateHeaderAndTotal(filteredItems.length);

  try {
    const syncQ = force ? "&sync=1" : "";
    const resp = await api(`recordatorios.php?days=14${syncQ}&_t=${Date.now()}`, { cache: "no-store" });
    const ok = Boolean(resp && (resp.ok === true || resp.status === "success"));
    if (!ok) {
      if (!cachedItems.length) {
        container.innerHTML = `<div class="recordatorios-empty"><p>No se pudieron cargar los recordatorios.</p></div>`;
      }
      return;
    }
    const rawItems = Array.isArray(resp.items) ? resp.items : [];
    const validItems = rawItems.filter((it) => !isBlockedRecordatorio(it));
    cachedItems = deduplicateRecordatorios(validItems);
    cachedCounts = recalculateCounts();
    hasLoadedOnce = true;
    lastLoadedAt = Date.now();
    renderRecordatoriosSync(resp);
    applyFiltersAndRender();

    if (refreshBtn && force) {
      refreshBtn.textContent = "✓ Actualizado";
      setTimeout(() => {
        if (refreshBtn && !isRefreshing) {
          refreshBtn.textContent = "↻ Actualizar";
          refreshBtn.disabled = false;
          refreshBtn.style.opacity = "1";
        }
      }, 1500);
    }
  } catch {
    if (!cachedItems.length) {
      container.innerHTML = `<div class="recordatorios-empty"><p>Error al cargar recordatorios.</p></div>`;
    }
  } finally {
    isRefreshing = false;
    setListControlsEnabled(filterRoots, true);
    updateHeaderAndTotal(filteredItems.length);
    if (refreshBtn && (!force || refreshBtn.textContent !== "✓ Actualizado")) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "↻ Actualizar";
      refreshBtn.style.opacity = "1";
    }
  }
}

function applyRecordatorioItemUpdate(updatedItem) {
  const idx = cachedItems.findIndex((it) => String(it.id) === String(updatedItem.id));
  if (idx !== -1) {
    cachedItems[idx] = { ...cachedItems[idx], ...updatedItem };
  } else {
    cachedItems.unshift(updatedItem);
  }
  recalculateCounts();
  applyFiltersAndRender();
}

function openRecordatorioContactModal(item, { mode = "contact", onSuccess } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "recordatorio-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");

  const name = escapeHtml(item.patient_name || item.event_summary || "Paciente");
  const appt = escapeHtml(
    [item.appointment_date, item.appointment_time].filter(Boolean).join(" · ") || "Sin fecha/hora"
  );
  const isDispatch = mode === "dispatch";
  const isFailed = item.status === "failed" || item.status === "missing_phone";
  const title = isDispatch
    ? isFailed
      ? "Disparar recordatorio manualmente"
      : "Enviar recordatorio ahora"
    : "Cargar teléfono / email";
  const currentError =
    item.error_message && !String(item.error_message).startsWith("contact_email:")
      ? item.error_message || item.error_code || ""
      : item.error_code || "";
  const missingHint = !item.wa_id
    ? `<p class="recordatorio-modal-hint">Este paciente no tiene WhatsApp en el turno ni en el directorio. Cargalo acá para la ejecución automática y futuros recordatorios.</p>`
    : "";

  backdrop.innerHTML = `
    <div class="recordatorio-modal-card">
      <div class="recordatorio-modal-header">
        <h3>${isDispatch ? "⚡" : "＋"} ${title}</h3>
        <button type="button" class="btn ghost btn-close-modal" aria-label="Cerrar">✕</button>
      </div>
      <div class="recordatorio-modal-body">
        <div class="recordatorio-modal-info">
          <div><strong>Paciente:</strong> ${name}</div>
          <div><strong>Turno:</strong> ${appt}</div>
          ${
            item.event_summary && item.event_summary !== item.patient_name
              ? `<div><strong>Detalle:</strong> ${escapeHtml(item.event_summary)}</div>`
              : ""
          }
          ${
            isFailed && currentError
              ? `<div style="color:#b42318;margin-top:6px;font-size:12px;"><strong>Motivo de fallo previo:</strong> ${escapeHtml(currentError)}</div>`
              : ""
          }
        </div>
        ${missingHint}
        <div class="recordatorio-modal-field">
          <label for="dispatch-phone">WhatsApp (con código de país, ej: 54911…):</label>
          <input type="tel" id="dispatch-phone" value="${escapeHtml(item.wa_id || "")}" placeholder="5491144556677" autocomplete="off" />
        </div>
        <div class="recordatorio-modal-field">
          <label for="dispatch-email">Correo electrónico:</label>
          <input type="email" id="dispatch-email" value="${escapeHtml(item.email || "")}" placeholder="paciente@ejemplo.com" autocomplete="off" />
        </div>
        ${
          isDispatch
            ? `<div class="recordatorio-modal-field">
          <label for="dispatch-channel">Canal de envío:</label>
          <select id="dispatch-channel">
            <option value="whatsapp" ${String(item.calendar_event_id || "").startsWith("test:") ? "selected" : ""}>Solo WhatsApp (Plantilla oficial)</option>
            <option value="auto" ${String(item.calendar_event_id || "").startsWith("test:") ? "" : "selected"}>Automático (WhatsApp con fallback a Email)</option>
            <option value="email">Solo Correo Electrónico</option>
          </select>
        </div>
        <label class="recordatorio-modal-check">
          <input type="checkbox" id="dispatch-save-contact" ${String(item.calendar_event_id || "").startsWith("test:") ? "" : "checked"} />
          Guardar también en el directorio de pacientes
        </label>`
            : `<p class="recordatorio-modal-hint">Se guarda en el directorio de pacientes y en este recordatorio. No envía el mensaje todavía.</p>`
        }
      </div>
      <div class="recordatorio-modal-actions">
        <button type="button" class="btn light btn-close-modal">Cancelar</button>
        ${
          isDispatch
            ? `<button type="button" class="btn green" id="btn-submit-dispatch">⚡ Enviar recordatorio</button>`
            : `<button type="button" class="btn green" id="btn-submit-contact">Guardar contacto</button>
               ${
                 item.status === "pending" ||
                 item.status === "failed" ||
                 item.status === "missing_phone" ||
                 item.status === "skipped"
                   ? `<button type="button" class="btn light" id="btn-submit-contact-send">Guardar y enviar</button>`
                   : ""
               }`
        }
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  const phoneInput = backdrop.querySelector("#dispatch-phone");
  if (!item.wa_id) phoneInput?.focus();
  else backdrop.querySelector("#dispatch-email")?.focus();

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKeyDown);
  backdrop.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", close);
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  const readFields = () => {
    const rawPhone = backdrop.querySelector("#dispatch-phone")?.value.trim() || "";
    const normalized = normalizePhoneForWhatsApp(rawPhone);
    // Aceptar locales AR (ej. 1158236122 → 5491158236122); si no normaliza, mandar dígitos crudos.
    const phone = normalized || rawPhone.replace(/\D/g, "");
    if (normalized && phoneInput && phoneInput.value.trim() !== normalized) {
      phoneInput.value = normalized;
    }
    return {
      phone,
      email: backdrop.querySelector("#dispatch-email")?.value.trim() || "",
      channel: backdrop.querySelector("#dispatch-channel")?.value || "auto",
      saveContact: backdrop.querySelector("#dispatch-save-contact")
        ? !!backdrop.querySelector("#dispatch-save-contact")?.checked
        : true,
    };
  };

  const saveContactOnly = async (btn) => {
    const { phone, email } = readFields();
    if (!phone && !email) {
      dialogAlert("Ingresá al menos un WhatsApp o un correo electrónico.", { type: "danger" });
      return false;
    }
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const resp = await api("recordatorios.php", {
        method: "POST",
        body: JSON.stringify({
          action: "save_contact",
          id: item.id,
          wa_id: phone,
          email,
        }),
      });
      if (resp && (resp.ok || resp.status === "success")) {
        if (resp.item) onSuccess?.(resp.item);
        else loadRecordatorios(false);
        return resp;
      }
      dialogAlert(resp?.error || "No se pudo guardar el contacto.", { type: "danger" });
      return false;
    } catch (err) {
      dialogAlert(
        (err && (err.payload?.error || err.message)) || "Error al guardar el contacto.",
        { type: "danger" }
      );
      return false;
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  };

  const dispatchSend = async (btn, { phone, email, channel, saveContact }) => {
    if (channel === "email" && !email) {
      dialogAlert("Ingresá un correo válido para enviar por email.", { type: "danger" });
      return;
    }
    if (channel === "whatsapp" && !phone) {
      dialogAlert("Ingresá un número de WhatsApp.", { type: "danger" });
      return;
    }
    if (channel === "auto" && !phone && !email) {
      dialogAlert("Ingresá al menos un WhatsApp o un correo.", { type: "danger" });
      return;
    }
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Enviando…";
    try {
      const resp = await api("recordatorios.php", {
        method: "POST",
        body: JSON.stringify({
          action: "dispatch",
          id: item.id,
          wa_id: phone,
          email,
          channel,
          save_contact: saveContact,
        }),
      });
      if (resp && (resp.ok || resp.status === "success")) {
        close();
        if (resp.item) onSuccess?.(resp.item);
        else loadRecordatorios(false);
        dialogAlert(resp.message || "Recordatorio enviado correctamente.", { type: "success" });
      } else {
        dialogAlert(resp?.error || "No se pudo enviar el recordatorio.", { type: "danger" });
      }
    } catch (err) {
      dialogAlert(
        (err && (err.payload?.error || err.message)) ||
          "Error al conectar con el servidor para disparar el recordatorio.",
        { type: "danger" }
      );
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  };

  backdrop.querySelector("#btn-submit-contact")?.addEventListener("click", async (e) => {
    const resp = await saveContactOnly(e.currentTarget);
    if (resp) {
      close();
      dialogAlert(resp.message || "Contacto guardado.", { type: "success" });
    }
  });

  backdrop.querySelector("#btn-submit-contact-send")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const fields = readFields();
    const saved = await saveContactOnly(btn);
    if (!saved) return;
    await dispatchSend(btn, { ...fields, saveContact: false, channel: fields.phone ? "auto" : "email" });
  });

  backdrop.querySelector("#btn-submit-dispatch")?.addEventListener("click", async (e) => {
    await dispatchSend(e.currentTarget, readFields());
  });
}

function openRecordatorioDispatchModal(item, onSuccess) {
  openRecordatorioContactModal(item, { mode: "dispatch", onSuccess });
}

const TEST_CONTACT_STORAGE_KEY = "kinesica_recordatorio_test_contact";

const TEST_CONTACT_DEFAULTS = {
  martin: { name: "Martín Brude", phone: "34658444935" },
  norberto: { name: "Norberto Brude", phone: "5491161564311" },
};

function readStoredTestContact() {
  try {
    const raw = localStorage.getItem(TEST_CONTACT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      name: String(parsed.name || "").trim(),
      phone: String(parsed.phone || "").trim(),
    };
  } catch {
    return null;
  }
}

function storeTestContact(name, phone) {
  try {
    localStorage.setItem(TEST_CONTACT_STORAGE_KEY, JSON.stringify({ name, phone }));
  } catch {
    /* ignore */
  }
}

function resolveTestContactDefaults(user) {
  const username = String(user?.username || "").toLowerCase().trim();
  const display = String(user?.name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (TEST_CONTACT_DEFAULTS[username]) return TEST_CONTACT_DEFAULTS[username];
  if (display.includes("norberto")) return TEST_CONTACT_DEFAULTS.norberto;
  if (display.includes("martin")) return TEST_CONTACT_DEFAULTS.martin;
  return null;
}

function defaultTestContact() {
  const stored = readStoredTestContact();
  if (stored?.name && stored?.phone) return stored;
  const user = getSessionUser();
  const known = resolveTestContactDefaults(user);
  if (known) {
    return {
      name: stored?.name || known.name,
      phone: stored?.phone || known.phone,
    };
  }
  return {
    name: stored?.name || String(user?.name || "").trim() || "",
    phone: stored?.phone || "",
  };
}

function markTestFieldError(input, message) {
  if (!input) return;
  input.setAttribute("aria-invalid", "true");
  input.style.borderColor = "#b42318";
  input.style.boxShadow = "0 0 0 2px rgba(180, 35, 24, 0.15)";
  input.focus();
  const field = input.closest(".recordatorio-modal-field");
  let err = field?.querySelector(".recordatorio-modal-field-error");
  if (field && !err) {
    err = document.createElement("p");
    err.className = "recordatorio-modal-field-error";
    err.style.cssText = "margin:0;font-size:12px;color:#b42318;";
    field.appendChild(err);
  }
  if (err) err.textContent = message;
}

function clearTestFieldError(input) {
  if (!input) return;
  input.removeAttribute("aria-invalid");
  input.style.borderColor = "";
  input.style.boxShadow = "";
  input.closest(".recordatorio-modal-field")?.querySelector(".recordatorio-modal-field-error")?.remove();
}

function openTestCaseModal() {
  document.querySelectorAll(".recordatorio-modal-backdrop[data-test-case-modal]").forEach((el) => el.remove());

  const defaults = defaultTestContact();
  const backdrop = document.createElement("div");
  backdrop.className = "recordatorio-modal-backdrop";
  backdrop.dataset.testCaseModal = "1";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-labelledby", "test-case-modal-title");
  // Estilos inline: el modal tiene que verse aunque el CSS del admin esté cacheado.
  backdrop.style.cssText =
    "position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;" +
    "padding:16px;background:rgba(11,37,69,.55);";
  backdrop.innerHTML = `
    <div class="recordatorio-modal-card" style="background:#fff;border:1px solid #d7dee7;border-radius:12px;max-width:500px;width:100%;box-shadow:0 16px 36px rgba(11,37,69,.2);padding:24px;display:flex;flex-direction:column;gap:16px;">
      <div class="recordatorio-modal-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h3 id="test-case-modal-title" style="margin:0;font-size:17px;">＋ Caso de prueba</h3>
        <button type="button" class="btn ghost btn-close-modal" aria-label="Cerrar">✕</button>
      </div>
      <div class="recordatorio-modal-body" style="display:flex;flex-direction:column;gap:12px;font-size:13px;">
        <p class="recordatorio-modal-hint" style="margin:0;font-size:12px;line-height:1.45;color:#5b6b7c;">Completá nombre y WhatsApp para crear un pending de prueba. No se guarda en el directorio de pacientes.</p>
        <div class="recordatorio-modal-field" style="display:flex;flex-direction:column;gap:4px;">
          <label for="test-case-name" style="font-weight:600;font-size:12px;">Nombre</label>
          <input type="text" id="test-case-name" value="${escapeHtml(defaults.name)}" placeholder="Nombre del destinatario" autocomplete="name" required style="padding:9px 12px;border:1px solid #d7dee7;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>
        <div class="recordatorio-modal-field" style="display:flex;flex-direction:column;gap:4px;">
          <label for="test-case-phone" style="font-weight:600;font-size:12px;">WhatsApp (con código de país)</label>
          <input type="tel" id="test-case-phone" value="${escapeHtml(defaults.phone)}" placeholder="54911… o 346…" autocomplete="tel" required style="padding:9px 12px;border:1px solid #d7dee7;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>
      </div>
      <div class="recordatorio-modal-actions" style="display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:8px;">
        <button type="button" class="btn light btn-close-modal">Cancelar</button>
        <button type="button" class="btn green" id="btn-submit-test-case">Crear caso</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  const nameInput = backdrop.querySelector("#test-case-name");
  const phoneInput = backdrop.querySelector("#test-case-phone");
  (defaults.name ? phoneInput : nameInput)?.focus();
  nameInput?.addEventListener("input", () => clearTestFieldError(nameInput));
  phoneInput?.addEventListener("input", () => clearTestFieldError(phoneInput));

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKeyDown);
  backdrop.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", close);
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelector("#btn-submit-test-case")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const name = nameInput?.value.trim() || "";
    const rawPhone = phoneInput?.value.trim() || "";
    const normalized = normalizePhoneForWhatsApp(rawPhone);
    const phone = normalized || rawPhone.replace(/\D/g, "");
    if (normalized && phoneInput && phoneInput.value.trim() !== normalized) {
      phoneInput.value = normalized;
    }
    clearTestFieldError(nameInput);
    clearTestFieldError(phoneInput);
    if (!name) {
      markTestFieldError(nameInput, "Ingresá el nombre del destinatario.");
      return;
    }
    if (!phone || phone.length < 8) {
      markTestFieldError(phoneInput, "Ingresá un WhatsApp válido (con código de país).");
      return;
    }

    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Creando…";
    try {
      const resp = await api("recordatorios.php", {
        method: "POST",
        body: JSON.stringify({
          action: "create_test_case",
          patient_name: name,
          phone,
        }),
      });
      if (resp && (resp.ok || resp.status === "success")) {
        storeTestContact(name, phone);
        close();
        if (resp.item) applyRecordatorioItemUpdate(resp.item);
        else await loadRecordatorios(false);
        dialogAlert(resp.message || "Caso de prueba listo. Usá «Enviar ahora».", { type: "success" });
        return;
      }
      dialogAlert(resp?.error || "No se pudo crear el caso de prueba.", { type: "danger" });
    } catch (err) {
      dialogAlert(
        (err && (err.payload?.error || err.message)) || "Error al crear el caso de prueba.",
        { type: "danger" }
      );
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
}

export function initRecordatoriosModule() {
  renderRecordatoriosRules(document.getElementById("recordatorios-rules"));
  const testBtn =
    document.getElementById("btn-test-recordatorio") ||
    document.getElementById("btn-test-recordatorio-martin");
  if (testBtn) {
    const user = getSessionUser();
    const canTest = user?.role === "admin" || user?.username === "martin" || user?.username === "norberto";
    testBtn.hidden = !canTest;
    testBtn.id = "btn-test-recordatorio";
    testBtn.textContent = "＋ Caso de prueba";
    testBtn.title = "Crear un pending configurable para probar el envío manual por WhatsApp";
    testBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (isRefreshing) return;
      openTestCaseModal();
    });
  }
  document.getElementById("btn-refresh-recordatorios")?.addEventListener("click", () => {
    loadRecordatorios(true);
  });
  document.getElementById("recordatorios-search")?.addEventListener("input", () => {
    if (isRefreshing) return;
    currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-stats")?.addEventListener("click", (e) => {
    if (isRefreshing) return;
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    const next = btn.getAttribute("data-filter") || "all";
    activeStatusFilter = activeStatusFilter === next ? "all" : next;
    currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-list-container")?.addEventListener("click", (e) => {
    const resetBtn = e.target.closest('[data-action="reset-filters"]');
    if (resetBtn) {
      activeStatusFilter = "all";
      const searchInput = document.getElementById("recordatorios-search");
      if (searchInput) searchInput.value = "";
      currentPage = 0;
      applyFiltersAndRender();
      return;
    }
    const contactBtn = e.target.closest('[data-action="save-contact"]');
    if (contactBtn) {
      const id = contactBtn.getAttribute("data-id");
      const item = cachedItems.find((it) => String(it.id) === String(id));
      if (!item) return;
      openRecordatorioContactModal(item, {
        mode: "contact",
        onSuccess: applyRecordatorioItemUpdate,
      });
      return;
    }
    const btn = e.target.closest('[data-action="dispatch-manual"]');
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const item = cachedItems.find((it) => String(it.id) === String(id));
    if (!item) return;
    openRecordatorioDispatchModal(item, applyRecordatorioItemUpdate);
  });
}
