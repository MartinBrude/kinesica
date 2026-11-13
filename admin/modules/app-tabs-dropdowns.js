export function closeAllDropdowns() {
  document.querySelectorAll(".nav-dropdown").forEach((el) => {
    el.classList.remove("is-open");
    el.querySelector(".nav-dropdown-trigger")?.setAttribute("aria-expanded", "false");
  });
}
