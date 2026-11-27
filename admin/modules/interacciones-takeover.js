/**
 * Takeover humano de Clara (pausa 30 min + reply) — helpers UI.
 */
import { escapeHtml } from "./dom.js?v=79";

export function formatTakeoverUntilBa(pausedUntil) {
  const raw = String(pausedUntil || "").trim();
  if (!raw) return "";
  const iso = /Z$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
}

export function canUseTakeoverUi(conv, sessionUser) {
  if (!conv) return false;
  if (sessionUser?.role === "colaborador") return false;
  const isIg = conv.channel === "instagram" || String(conv.wa_id || "").startsWith("ig_");
  return !isIg && String(conv.wa_id || "").replace(/\D+/g, "").length >= 6;
}

export function buildTakeoverControlsHtml(conv, convKey) {
  const active = Boolean(conv?.takeover_active);
  const until = formatTakeoverUntilBa(conv?.takeover?.paused_until);
  const untilHint = until ? ` hasta ${until} hs (BA)` : " (30 min)";
  const wa = escapeHtml(String(conv?.wa_id || "").replace(/\D+/g, ""));
  const id = escapeHtml(String(conv?.id || convKey));
  if (active) {
    return `
      <button type="button" class="btn-takeover-control is-active"
        data-takeover-action="end" data-wa-id="${wa}" data-conv-id="${id}"
        title="Clara vuelve a atender este contacto">
        Devolver a Clara
      </button>
      <span class="interaccion-status-pill takeover" title="Clara en silencio para este contacto">
        Clara en silencio${escapeHtml(untilHint)}
      </span>`;
  }
  return `
    <button type="button" class="btn-takeover-control"
      data-takeover-action="start" data-wa-id="${wa}" data-conv-id="${id}"
      title="Clara deja de responder a este contacto por 30 minutos">
      Tomar control
    </button>`;
}

export function buildTakeoverComposerHtml(conv, convKey) {
  if (!conv?.takeover_active) return "";
  const wa = escapeHtml(String(conv?.wa_id || "").replace(/\D+/g, ""));
  const id = escapeHtml(String(conv?.id || convKey));
  const until = formatTakeoverUntilBa(conv?.takeover?.paused_until);
  const untilLine = until
    ? `Clara no responde a este contacto hasta las ${escapeHtml(until)} hs (BA).`
    : "Clara no responde a este contacto (30 min).";
  return `
    <div class="interaccion-takeover-composer" data-conv-id="${id}">
      <p class="interaccion-takeover-hint">${untilLine} Los mensajes nuevos del paciente aparecen al refrescar.</p>
      <textarea class="interaccion-takeover-input" rows="2" maxlength="2000"
        placeholder="Escribí como Clara…" data-wa-id="${wa}" data-conv-id="${id}"></textarea>
      <div class="interaccion-takeover-actions">
        <button type="button" class="btn-takeover-send" data-takeover-action="reply"
          data-wa-id="${wa}" data-conv-id="${id}">Enviar como Clara</button>
      </div>
    </div>`;
}

/** Aplica fila takeover al item del cache (mutación in-place). */
export function applyTakeoverToConv(conv, takeoverRow, active) {
  if (!conv) return;
  if (active && takeoverRow) {
    conv.takeover_active = true;
    conv.takeover = {
      wa_id: String(takeoverRow.wa_id || conv.wa_id || ""),
      paused_at: String(takeoverRow.paused_at || ""),
      paused_until: String(takeoverRow.paused_until || ""),
      paused_by: String(takeoverRow.paused_by || ""),
    };
    return;
  }
  conv.takeover_active = false;
  conv.takeover = null;
}

export function appendClaraReplyToConv(conv, body, tsSec) {
  if (!conv) return;
  if (!Array.isArray(conv.messages)) conv.messages = [];
  const ts = Number(tsSec) || Math.floor(Date.now() / 1000);
  const d = new Date(ts * 1000);
  let time = "";
  try {
    time = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  conv.messages.push({
    from: "clara",
    time,
    text: String(body || ""),
    ts: new Date(ts * 1000).toISOString(),
  });
}
