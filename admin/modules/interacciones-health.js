/**
 * Kinésica Admin - Indicador de salud de Interacciones.
 * Muestra (solo lectura) cuándo llegó el último mensaje y si hay algo pendiente de importar,
 * para que sea evidente si el flujo WhatsApp → panel se interrumpe.
 */

function relativeTime(iso) {
  const ts = Date.parse(iso || "");
  if (!Number.isFinite(ts)) return "";
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "hace instantes";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

function absoluteTime(iso) {
  const ts = Date.parse(iso || "");
  return Number.isFinite(ts)
    ? new Date(ts).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
}

export function buildHealthParts(health, sync) {
  const parts = [];
  if (!health) return parts;
  if (health.last_message_at) {
    parts.push({ text: `Último mensaje recibido: ${absoluteTime(health.last_message_at)} (${relativeTime(health.last_message_at)})` });
  } else {
    parts.push({ text: "Aún no hay mensajes registrados" });
  }
  if (Number(health.spool_pending) > 0) {
    parts.push({ text: `⚠️ ${health.spool_pending} mensaje(s) en cola local; se importan solos`, warn: true });
  }
  const rec = health.reconcile;
  const status = sync?.status || rec?.status;
  if (status === "ok" && (rec?.last_ok || rec?.last_run)) {
    parts.push({ text: `✓ Verificado con n8n ${relativeTime(rec.last_ok || rec.last_run)}` });
  } else if (status === "partial") {
    parts.push({ text: "⚠️ Verificación con n8n incompleta; se reintenta sola", warn: true });
  }
  return parts;
}

export function renderInteraccionesHealth(anchorEl, health, sync) {
  if (!anchorEl) return;
  let el = document.getElementById("interacciones-health");
  if (!el) {
    el = document.createElement("div");
    el.id = "interacciones-health";
    el.style.cssText = "font-size:12px;color:var(--muted);margin:4px 0 8px;display:flex;flex-wrap:wrap;gap:4px 14px;";
    anchorEl.insertAdjacentElement("afterend", el);
  }
  el.replaceChildren(
    ...buildHealthParts(health, sync).map(({ text, warn }) => {
      const span = document.createElement("span");
      span.textContent = text;
      if (warn) span.style.color = "#b45309";
      return span;
    }),
  );
}
