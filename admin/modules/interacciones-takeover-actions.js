/**
 * Handlers POST de takeover / reply para la bandeja de Interacciones.
 */
import { api } from "./api.js?v=79";
import { toast } from "./dom.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import {
  getCachedInteractions,
  setCachedInteractions,
  bumpPendingMutations,
} from "./interacciones-state.js";
import { applyTakeoverToConv, appendClaraReplyToConv } from "./interacciones-takeover.js?v=1";

function findConv(list, convId, waId) {
  return list.find((i) => i.id === convId)
    || list.find((i) => String(i.wa_id || "").replace(/\D+/g, "") === waId)
    || null;
}

export function createTakeoverHandlers({ applyFilters }) {
  return {
    onTakeover: async ({ action, waId, convId, btn }) => {
      if (getSessionUser()?.role === "colaborador") return;
      if (!waId || (action !== "start" && action !== "end")) return;
      const list = [...getCachedInteractions()];
      const targetConv = findConv(list, convId, waId);
      const prevActive = Boolean(targetConv?.takeover_active);
      const prevTakeover = targetConv?.takeover ? { ...targetConv.takeover } : null;
      if (targetConv) {
        if (action === "start") {
          applyTakeoverToConv(targetConv, {
            wa_id: waId,
            paused_at: new Date().toISOString().slice(0, 19).replace("T", " "),
            paused_until: new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "),
            paused_by: getSessionUser()?.name || "admin",
          }, true);
        } else {
          applyTakeoverToConv(targetConv, null, false);
        }
        setCachedInteractions(list);
        applyFilters(false);
      }
      if (btn) btn.disabled = true;
      bumpPendingMutations(1);
      try {
        const resp = await api("interacciones.php", {
          method: "POST",
          body: JSON.stringify({
            action: action === "start" ? "takeover_start" : "takeover_end",
            wa_id: waId,
          }),
        });
        if (!resp || !resp.ok) throw new Error(resp?.error || "Error al actualizar takeover");
        if (targetConv && action === "start") {
          applyTakeoverToConv(targetConv, resp, true);
          setCachedInteractions(list);
          applyFilters(false);
        }
        toast(
          action === "start"
            ? "Clara en silencio para este contacto (30 min)."
            : "Clara volvió a este chat.",
          { type: "success" }
        );
      } catch (err) {
        if (targetConv) {
          applyTakeoverToConv(targetConv, prevTakeover, prevActive);
          setCachedInteractions(list);
          applyFilters(false);
        }
        console.error("Error takeover:", err);
        toast(err?.message || "No se pudo cambiar el control de Clara.", { type: "danger" });
      } finally {
        bumpPendingMutations(-1);
        if (btn) btn.disabled = false;
      }
    },

    onTakeoverReply: async ({ waId, convId, body, input, btn }) => {
      if (getSessionUser()?.role === "colaborador") return;
      if (!waId || !body) {
        toast("Escribí un mensaje antes de enviar.", { type: "info" });
        return;
      }
      if (btn) btn.disabled = true;
      bumpPendingMutations(1);
      try {
        const resp = await api("interacciones.php", {
          method: "POST",
          body: JSON.stringify({ action: "reply", wa_id: waId, body }),
        });
        if (!resp || !resp.ok) throw new Error(resp?.error || "No se pudo enviar");
        const list = [...getCachedInteractions()];
        const targetConv = findConv(list, convId, waId);
        if (targetConv) {
          if (resp.takeover) applyTakeoverToConv(targetConv, resp.takeover, true);
          else applyTakeoverToConv(targetConv, { wa_id: waId }, true);
          appendClaraReplyToConv(targetConv, resp.body || body, resp.ts);
          setCachedInteractions(list);
          applyFilters(false);
        }
        if (input) input.value = "";
        toast("Mensaje enviado como Clara.", { type: "success" });
      } catch (err) {
        console.error("Error reply takeover:", err);
        toast(err?.message || "No se pudo enviar el mensaje.", { type: "danger" });
      } finally {
        bumpPendingMutations(-1);
        if (btn) btn.disabled = false;
      }
    },
  };
}
