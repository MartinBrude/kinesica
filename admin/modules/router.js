/**
 * Kinésica Admin - Enrutador SPA y Sincronización de URL
 * Gestiona History API (pushState/replaceState), popstate y correspondencia de rutas con vistas.
 */

import { getSessionUser } from "./auth.js?v=81";

export function parseAdminRouteFromLocation() {
  if (typeof window === "undefined" || !window.location) return null;
  const raw = (
    window.location.hash
      ? window.location.hash.slice(1)
      : window.location.pathname.replace(/^\/admin\/?/, "")
  ).replace(/^\/+|\/+$/g, "");
  if (!raw || raw === "index.html") return null;
  const parts = raw.split("/");
  const head = (parts[0] || "").toLowerCase();
  if (head === "inicio") return { view: "inicio" };
  if (head === "fichas" || head === "historias" || head === "library") return { view: "library" };
  if (head === "pacientes") return { view: "pacientes" };
  if (head === "consultorio" || head === "horarios" || head === "honorarios") return { view: "consultorio" };
  if (head === "clara" || head === "configuracion") return { view: "clara" };
  if (head === "interacciones" || head === "chats" || head === "mensajes") return { view: "interacciones" };
  if (head === "administracion" || head === "admin" || head === "sistema") return { view: "admin" };
  if (head === "ficha") return { view: "form", id: parts[1] ? decodeURIComponent(parts[1]) : "" };
  if (head === "comparar") return { view: "compare" };
  return null;
}

export function syncUrlWithViewState(state, isInitialBoot = false, isHandlingPopState = false) {
  if (typeof window === "undefined" || !window.history || !state || !state.view) return;
  if (new URLSearchParams(window.location.search).has("reset")) return;
  const isLogged = Boolean(getSessionUser()) || localStorage.getItem("kinesica_logged_in") === "1";
  if (!isLogged) return;

  const v = state.view;
  let targetPath = "/admin/";
  let docTitle = "Kinésica — Panel de Control";

  if (v === "library" || v === "fichas") {
    targetPath = "/admin/fichas";
    docTitle = "Kinésica — Historias Clínicas";
  } else if (v === "form") {
    const slug = state.id ? encodeURIComponent(state.id) : "nueva";
    targetPath = `/admin/ficha/${slug}`;
    docTitle = "Kinésica — Ficha Clínica ATM";
  } else if (v === "compare") {
    targetPath = "/admin/comparar";
    docTitle = "Kinésica — Comparar Sesiones";
  } else if (v === "pacientes") {
    targetPath = "/admin/pacientes";
    docTitle = "Kinésica — Pacientes";
  } else if (v === "consultorio" || v === "horarios" || v === "honorarios") {
    targetPath = "/admin/consultorio";
    docTitle = "Kinésica — Consultorio";
  } else if (v === "clara" || v === "configuracion") {
    targetPath = "/admin/clara";
    docTitle = "Kinésica — Clara & Mensajes";
  } else if (v === "interacciones" || v === "chats") {
    targetPath = "/admin/interacciones";
    docTitle = "Kinésica — Interacciones WhatsApp";
  } else if (v === "admin" || v === "administracion") {
    targetPath = "/admin/administracion";
    docTitle = "Kinésica — Administración";
  }

  try {
    document.title = docTitle;
    const currentPath = window.location.pathname;
    const method = isInitialBoot || isHandlingPopState || currentPath === targetPath ? "replaceState" : "pushState";
    window.history[method](state, "", targetPath);
  } catch {}
}

export function initRouterStorageInterceptor() {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  const nativeSetItem = window.sessionStorage.setItem.bind(window.sessionStorage);
  window.sessionStorage.setItem = function (key, value) {
    nativeSetItem(key, value);
    if (key === "kinesica_admin_view") {
      try {
        syncUrlWithViewState(JSON.parse(value));
      } catch {}
    }
  };
}

export function initPopstateRouter({ loadAll, fillForm, showForm, showCompare, switchTab }) {
  if (typeof window === "undefined") return;
  window.addEventListener("popstate", (event) => {
    if (!getSessionUser()) return;
    try {
      const route = (event.state && event.state.view ? event.state : parseAdminRouteFromLocation()) || { view: "inicio" };
      if (route.view === "form" && route.id) {
        const items = loadAll();
        const ficha = items.find((f) => f.id === route.id);
        if (ficha) {
          fillForm(ficha, items);
          showForm(0);
          return;
        }
      }
      if (route.view === "compare" && route.pKey) {
        showCompare(route.pKey, route.xId, route.yId);
        return;
      }
      if (route.view === "library" || route.view === "fichas") switchTab("fichas");
      else if (route.view === "pacientes") switchTab("pacientes");
      else if (route.view === "consultorio" || route.view === "horarios" || route.view === "honorarios") switchTab("consultorio");
      else if (route.view === "clara" || route.view === "configuracion") switchTab("clara");
      else if (route.view === "interacciones" || route.view === "chats") switchTab("interacciones");
      else if (route.view === "admin" || route.view === "administracion") {
        if (getSessionUser()?.role === "admin") switchTab("admin");
        else switchTab("inicio");
      }
      else switchTab("inicio");
    } finally {
      syncUrlWithViewState(event.state, false, true);
    }
  });
}
