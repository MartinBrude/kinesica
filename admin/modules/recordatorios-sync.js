/**
 * Indicador sync n8n.
 */

export function renderRecordatoriosSync(resp) {
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
