import { getModal, setModal } from "./admin-booking-state.js";
import { openAdminBooking, closeAdminBooking } from "./admin-booking-open.js";

export function initAdminBooking() {
  const modal = document.getElementById("admin-booking-modal");
  setModal(modal);
  if (!modal) return;

  document.querySelectorAll("[data-admin-booking-open]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openAdminBooking();
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAdminBooking();
      }
    });
  });

  modal.querySelector("[data-action=\"admin-booking-close\"]")?.addEventListener("click", closeAdminBooking);
  modal.querySelector("[data-action=\"admin-booking-close-backdrop\"]")?.addEventListener("click", closeAdminBooking);
  document.addEventListener("keydown", (event) => {
    const currentModal = getModal();
    if (event.key === "Escape" && currentModal?.classList.contains("is-open")) closeAdminBooking();
  });
}
