/**
 * Kinésica Admin - Aplicación Principal y Orquestador Modular
 * Módulo de administración de historias clínicas de ATM (CDI-TTM).
 */

import {
  compareFichas,
  todayISO,
} from "./ficha-rules.mjs?v=91";

import {
  api,
  setAuthRequiredHandler,
  formatDate,
} from "./modules/api.js?v=79";

import {
  escapeHtml,
} from "./modules/dom.js?v=79";

import {
  getSessionUser,
  setSessionUser,
  setGateMessage,
  showGate,
  hideGate,
  initAuth,
} from "./modules/auth.js?v=83";

import {
  blank,
  readForm,
  fillForm,
  showForm,
} from "./modules/form.js?v=88";

import {
  loadAll,
  setCache,
  resetLibrary,
  showLibrary,
  patientGroupRow,
  sessionRow,
  downloadJSON,
} from "./modules/library.js?v=94";

import {
  showCompare,
  renderCompareContent,
  renderCompareTab,
  printCompare,
} from "./modules/compare.js?v=79";

import {
  parseAdminRouteFromLocation,
  initRouterStorageInterceptor,
  initPopstateRouter,
} from "./modules/router.js?v=4";

import {
  switchTab,
  mountAdminChannels,
  unmountAdminChannels,
} from "./modules/app-tabs.js?v=39";

import {
  initAppControllers,
} from "./modules/app-init.js?v=34";

export {
  api,
  blank,
  readForm,
  fillForm,
  loadAll,
  showLibrary,
  showForm,
  showCompare,
  compareFichas,
  renderCompareContent,
  renderCompareTab,
  printCompare,
  downloadJSON,
  escapeHtml,
  formatDate,
  todayISO,
  upsert,
  refresh,
  patientGroupRow,
  sessionRow,
};

let refreshSeq = 0;
let localWrites = 0;

initRouterStorageInterceptor();

async function upsert(data) {
  const saved = await api("fichas.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
  localWrites += 1;
  const currentCache = loadAll();
  const idx = currentCache.findIndex((f) => f.id === saved.id);
  if (idx >= 0) currentCache[idx] = saved;
  else currentCache.unshift(saved);
  setCache(currentCache);
  return saved;
}

async function remove(id) {
  await api(`fichas.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  await refresh();
}

async function refresh() {
  const seq = ++refreshSeq;
  const writes = localWrites;
  const me = await api("me.php");
  setSessionUser(me);
  hideGate();
  mountAdminChannels();

  const formView = document.querySelector("#view-form");
  const compareView = document.querySelector("#view-compare");
  const urlRoute = parseAdminRouteFromLocation();
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem("kinesica_admin_view") || "null");
  } catch { /* ignore */ }
  if (urlRoute) {
    saved = urlRoute.view === "compare" && saved?.view === "compare" ? saved : urlRoute;
  }

  if ((!formView || formView.hidden) && (!compareView || compareView.hidden)) {
    if (saved?.view === "compare" && saved.pKey) showCompare(saved.pKey, saved.xId, saved.yId);
    else if (saved?.view) switchTab(saved.view, saved.section);
    else switchTab("inicio");
  }

  const items = await api("fichas.php");
  if (seq !== refreshSeq || writes !== localWrites) return;
  setCache(items);

  if (formView && !formView.hidden) {
    if (saved?.view === "form" && saved.id) {
      const ficha = items.find((f) => f.id === saved.id);
      if (ficha) fillForm(ficha, items);
    }
    return;
  }
  if (compareView && !compareView.hidden) {
    renderCompareContent();
    return;
  }

  if (saved?.view === "form" && saved.id) {
    const ficha = items.find((f) => f.id === saved.id);
    if (ficha) {
      fillForm(ficha, items);
      showForm(0);
      return;
    }
  }

  if (saved?.view) switchTab(saved.view, saved.section);
  else switchTab("inicio");
}

setAuthRequiredHandler((data) => {
  unmountAdminChannels();
  setSessionUser(null);
  showGate(data);
});

initAuth({
  onSuccess: async () => {
    await refresh();
    switchTab("inicio");
    mountAdminChannels();
  },
  onLogout: () => {
    unmountAdminChannels();
    resetLibrary();
    try {
      sessionStorage.removeItem("kinesica_admin_view");
      window.history.replaceState(null, "", "/admin/");
      document.title = "Kinésica";
    } catch { /* ignore */ }
  },
});

initAppControllers({
  loadAll,
  getSessionUser,
  fillForm,
  blank,
  showForm,
  showLibrary,
  showCompare,
  switchTab,
  upsert,
  remove,
  refresh,
});

initPopstateRouter({ loadAll, fillForm, showForm, showCompare, switchTab });

const searchParams = new URLSearchParams(location.search);
const resetToken = searchParams.get("reset");
const magicToken = searchParams.get("magic");
const resetFormEl = document.querySelector("#reset-form");

if (resetToken && resetFormEl) {
  resetFormEl.dataset.token = resetToken;
  showGate({ reset: true });
} else if (magicToken) {
  try {
    history.replaceState(null, "", location.pathname);
  } catch { /* ignore */ }
  api("login-code.php", {
    method: "POST",
    body: JSON.stringify({ action: "magic", token: magicToken }),
  })
    .then(async (data) => {
      setSessionUser({ username: data.username, name: data.name, role: data.role });
      hideGate();
      await refresh();
      switchTab("inicio");
      mountAdminChannels();
    })
    .catch((err) => {
      showGate({ login: true });
      const loginErrorEl = document.querySelector("#login-error");
      if (loginErrorEl) {
        setGateMessage(
          loginErrorEl,
          err.message || "El enlace de acceso es inválido o ya expiró.",
          false
        );
      }
    });
} else {
  refresh().catch((error) => {
    if (!error.auth) showGate({ login: true });
  });
}
