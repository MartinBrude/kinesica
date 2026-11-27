import { getExpandedThreadIds, getTakeoverDrafts } from "./interacciones-state.js";

export function captureExpandedThreads(container) {
  const expandedThreadIds = getExpandedThreadIds();
  if (!container) return;
  container.querySelectorAll(".interaccion-chat-thread").forEach((el) => {
    if (!el.id) return;
    if (el.hidden) expandedThreadIds.delete(el.id);
    else expandedThreadIds.add(el.id);
  });
}

export function restoreExpandedThreads(container) {
  const expandedThreadIds = getExpandedThreadIds();
  if (!container || expandedThreadIds.size === 0) return;
  expandedThreadIds.forEach((threadId) => {
    const threadEl = container.querySelector(`#${CSS.escape(threadId)}`);
    if (!threadEl) return;
    threadEl.hidden = false;
    const btn = container.querySelector(`[data-thread-toggle="${threadId.replace(/"/g, "")}"]`);
    const span = btn?.querySelector("span");
    if (span && span.textContent.includes("▶")) {
      span.textContent = span.textContent.replace("▶", "▼");
    }
  });
}

export function captureTakeoverDrafts(container) {
  const drafts = getTakeoverDrafts();
  if (!container) return;
  container.querySelectorAll(".interaccion-takeover-input").forEach((el) => {
    const id = el.getAttribute("data-conv-id") || "";
    if (!id) return;
    const val = String(el.value || "");
    if (val.trim() === "") drafts.delete(id);
    else drafts.set(id, val);
  });
}

export function restoreTakeoverDrafts(container) {
  const drafts = getTakeoverDrafts();
  if (!container || drafts.size === 0) return;
  container.querySelectorAll(".interaccion-takeover-input").forEach((el) => {
    const id = el.getAttribute("data-conv-id") || "";
    if (!id || !drafts.has(id)) return;
    el.value = drafts.get(id);
  });
}
