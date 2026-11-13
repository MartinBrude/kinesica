export function closeMobileNav() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("is-nav-open");
  const toggle = document.getElementById("btn-nav-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
  }
  const backdrop = document.getElementById("admin-nav-backdrop");
  if (backdrop) backdrop.hidden = true;
}

export function openMobileNav() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add("is-nav-open");
  const toggle = document.getElementById("btn-nav-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Cerrar menú");
  }
  const backdrop = document.getElementById("admin-nav-backdrop");
  if (backdrop) backdrop.hidden = false;
}

export function toggleMobileNav() {
  if (document.documentElement.classList.contains("is-nav-open")) closeMobileNav();
  else openMobileNav();
}
