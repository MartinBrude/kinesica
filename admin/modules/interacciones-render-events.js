import { buildWhatsAppUrl } from "./interacciones-message.js";

export function renderPager({ totalRows, totalPages, currentPage, pageSize, onPageChange }) {
  const pagerEl = document.getElementById("interacciones-pager");
  if (!pagerEl) return;

  if (totalRows <= pageSize || totalRows === 0) {
    pagerEl.hidden = true;
    pagerEl.innerHTML = "";
    return;
  }

  pagerEl.hidden = false;
  pagerEl.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn ghost";
  prevBtn.textContent = "← Anterior";
  prevBtn.disabled = currentPage === 0;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 0 && typeof onPageChange === "function") {
      onPageChange(currentPage - 1);
    }
  });

  const span = document.createElement("span");
  const unit = totalRows === 1 ? "conversación" : "conversaciones";
  span.textContent = `Página ${currentPage + 1} de ${totalPages} (${totalRows} ${unit})`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn ghost";
  nextBtn.textContent = "Siguiente →";
  nextBtn.disabled = currentPage >= totalPages - 1;
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages - 1 && typeof onPageChange === "function") {
      onPageChange(currentPage + 1);
    }
  });

  pagerEl.append(prevBtn, span, nextBtn);
}

export function bindInteractionEvents(container, { onToggleAnswered, onArchive, onThreadToggle, getSessionUser }) {
  if (!container) return;
  container.querySelectorAll("[data-thread-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-thread-toggle");
      const threadEl = document.getElementById(targetId);
      if (!threadEl) return;
      threadEl.hidden = !threadEl.hidden;
      const isOpen = !threadEl.hidden;
      const span = btn.querySelector("span");
      if (span) {
        span.textContent = isOpen ? span.textContent.replace("▶", "▼") : span.textContent.replace("▼", "▶");
      }
      if (typeof onThreadToggle === "function") {
        onThreadToggle({ threadId: targetId, isOpen, btn, threadEl });
      }
    });
  });

  container.querySelectorAll(".btn-whatsapp-direct").forEach((link) => {
    link.addEventListener("click", () => {
      const cleanWa = link.getAttribute("data-wa-id");
      if (cleanWa && typeof getSessionUser === "function") {
        link.href = buildWhatsAppUrl(cleanWa, getSessionUser());
      }
    });
  });

  container.querySelectorAll(".btn-archive-interaction").forEach((btn) => {
    btn.addEventListener("click", () => {
      const convId = btn.getAttribute("data-conv-id");
      const convName = btn.getAttribute("data-conv-name") || "este contacto";
      const isArchived = btn.getAttribute("data-archived") === "1";
      const cardEl = btn.closest(".interaccion-card");
      if (typeof onArchive === "function") {
        onArchive({ convId, convName, isArchived, btn, cardEl });
      }
    });
  });

  container.querySelectorAll(".interaccion-answered-checkbox").forEach((chk) => {
    chk.addEventListener("change", () => {
      const convId = chk.getAttribute("data-conv-id");
      const convKey = chk.getAttribute("data-conv-key") || convId;
      const isChecked = chk.checked;
      const cardEl = chk.closest(".interaccion-card");
      const pillEl = document.getElementById(`status-pill-${convKey}`);
      if (typeof onToggleAnswered === "function") {
        onToggleAnswered({ convId, convKey, isChecked, chk, cardEl, pillEl });
      }
    });
  });
}
