import { getExpandedThreadIds } from "./interacciones-state.js";

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
