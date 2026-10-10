import {
  exampleFicha,
  missingFields,
  missingFieldKeys,
  emptyFicha,
  ownsFicha,
  nextSession,
  ageOn,
  REQUIRED_FIELDS,
  CLINICIAN_DETAILS,
  patientKey,
  coerceFicha,
  compareFichas,
  daysBetween,
  matchFichaSearch,
} from "./ficha-rules.mjs?v=28";

let cache = [];
let authed = false;
let sessionUser = null;
const CDI_LABELS = {
  "I.a": "I.a) Dolor miofascial sin limitación de apertura",
  "I.b": "I.b) Dolor miofascial con limitación de apertura",
  "II.a": "II.a) Desplazamiento discal con recaptura",
  "II.b": "II.b) Desplazamiento discal sin recaptura con limitación de apertura",
  "II.c": "II.c) Desplazamiento discal sin recaptura sin limitación de apertura",
  "III.a": "III.a) Artralgia",
  "III.b": "III.b) Artrosis de la ATM",
  "III.c": "III.c) Osteoartritis de la ATM",
};

const form = document.querySelector("#ficha");
const libraryView = document.querySelector("#view-library");
const formView = document.querySelector("#view-form");
const compareView = document.querySelector("#view-compare");
const listEl = document.querySelector("#library-list");
const patientSelect = document.querySelector("#pdf-patient");
const searchInput = document.querySelector("#search");
const pageSizeSelect = document.querySelector("#page-size");
const libraryPager = document.querySelector("#library-pager");
const mineButton = document.querySelector("#btn-mine");
const eva = form.elements.eva;
const evaValue = document.querySelector("#eva-value");

const compareSelectX = document.querySelector("#compare-select-x");
const compareSelectY = document.querySelector("#compare-select-y");
const compareSwapBtn = document.querySelector("#btn-compare-swap");
const compareBackBtn = document.querySelector("#btn-compare-back");
const comparePdfBtn = document.querySelector("#btn-compare-pdf");
const comparePatientName = document.querySelector("#compare-patient-name");
const comparePatientMeta = document.querySelector("#compare-patient-meta");
const compareBanner = document.querySelector("#compare-banner");
const compareTabCount = document.querySelector("#compare-tab-count");
const comparePanelsWrap = document.querySelector("#compare-panels-wrap");
const compareFormBtn = document.querySelector("#btn-compare-form");

let step = 0;
let mineDefaultApplied = false;
let onlyMine = false;
let currentId = null;
const singles = {};

let comparePatient = null;
let comparePreviousView = "library";
let activeCompareTab = "summary";
let currentCompareResult = null;

let grouped = false;
let focusedPatient = null;
let page = 0;

function loadAll() {
  return cache;
}

async function api(path, options = {}) {
  const headers = { "X-Kinesica": "1", ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`api/${path}`, { credentials: "same-origin", ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !data.error) {
    authed = false;
    showGate(data);
    const error = new Error("auth");
    error.auth = true;
    throw error;
  }
  if (!res.ok) {
    const error = new Error(data.error || "No se pudo completar");
    error.payload = data;
    throw error;
  }
  return data;
}

function setGateMessage(el, text, info) {
  el.textContent = text;
  el.classList.toggle("gate-note", Boolean(info));
  el.classList.toggle("gate-error", !info);
  el.hidden = false;
}

function showGate(data) {
  document.querySelector("#view-library").hidden = true;
  document.querySelector("#view-form").hidden = true;
  if (compareView) compareView.hidden = true;
  document.querySelector("#view-gate").hidden = false;
  document.querySelector("#btn-logout").hidden = true;
  document.querySelector("#session-name").hidden = true;
  const enroll = Boolean(data && data.enroll);
  const forgot = Boolean(data && data.forgot);
  const reset = Boolean(data && data.reset);
  document.querySelector("#login-form").hidden = enroll || forgot || reset;
  document.querySelector("#enroll-form").hidden = !enroll;
  document.querySelector("#forgot-form").hidden = !forgot;
  document.querySelector("#reset-form").hidden = !reset;
  if (enroll) {
    document.querySelector("#enroll-account").textContent = data.account || "Kinésica";
    const secret = data.secret || "";
    document.querySelector("#enroll-secret").textContent = secret.replace(/(.{4})/g, "$1 ").trim();
  }
}

const SESSION_NAMES = { martin: "Martín", maria: "María", norberto: "Norberto" };

function hideGate() {
  document.querySelector("#view-gate").hidden = true;
  document.querySelector("#btn-logout").hidden = false;
  const name = document.querySelector("#session-name");
  name.textContent = SESSION_NAMES[sessionUser?.username] || sessionUser?.name || "";
  name.hidden = !name.textContent;
}

async function refresh() {
  sessionUser = await api("me.php");
  if (!mineDefaultApplied) {
    onlyMine = sessionUser.username === "norberto" || sessionUser.username === "maria";
    mineDefaultApplied = true;
    syncMineButton();
  }
  const onlyMartin = sessionUser.username !== "martin";
  document.querySelector("#btn-seed").hidden = onlyMartin;
  cache = await api("fichas.php");
  authed = true;
  hideGate();
  if (!formView.hidden) return;
  showLibrary();
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function blank() {
  return {
    id: crypto.randomUUID(),
    savedAt: null,
    ...emptyFicha(),
    fechaSesion: todayISO(),
  };
}

function readForm() {
  const raw = {
    id: currentId || crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    ...singles,
  };
  const fd = new FormData(form);
  for (const [key, val] of fd.entries()) {
    if (key !== "cdi") raw[key] = val;
  }
  for (const el of form.querySelectorAll('input[type="checkbox"]')) {
    if (el.name && el.name !== "cdi") raw[el.name] = el.checked;
  }
  raw.cdi = [...form.querySelectorAll('input[name="cdi"]:checked')].map((el) => el.value);
  raw.eva = eva.value;
  return coerceFicha(raw);
}

function fillForm(data) {
  currentId = data.id;
  form.reset();
  Object.keys(singles).forEach((k) => delete singles[k]);
  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "savedAt" || key === "cdi") continue;
    const el = form.elements[key];
    if (!el) {
      if (form.querySelector(`[data-single="${key}"]`)) singles[key] = value || "";
      continue;
    }
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value ?? "";
  }
  for (const el of form.querySelectorAll('input[name="cdi"]')) {
    el.checked = (data.cdi || []).includes(el.value);
  }
  document.querySelectorAll("[data-single]").forEach((group) => {
    const key = group.dataset.single;
    group.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.value === (data[key] || ""));
    });
    if (data[key]) singles[key] = data[key];
  });
  syncFollowups();
  syncEva();
  updateStepValidation();
  const pSessions = (data.dni || data.nombre)
    ? loadAll().filter((f) => patientKey(f) === patientKey(data))
    : [];
  if (compareFormBtn) {
    compareFormBtn.hidden = pSessions.length < 2;
  }
}

function syncAge() {
  const birth = form.elements.nacimiento?.value;
  const session = form.elements.fechaSesion?.value || todayISO();
  if (birth) {
    const calculated = ageOn(birth, session);
    if (calculated) {
      form.elements.edad.value = calculated;
    }
  }
}

function updateStepValidation() {
  const data = readForm();
  const missingKeys = missingFieldKeys(data);
  const dot = document.querySelector('.steps button[data-step="0"] .step-dot');
  if (dot) dot.hidden = missingKeys.length === 0;
}

function highlightMissingFields(keys = []) {
  for (const [key] of REQUIRED_FIELDS) {
    const el = form.elements[key];
    if (el) el.classList.toggle("input-error", keys.includes(key));
  }
}

function evaMeta(val) {
  const n = Number(val) || 0;
  if (n === 0) return { label: "0 / 10 · Sin dolor", level: "zero" };
  if (n <= 3) return { label: `${n} / 10 · Dolor leve`, level: "mild" };
  if (n <= 6) return { label: `${n} / 10 · Dolor moderado`, level: "moderate" };
  return { label: `${n} / 10 · Dolor severo`, level: "severe" };
}

function syncEva() {
  const meta = evaMeta(eva.value);
  evaValue.textContent = meta.label;
  evaValue.dataset.level = meta.level;
}

function syncFollowups() {
  document.querySelectorAll("[data-follow]").forEach((box) => {
    const show = singles[box.dataset.follow] === "Sí";
    box.hidden = !show;
    if (!show) box.querySelectorAll("input").forEach((input) => { input.checked = false; });
  });
}

function showStep(index) {
  step = index;
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = Number(panel.dataset.panel) !== index;
  });
  document.querySelectorAll(".steps button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.step) === index);
  });
  document.querySelector("#btn-prev").hidden = index === 0;
  document.querySelector("#btn-next").hidden = index === 4;
}

function showLibrary() {
  formView.hidden = true;
  if (compareView) compareView.hidden = true;
  libraryView.hidden = false;
  renderLibrary();
}

let formBaseline = "";

function formState() {
  const data = readForm();
  delete data.id;
  delete data.savedAt;
  return JSON.stringify(data);
}

function showForm() {
  libraryView.hidden = true;
  if (compareView) compareView.hidden = true;
  formView.hidden = false;
  showStep(step);
  formBaseline = formState();
}

function formatDate(iso) {
  if (!iso) return "Sin fecha";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
}

function visibleFichas() {
  const q = searchInput.value;
  return loadAll()
    .filter((item) => !onlyMine || ownsFicha(item, sessionUser?.username))
    .filter((item) => matchFichaSearch(item, q))
    .sort((a, b) => (b.fechaSesion || "").localeCompare(a.fechaSesion || ""));
}

function fichaRow(item) {
  const row = document.createElement("article");
  row.className = "card-row";
  const cdi = (item.cdi || []).join(", ") || "Sin criterio CDI";
  row.innerHTML = `<div><h3></h3><p></p></div><div class="row-controls"></div>`;
  row.querySelector("h3").textContent = item.nombre || "Sin nombre";
  row.querySelector("p").textContent = `${item.profesionalNombre || "Sin profesional"} · ${formatDate(item.fechaSesion)} · DNI ${item.dni || "—"} · ${cdi}`;
  const actions = row.querySelector(".row-controls");
  const open = document.createElement("button");
  open.type = "button";
  open.className = "btn light";
  open.textContent = "Abrir";
  open.addEventListener("click", () => {
    fillForm(item);
    step = 0;
    showForm();
  });
  const again = document.createElement("button");
  again.type = "button";
  again.className = "btn light";
  again.textContent = "Nueva ficha";
  again.addEventListener("click", () => {
    const copy = nextSession(item, todayISO());
    fillForm({ ...copy, id: crypto.randomUUID() });
    step = 0;
    showForm();
  });
  const pdf = document.createElement("button");
  pdf.type = "button";
  pdf.className = "btn green";
  pdf.textContent = "PDF";
  pdf.addEventListener("click", () => printItems([item]));
  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn ghost";
  del.textContent = "Quitar";
  del.addEventListener("click", () => {
    const name = item.nombre || "esta ficha";
    if (!window.confirm(`¿Quitar la ficha de ${name} del ${formatDate(item.fechaSesion)}? Esta acción no se puede deshacer.`)) return;
    api(`fichas.php?id=${encodeURIComponent(item.id)}`, { method: "DELETE" })
      .then(() => refresh())
      .catch((error) => { if (!error.auth) window.alert(error.message); });
  });
  const json = document.createElement("button");
  json.type = "button";
  json.className = "btn light";
  json.textContent = "JSON";
  json.addEventListener("click", () => downloadJSON(item));
  actions.append(open, again, json, pdf, del);
  return row;
}

function renderLibrary() {
  const allVisible = visibleFichas();
  const items = focusedPatient
    ? allVisible.filter((item) => patientKey(item) === focusedPatient)
    : allVisible;

  const patients = new Map();
  for (const item of allVisible) {
    const key = patientKey(item);
    if (!patients.has(key)) patients.set(key, item.nombre || "Sin nombre");
  }
  const previous = patientSelect.value;
  patientSelect.innerHTML = '<option value="__all__">Todos los pacientes</option>';
  for (const [key, name] of patients) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = name;
    patientSelect.append(opt);
  }
  if ([...patientSelect.options].some((o) => o.value === previous)) patientSelect.value = previous;

  listEl.innerHTML = "";
  if (focusedPatient) {
    const bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.marginBottom = "14px";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn light";
    back.textContent = "← Todos los pacientes";
    back.addEventListener("click", () => {
      focusedPatient = null;
      page = 0;
      renderLibrary();
    });
    bar.append(back);

    const fSessions = loadAll().filter((f) => patientKey(f) === focusedPatient);
    if (fSessions.length >= 2) {
      const comp = document.createElement("button");
      comp.type = "button";
      comp.className = "btn light";
      comp.textContent = "Comparar evolución";
      comp.addEventListener("click", () => showCompare(focusedPatient));
      bar.append(comp);
    }
    listEl.append(bar);
  }
  pageSizeSelect.hidden = items.length <= 20;
  if (items.length <= 20) page = 0;
  if (!items.length) {
    libraryPager.hidden = true;
    listEl.insertAdjacentHTML("beforeend", onlyMine
      ? '<p class="empty">No hay fichas tuyas. Tocá «Ver todos los pacientes» para ver el resto.</p>'
      : '<p class="empty">Todavía no hay fichas. Creá una nueva o abrí un archivo .json.</p>');
    return;
  }
  if (grouped && !focusedPatient) {
    const groupMap = new Map();
    for (const item of items) {
      const key = patientKey(item);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(item);
    }
    const groups = [...groupMap.entries()];
    const slice = pageWindow(groups);
    for (const [key, sessions] of slice) {
      const latest = sessions[0];
      const row = document.createElement("article");
      row.className = "card-row";
      row.innerHTML = `<div><h3></h3><p></p></div><div class="row-controls"></div>`;
      row.querySelector("h3").textContent = latest.nombre || "Sin nombre";
      const count = sessions.length === 1 ? "1 ficha" : `${sessions.length} fichas`;
      row.querySelector("p").textContent = `${count} · última ${formatDate(latest.fechaSesion)} · DNI ${latest.dni || "—"}`;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "btn light";
      open.textContent = "Ver fichas";
      open.addEventListener("click", () => {
        focusedPatient = key;
        page = 0;
        renderLibrary();
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn ghost";
      del.textContent = "Quitar todas";
      del.addEventListener("click", () => {
        const all = loadAll().filter((item) => patientKey(item) === key);
        const name = latest.nombre || "este paciente";
        const count = all.length === 1 ? "la ficha" : `las ${all.length} fichas`;
        if (!window.confirm(`¿Quitar ${count} de ${name}? Esta acción no se puede deshacer.`)) return;
        Promise.all(all.map((item) => api(`fichas.php?id=${encodeURIComponent(item.id)}`, { method: "DELETE" })))
          .then(() => refresh())
          .catch((error) => { if (!error.auth) window.alert(error.message); });
      });
      if (sessions.length >= 2) {
        const comp = document.createElement("button");
        comp.type = "button";
        comp.className = "btn light";
        comp.textContent = "Comparar";
        comp.title = "Comparar evolución de este paciente";
        comp.addEventListener("click", (e) => {
          e.stopPropagation();
          showCompare(key);
        });
        row.querySelector(".row-controls").append(open, comp, del);
      } else {
        row.querySelector(".row-controls").append(open, del);
      }
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        focusedPatient = key;
        page = 0;
        renderLibrary();
      });
      listEl.append(row);
    }
    return;
  }
  for (const item of pageWindow(items)) listEl.append(fichaRow(item));
}

function pageWindow(rows) {
  const size = Number(pageSizeSelect.value);
  libraryPager.innerHTML = "";
  if (!size || rows.length <= size) {
    libraryPager.hidden = true;
    page = 0;
    return rows;
  }
  const pages = Math.ceil(rows.length / size);
  if (page > pages - 1) page = pages - 1;
  libraryPager.hidden = false;
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "btn light";
  prev.textContent = "← Anterior";
  prev.disabled = page === 0;
  prev.addEventListener("click", () => { page -= 1; renderLibrary(); });
  const label = document.createElement("span");
  label.textContent = `${page + 1} / ${pages}`;
  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn light";
  next.textContent = "Siguiente →";
  next.disabled = page >= pages - 1;
  next.addEventListener("click", () => { page += 1; renderLibrary(); });
  libraryPager.append(prev, label, next);
  return rows.slice(page * size, page * size + size);
}

function downloadJSON(data) {
  const many = Array.isArray(data);
  const source = many ? data[0] || {} : data;
  const slug = (source.nombre || "paciente").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const name = many
    ? `atm-fichas-${todayISO()}.json`
    : `atm-${slug || "paciente"}-${(source.dni || "sindni").replace(/\D/g, "")}-${source.fechaSesion || "sinfec"}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function upsert(data) {
  const saved = await api("fichas.php", { method: "POST", body: JSON.stringify(data) });
  const index = cache.findIndex((item) => item.id === saved.id);
  if (index >= 0) cache[index] = saved;
  else cache.push(saved);
  return saved;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null && text !== "") el.textContent = text;
  return el;
}

function field(label, value) {
  if (!value || value === "—") return null;
  const box = node("div", "pf-field");
  box.append(node("span", "pf-k", label), node("span", "pf-v", value));
  return box;
}

function side(left, right) {
  if (left && right) return "Bilateral";
  if (left) return "Izquierdo";
  if (right) return "Derecho";
  return "—";
}

function section(title) {
  const block = node("section", "pf-section");
  block.append(node("h2", "", title));
  return block;
}

function grid(fields) {
  const wrap = node("div", "pf-grid");
  let count = 0;
  for (const [label, value] of fields) {
    const box = field(label, value);
    if (!box) continue;
    wrap.append(box);
    count += 1;
  }
  return count ? wrap : null;
}

function prose(label, value) {
  if (!value || value === "—") return null;
  const box = node("div", "pf-prose");
  box.append(node("span", "pf-k", label), node("p", "", value));
  return box;
}

function formatParts(parts, sep = " · ") {
  return parts.filter((part) => part && part !== "—" && part !== "Sin fecha").join(sep);
}

function add(parent, child) {
  if (child) parent.append(child);
}

function buildSheet(item) {
  const sheet = node("article", "print-sheet");

  const head = node("header", "pf-head");
  const brand = node("div", "pf-brand");
  const logo = document.createElement("img");
  logo.src = document.querySelector(".brand img")?.currentSrc || "/admin/logo.png";
  logo.alt = "Kinésica";
  const titles = node("div", "pf-titles");
  titles.append(
    node("h1", "", "Ficha clínica de ATM"),
    node("p", "pf-sub", "Evaluación según criterios CDI-TTM"),
  );
  brand.append(logo, titles);
  const session = node("div", "pf-session");
  session.append(node("span", "", "Fecha de sesión"), node("strong", "", formatDate(item.fechaSesion)));
  head.append(brand, session);

  const who = node("section", "pf-who");
  who.append(node("h2", "pf-name", item.nombre || "Sin nombre"));
  add(who, grid([
    ["Documento", item.dni],
    ["Edad", item.edad ? `${item.edad} años` : ""],
    ["Nacimiento", formatParts([formatDate(item.nacimiento), item.lugarNac])],
    ["Motivo de consulta", item.motivo],
  ]));
  // FEATURE-OPTIONAL: habitos-bruxismo
  const habitosList = formatParts([
    item.habitoApretamiento ? "Apretamiento diurno" : "",
    item.habitoBruxismo ? "Bruxismo nocturno" : "",
    item.habitoMasticacionUni ? "Masticación unilateral" : "",
    item.habitoOnicofagia ? "Onicofagia / mordisqueo" : "",
  ], ", ");
  if (habitosList) add(who, grid([["Hábitos / bruxismo", habitosList]]));
  // /FEATURE-OPTIONAL: habitos-bruxismo
  add(who, prose("Antecedentes clínicos", item.antecedentes));

  const atm = section("Articulación temporomandibular");
  const fases = [item.faseApertura ? "apertura" : "", item.faseCierre ? "cierre" : ""].filter(Boolean).join(" y ");
  // FEATURE-OPTIONAL: tipo-ruido
  const tiposRuido = [item.ruidoClic ? "clic / chasquido" : "", item.ruidoCrep ? "crepitación" : ""].filter(Boolean).join(" y ");
  // /FEATURE-OPTIONAL: tipo-ruido
  // FEATURE-OPTIONAL: patron-desviacion
  const patronDesv = [item.desvCorregida ? "corregida en S" : "", item.deflexion ? "deflexión" : ""].filter(Boolean).join(" · ");
  // /FEATURE-OPTIONAL: patron-desviacion
  add(atm, grid([
    ["Ruidos articulares", item.ruidos === "Sí" ? formatParts([item.ruidos, side(item.ruidosIzq, item.ruidosDer), fases && `en ${fases}`, tiposRuido && `(${tiposRuido})`]) : (item.ruidos || "")],
    ["Dolor condilar", item.dolorCondilar === "Sí" ? formatParts([item.dolorCondilar, side(item.condilarIzq, item.condilarDer)]) : (item.dolorCondilar || "")],
    ["Apertura libre de dolor", item.aperturaLibre ? `${item.aperturaLibre} mm` : ""],
    ["Apertura con dolor", item.aperturaDolor ? `${item.aperturaDolor} mm` : ""],
    ["Desviación de trayectoria", item.desviacion === "Sí" ? formatParts([item.desviacion, side(item.desvIzq, item.desvDer), patronDesv && `(${patronDesv})`]) : (item.desviacion || "")],
    ["Protrusión", item.protrusion ? `${item.protrusion} mm` : ""],
    ["Lateralidades", formatParts([
      item.latIzq ? `Izq ${item.latIzq} mm` : "",
      item.latDer ? `Der ${item.latDer} mm` : "",
    ])],
  ]));

  const mus = section("Músculos craneales y disco articular");
  add(mus, grid([
    ["Masetero", side(item.maseteroIzq, item.maseteroDer)],
    ["Temporal anterior", side(item.temporalIzq, item.temporalDer)],
    ["Pterigoideo medial", side(item.pterMedIzq, item.pterMedDer)],
    ["Pterigoideo lateral", side(item.pterLatIzq, item.pterLatDer)],
    ["Disco con recaptura", side(item.discoConIzq, item.discoConDer)],
    ["Disco sin recaptura", side(item.discoSinIzq, item.discoSinDer)],
  ]));

  // FEATURE-OPTIONAL: correlacion-cervical
  const cerv = section("Correlación cervical y postural");
  add(cerv, grid([
    ["Trapecio superior", side(item.trapecioIzq, item.trapecioDer)],
    ["ECOM", side(item.ecomIzq, item.ecomDer)],
    ["Suboccipitales", side(item.suboccipitalIzq, item.suboccipitalDer)],
  ]));
  add(cerv, prose("Observaciones cervicales / postura", item.obsCervical));
  // /FEATURE-OPTIONAL: correlacion-cervical

  const pain = section("Dolor y oclusión");
  const eva = Math.max(0, Math.min(10, Number(item.eva) || 0));
  const evaBox = node("div", "pf-eva");
  evaBox.append(node("span", "pf-k", "Valoración EVA"));
  const track = node("div", "pf-eva-track");
  const fill = node("div", "pf-eva-fill");
  fill.style.width = `${eva * 10}%`;
  track.append(fill);
  const score = node("strong", "", `${eva} / 10`);
  evaBox.append(track, score);
  pain.append(evaBox);
  add(pain, grid([
    ["Zona", item.zona],
    ["Características", item.caracteristicas],
    ["Contacto dentario", item.contacto],
    ["Estabilidad oclusal", item.estabilidad],
    ["Clasificación de Angle", item.angle],
    ["Configuración esqueletal", item.esqueletal],
  ]));
  add(pain, prose("Factores que modifican el dolor", item.factores));

  const cdi = section("Criterios diagnósticos CDI-TTM");
  const chips = node("div", "pf-chips");
  const selected = item.cdi || [];
  if (!selected.length) chips.append(node("span", "pf-empty", "Sin criterios marcados"));
  for (const id of selected) chips.append(node("span", "pf-chip", CDI_LABELS[id] || id));
  cdi.append(chips);
  const notes = node("div", "pf-notes");
  const obs = prose("Observaciones clínicas", item.observaciones);
  const plan = prose("Plan de tratamiento", item.plan);
  if (obs) notes.append(obs);
  if (plan) notes.append(plan);
  if (notes.childElementCount) cdi.append(notes);

  const profKey = item.profesional || (sessionUser?.username === "maria" ? "maria" : "norberto");
  const details = CLINICIAN_DETAILS[profKey] || {
    nombre: item.profesionalNombre || "Profesional actuante",
    titulo: "Kinesiólogo/a Fisiatra",
    matricula: "",
    signatureFile: `/admin/signatures/${profKey}.png`,
  };

  const sigBox = node("div", "pf-signature");
  const sigImg = document.createElement("img");
  sigImg.className = "pf-sig-image";
  sigImg.alt = `Firma digital ${details.nombre}`;
  sigImg.src = details.signatureFile;
  sigImg.onerror = () => { sigImg.classList.add("pf-sig-missing"); };

  const sigStamp = node("div", "pf-sig-stamp");
  sigStamp.append(
    node("span", "pf-sig-rule"),
    node("strong", "pf-sig-name", details.nombre),
    node("span", "pf-sig-title", details.titulo),
    details.matricula ? node("span", "pf-sig-mat", details.matricula) : null,
  );
  sigBox.append(sigImg, sigStamp);

  const foot = node("footer", "pf-foot");
  foot.append(
    node("span", "", "Documento clínico confidencial · Kinésica"),
    node("span", "", "Charcas 3889, Palermo, CABA · +54 (11) 6156-4311"),
  );

  sheet.append(head, who);
  for (const block of [atm, mus, cerv, pain, cdi]) {
    if (block.querySelector(".pf-grid, .pf-prose, .pf-eva, .pf-chip, .pf-empty")) sheet.append(block);
  }
  sheet.append(sigBox, foot);
  return sheet;
}

async function printItems(items) {
  const root = document.querySelector("#print-root");
  root.replaceChildren();
  const groups = new Map();
  for (const item of items) {
    const key = patientKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => (a.fechaSesion || "").localeCompare(b.fechaSesion || ""));
    for (const item of group) root.append(buildSheet(item));
  }
  const previousTitle = document.title;
  const names = [...new Set(items.map((item) => (item.nombre || "Paciente").trim()))];
  const dates = items.map((item) => formatDate(item.fechaSesion)).filter((date) => date !== "Sin fecha");
  const who = names.length === 1 ? names[0] : "Fichas ATM";
  const when = dates.length ? (dates.length === 1 ? dates[0].replaceAll("/", "-") : `${dates[0].replaceAll("/", "-")} a ${dates[dates.length - 1].replaceAll("/", "-")}`) : "";
  document.title = [who, when].filter(Boolean).join(" ");
  await Promise.all([...root.querySelectorAll("img")].map((img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {})));
  window.print();
  setTimeout(() => { document.title = previousTitle; }, 1000);
}

function itemsForPdf() {
  const visible = visibleFichas();
  if (patientSelect.value === "__all__") return visible;
  return visible.filter((item) => patientKey(item) === patientSelect.value);
}

function syncMineButton() {
  mineButton.textContent = onlyMine ? "Ver todos los pacientes" : "Ver solo mis pacientes";
  mineButton.classList.toggle("green", onlyMine);
  mineButton.classList.toggle("light", !onlyMine);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showCompare(pKey, preferredXId, preferredYId) {
  comparePreviousView = formView.hidden ? "library" : "form";
  libraryView.hidden = true;
  formView.hidden = true;
  if (compareView) compareView.hidden = false;
  let resolvedKey = pKey;
  if (typeof pKey === "object" && pKey !== null) {
    resolvedKey = patientKey(pKey);
  } else if (pKey && loadAll().some((f) => f.id === pKey)) {
    const found = loadAll().find((f) => f.id === pKey);
    resolvedKey = patientKey(found);
  }
  comparePatient = resolvedKey;
  populateCompareSessions(resolvedKey, preferredXId, preferredYId);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function populateCompareSessions(pKey, preferredXId, preferredYId) {
  const patientSessions = loadAll()
    .filter((f) => patientKey(f) === pKey)
    .sort((a, b) => (a.fechaSesion || "").localeCompare(b.fechaSesion || ""));

  if (!patientSessions.length) {
    if (compareBanner) {
      compareBanner.className = "compare-banner is-same-session";
      compareBanner.textContent = "No se encontraron sesiones para este paciente.";
    }
    if (compareKpis) compareKpis.innerHTML = "";
    if (compareSections) compareSections.innerHTML = "";
    return;
  }

  const latestSession = patientSessions[patientSessions.length - 1];
  const patientName = latestSession.nombre || "Paciente";
  const patientDni = latestSession.dni || "—";
  if (comparePatientName) {
    comparePatientName.innerHTML = `<span class="bar"></span>Evolución: ${escapeHtml(patientName)}`;
  }
  if (comparePatientMeta) {
    comparePatientMeta.textContent = `DNI ${patientDni} · ${patientSessions.length} ${patientSessions.length === 1 ? "sesión registrada" : "sesiones registradas"}`;
  }

  if (compareSelectX) compareSelectX.innerHTML = "";
  if (compareSelectY) compareSelectY.innerHTML = "";

  patientSessions.forEach((s, idx) => {
    const label = `Sesión ${idx + 1} (${formatDate(s.fechaSesion)}) - ${s.profesionalNombre || "Sin prof."}`;
    const optX = document.createElement("option");
    optX.value = s.id;
    optX.textContent = label;
    if (compareSelectX) compareSelectX.append(optX);

    const optY = document.createElement("option");
    optY.value = s.id;
    optY.textContent = label;
    if (compareSelectY) compareSelectY.append(optY);
  });

  if (patientSessions.length >= 2) {
    if (preferredXId && preferredYId) {
      if (compareSelectX) compareSelectX.value = preferredXId;
      if (compareSelectY) compareSelectY.value = preferredYId;
    } else if (preferredXId) {
      const idx = patientSessions.findIndex((s) => s.id === preferredXId);
      if (idx > 0) {
        if (compareSelectX) compareSelectX.value = patientSessions[idx - 1].id;
        if (compareSelectY) compareSelectY.value = preferredXId;
      } else {
        if (compareSelectX) compareSelectX.value = preferredXId;
        if (compareSelectY) compareSelectY.value = patientSessions[patientSessions.length - 1].id;
      }
    } else {
      if (compareSelectX) compareSelectX.value = patientSessions[0].id;
      if (compareSelectY) compareSelectY.value = patientSessions[patientSessions.length - 1].id;
    }
  } else {
    if (compareSelectX) compareSelectX.value = patientSessions[0].id;
    if (compareSelectY) compareSelectY.value = patientSessions[0].id;
  }

  renderCompareContent();
}

function renderCompareContent() {
  if (!compareSelectX || !compareSelectY) return;
  const idX = compareSelectX.value;
  const idY = compareSelectY.value;
  const sessionX = loadAll().find((f) => f.id === idX);
  const sessionY = loadAll().find((f) => f.id === idY);

  if (!sessionX || !sessionY) {
    if (compareBanner) {
      compareBanner.className = "compare-banner is-same-session";
      compareBanner.textContent = "Seleccioná dos sesiones para comparar.";
    }
    if (comparePanelsWrap) comparePanelsWrap.innerHTML = "";
    return;
  }

  const isSame = idX === idY;
  const res = compareFichas(sessionX, sessionY);
  res.sessionX = sessionX;
  res.sessionY = sessionY;
  currentCompareResult = res;

  if (compareTabCount) {
    compareTabCount.textContent = res.totalChanged;
  }

  if (compareBanner) {
    if (isSame) {
      const patientSessions = loadAll().filter((f) => patientKey(f) === patientKey(sessionX));
      if (patientSessions.length <= 1) {
        compareBanner.className = "compare-banner is-same-session";
        compareBanner.innerHTML = `<span><strong>Solo hay 1 sesión registrada (${formatDate(sessionX.fechaSesion)}):</strong> Se necesitan al menos 2 sesiones para contrastar la evolución. Abajo podés ver todos los valores registrados.</span>`;
      } else {
        compareBanner.className = "compare-banner is-same-session";
        compareBanner.innerHTML = `<span><strong>Misma sesión seleccionada (${formatDate(sessionX.fechaSesion)}):</strong> Elegí una sesión distinta en «Sesión base» o «Sesión comparada» para ver la evolución.</span>`;
      }
    } else {
      compareBanner.className = "compare-banner";
      const daysText = res.daysBetween != null ? `${res.daysBetween} días de diferencia` : "Sin fechas";
      const countText = res.totalChanged === 1 ? "1 cambio registrado" : `${res.totalChanged} cambios registrados`;
      compareBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span>Comparando <strong>Sesión del ${formatDate(sessionX.fechaSesion)}</strong> vs <strong>Sesión del ${formatDate(sessionY.fechaSesion)}</strong></span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="compare-badge-pill">📅 ${daysText}</span>
          <span class="compare-badge-pill" style="background:${res.totalChanged > 0 ? '#dcfce7' : 'var(--pill)'}; color:${res.totalChanged > 0 ? '#166534' : 'var(--muted)'};">⚡ ${countText}</span>
        </div>
      `;
    }
  }

  renderCompareTab(activeCompareTab, res);
}

function renderCompareTab(tabKey, res) {
  if (!comparePanelsWrap) return;
  comparePanelsWrap.innerHTML = "";

  if (tabKey === "summary") {
    // LO CENTRAL: Únicamente los parámetros que SÍ cambiaron
    const allChanged = res.sections.flatMap((sec) =>
      sec.fields.filter((f) => f.changed).map((f) => ({
        ...f,
        sectionTitle: sec.title.replace(/^\d+\.\s*/, ""),
      }))
    );

    if (allChanged.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cmp-summary-empty";
      empty.innerHTML = `
        <h3>Sin modificaciones registradas</h3>
        <p>Todos los parámetros clínicos evaluados mantuvieron el mismo estado entre ambas sesiones. Podés navegar por las pestañas superiores para revisar cada sección de la ficha.</p>
      `;
      comparePanelsWrap.append(empty);
      return;
    }

    const block = document.createElement("div");
    block.className = "cmp-changes-block";
    block.innerHTML = `
      <div class="cmp-changes-block-head">
        <div>
          <h3><span class="bar"></span>Parámetros modificados (${allChanged.length})</h3>
          <p class="cmp-changes-sub">Evolución clínica detectada entre la sesión inicial y la sesión de control</p>
        </div>
      </div>
      <div class="cmp-changes-grid"></div>
    `;

    const dateXStr = formatDate(res.sessionX?.fechaSesion);
    const dateYStr = formatDate(res.sessionY?.fechaSesion);
    const gridEl = block.querySelector(".cmp-changes-grid");

    allChanged.forEach((f) => {
      const item = document.createElement("div");
      item.className = "cmp-change-item";

      let trendClass = "same";
      let trendLabel = "Modificado";
      if (f.trend === "better") {
        trendClass = "better";
        trendLabel = "Mejoría clínica";
      } else if (f.trend === "worse") {
        trendClass = "worse";
        trendLabel = "Empeoramiento";
      }

      const deltaHtml = f.deltaText
        ? `<span class="cmp-delta-badge ${trendClass}">${escapeHtml(f.deltaText)}</span>`
        : "";

      item.innerHTML = `
        <div class="cmp-change-header">
          <span class="cmp-change-sec-tag">${escapeHtml(f.sectionTitle)}</span>
          <div class="cmp-change-tags">
            ${deltaHtml}
            <span class="cmp-trend-tag ${trendClass}">${trendLabel}</span>
          </div>
        </div>
        <div class="cmp-change-label">${escapeHtml(f.label)}</div>
        <div class="cmp-change-transition">
          <div class="cmp-trans-col cmp-trans-prev">
            <span class="cmp-trans-meta">Sesión inicial (${escapeHtml(dateXStr)})</span>
            <span class="cmp-trans-val">${escapeHtml(f.previous || "—")}</span>
          </div>
          <div class="cmp-trans-arrow" aria-hidden="true">➔</div>
          <div class="cmp-trans-col cmp-trans-curr">
            <span class="cmp-trans-meta">Sesión de control (${escapeHtml(dateYStr)})</span>
            <span class="cmp-trans-val">${escapeHtml(f.current || "—")}</span>
          </div>
        </div>
      `;
      gridEl.append(item);
    });

    comparePanelsWrap.append(block);
    return;
  }

  // Si es una sección específica (0..4) o "all"
  const sectionsToRender = tabKey === "all"
    ? res.sections
    : [res.sections[Number(tabKey)]].filter(Boolean);

  sectionsToRender.forEach((sec) => {
    const panel = document.createElement("div");
    panel.className = "cmp-panel";
    panel.innerHTML = `
      <h2><span class="bar"></span>${escapeHtml(sec.title)}</h2>
      <div class="cmp-panel-grid"></div>
    `;

    const gridEl = panel.querySelector(".cmp-panel-grid");

    sec.fields.forEach((f) => {
      const box = document.createElement("div");
      box.className = `cmp-field-box ${f.changed ? "is-changed" : "is-same"}`;

      if (f.changed) {
        let trendClass = "same";
        let trendLabel = "Cambió";
        if (f.trend === "better") {
          trendClass = "better";
          trendLabel = "Mejora";
        } else if (f.trend === "worse") {
          trendClass = "worse";
          trendLabel = "Empeoró";
        }

        const deltaHtml = f.deltaText
          ? `<span class="cmp-delta-badge ${trendClass}">${f.deltaText}</span>`
          : "";

        box.innerHTML = `
          <div class="cmp-field-top">
            <span class="cmp-field-title">${escapeHtml(f.label)}</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="cmp-pill-changed">Cambió</span>
              <span class="cmp-trend-tag ${trendClass}">${trendLabel}</span>
            </div>
          </div>
          <div class="cmp-field-val-box">
            <span class="cmp-field-prev" title="Sesión inicial">${escapeHtml(f.previous || "—")}</span>
            <span class="cmp-field-arrow">➔</span>
            <span class="cmp-field-curr" title="Sesión de control">${escapeHtml(f.current || "—")}</span>
            ${deltaHtml}
          </div>
        `;
      } else {
        box.innerHTML = `
          <div class="cmp-field-top">
            <span class="cmp-field-title">${escapeHtml(f.label)}</span>
            <span class="cmp-pill-same">Sin cambios</span>
          </div>
          <div class="cmp-field-static">${escapeHtml(f.current || "—")}</div>
        `;
      }

      gridEl.append(box);
    });

    comparePanelsWrap.append(panel);
  });
}

function buildComparePrintSheet(res) {
  const sheet = node("article", "print-sheet pf-compare");

  const head = node("header", "pf-head");
  const brand = node("div", "pf-brand");
  const logo = document.createElement("img");
  logo.src = document.querySelector(".brand img")?.currentSrc || "/admin/logo.png";
  logo.alt = "Kinésica";
  const titles = node("div", "pf-titles");
  titles.append(
    node("h1", "", "Evolución clínica de ATM · Comparativa"),
    node("p", "pf-sub", `Evaluación comparativa entre sesiones · Lapso: ${res.daysBetween != null ? `${res.daysBetween} días` : "—"}`),
  );
  brand.append(logo, titles);
  const session = node("div", "pf-session");
  session.append(
    node("span", "", "Sesión Y vs Sesión X"),
    node("strong", "", `${formatDate(res.sessionX.fechaSesion)} ➔ ${formatDate(res.sessionY.fechaSesion)}`),
  );
  head.append(brand, session);

  const who = node("section", "pf-who");
  who.append(node("h2", "pf-name", res.patient.nombre || "Sin nombre"));
  add(who, grid([
    ["Documento (DNI)", res.patient.dni || "—"],
    ["Sesión base (X)", `${formatDate(res.sessionX.fechaSesion)} · ${res.sessionX.profesionalNombre || "Sin prof."}`],
    ["Sesión comparada (Y)", `${formatDate(res.sessionY.fechaSesion)} · ${res.sessionY.profesionalNombre || "Sin prof."}`],
    ["Cambios detectados", `${res.totalChanged} modificaciones de estado`],
  ]));

  const kpiSection = node("section", "pf-section");
  kpiSection.append(node("h2", "", "Indicadores clínicos clave (KPIs)"));
  const kpiGrid = node("div", "pf-compare-kpi-grid");
  const kpiItems = [
    { label: "Dolor (EVA)", val: `${res.kpis.eva.previous} ➔ ${res.kpis.eva.current}` },
    { label: "Apertura libre", val: `${res.kpis.aperturaLibre.previous} ➔ ${res.kpis.aperturaLibre.current}` },
    { label: "Apertura con dolor", val: `${res.kpis.aperturaDolor.previous} ➔ ${res.kpis.aperturaDolor.current}` },
    { label: "Ruidos articulares", val: `${res.kpis.ruidos.previous} ➔ ${res.kpis.ruidos.current}` },
  ];
  kpiItems.forEach((it) => {
    const kpiEl = node("div", "pf-compare-kpi");
    kpiEl.append(node("span", "", it.label), node("strong", "", it.val));
    kpiGrid.append(kpiEl);
  });
  kpiSection.append(kpiGrid);

  const tableSection = node("section", "pf-section");
  tableSection.append(node("h2", "", "Detalle comparativo por sección"));
  const table = node("table", "pf-compare-table");
  const thead = node("thead");
  thead.innerHTML = `<tr><th>Sección / Parámetro</th><th>Sesión base (${formatDate(res.sessionX.fechaSesion)})</th><th>Sesión actual (${formatDate(res.sessionY.fechaSesion)})</th><th>Estado</th></tr>`;
  table.append(thead);
  const tbody = node("tbody");

  res.sections.forEach((sec) => {
    const headerRow = node("tr");
    headerRow.innerHTML = `<td colspan="4" style="background:#f8fafc; font-weight:700; color:#031c42; padding:6px 8px;">${escapeHtml(sec.title)}</td>`;
    tbody.append(headerRow);

    sec.fields.forEach((f) => {
      const tr = node("tr", f.changed ? "is-changed" : "");
      const deltaText = f.deltaText ? ` (${f.deltaText})` : "";
      const statusText = f.changed
        ? (f.trend === "better" ? `Mejora${deltaText}` : (f.trend === "worse" ? `Empeoramiento${deltaText}` : `Modificado${deltaText}`))
        : "Sin cambios";

      tr.innerHTML = `
        <td style="padding-left:14px;">${escapeHtml(f.label)}</td>
        <td>${escapeHtml(f.previous || "—")}</td>
        <td>${escapeHtml(f.current || "—")}</td>
        <td><strong>${statusText}</strong></td>
      `;
      tbody.append(tr);
    });
  });
  table.append(tbody);
  tableSection.append(table);

  const profKey = res.sessionY?.profesional || (sessionUser?.username === "maria" ? "maria" : "norberto");
  const details = CLINICIAN_DETAILS[profKey] || {
    nombre: res.sessionY?.profesionalNombre || "Lic. Norberto Brude",
    titulo: "Kinesiólogo Fisiatra · Osteopatía",
    matricula: "M.N. 4930 · M.P. 518",
    signatureFile: `/admin/signatures/${profKey}.png`,
  };

  const sigBox = node("div", "pf-signature");
  const sigImg = document.createElement("img");
  sigImg.className = "pf-sig-image";
  sigImg.alt = `Firma digital ${details.nombre}`;
  sigImg.src = details.signatureFile;
  sigImg.onerror = () => { sigImg.classList.add("pf-sig-missing"); };

  const sigStamp = node("div", "pf-sig-stamp");
  sigStamp.append(
    node("span", "pf-sig-rule"),
    node("strong", "pf-sig-name", details.nombre),
    node("span", "pf-sig-title", details.titulo),
    details.matricula ? node("span", "pf-sig-mat", details.matricula) : null,
  );
  sigBox.append(sigImg, sigStamp);

  const foot = node("footer", "pf-foot");
  foot.append(
    node("span", "", "Informe comparativo de evolución clínica · Kinésica ATM"),
    node("span", "", "Charcas 3889, Palermo, CABA · +54 (11) 6156-4311"),
  );

  sheet.append(head, who, kpiSection, tableSection, sigBox, foot);
  return sheet;
}

async function printCompare(res) {
  if (!res) return;
  const root = document.querySelector("#print-root");
  root.replaceChildren();
  root.append(buildComparePrintSheet(res));
  const previousTitle = document.title;
  document.title = `Evolución ATM - ${res.patient.nombre || "Paciente"} - ${formatDate(res.sessionX.fechaSesion)} vs ${formatDate(res.sessionY.fechaSesion)}`;
  await Promise.all([...root.querySelectorAll("img")].map((img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {})));
  window.print();
  setTimeout(() => { document.title = previousTitle; }, 1000);
}

if (compareSwapBtn) {
  compareSwapBtn.addEventListener("click", () => {
    const curX = compareSelectX.value;
    const curY = compareSelectY.value;
    compareSelectX.value = curY;
    compareSelectY.value = curX;
    renderCompareContent();
  });
}
if (compareSelectX) compareSelectX.addEventListener("change", renderCompareContent);
if (compareSelectY) compareSelectY.addEventListener("change", renderCompareContent);
if (compareBackBtn) {
  compareBackBtn.addEventListener("click", () => {
    if (compareView) compareView.hidden = true;
    if (comparePreviousView === "form") {
      formView.hidden = false;
    } else {
      libraryView.hidden = false;
      renderLibrary();
    }
  });
}
if (comparePdfBtn) {
  comparePdfBtn.addEventListener("click", () => {
    if (currentCompareResult) printCompare(currentCompareResult);
  });
}
document.querySelectorAll(".compare-steps button").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeCompareTab = btn.dataset.compareTab;
    document.querySelectorAll(".compare-steps button").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    if (currentCompareResult) {
      renderCompareTab(activeCompareTab, currentCompareResult);
    }
  });
});
if (compareFormBtn) {
  compareFormBtn.addEventListener("click", () => {
    const currentItem = readForm();
    showCompare(patientKey(currentItem), currentId);
  });
}

document.querySelectorAll("[data-single]").forEach((group) => {
  group.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const key = group.dataset.single;
    const next = singles[key] === btn.dataset.value ? "" : btn.dataset.value;
    singles[key] = next;
    group.querySelectorAll("button").forEach((el) => el.classList.toggle("on", el.dataset.value === next));
    syncFollowups();
  });
});

document.querySelectorAll(".steps button").forEach((btn) => {
  btn.addEventListener("click", () => showStep(Number(btn.dataset.step)));
});

eva.addEventListener("input", syncEva);

form.elements.nacimiento?.addEventListener("change", () => {
  syncAge();
  updateStepValidation();
});
form.elements.fechaSesion?.addEventListener("change", () => {
  syncAge();
  updateStepValidation();
});
form.addEventListener("input", (e) => {
  if (e.target.classList.contains("input-error") && e.target.value.trim()) {
    e.target.classList.remove("input-error");
  }
  updateStepValidation();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = readForm();
  const missingKeys = missingFieldKeys(data);
  if (missingKeys.length) {
    showStep(0);
    highlightMissingFields(missingKeys);
    window.alert(`Falta completar: ${missingFields(data).join(", ")}.`);
    const firstMissing = form.elements[missingKeys[0]];
    if (firstMissing) firstMissing.focus();
    return;
  }
  try {
    await upsert(data);
    currentId = data.id;
    showLibrary();
  } catch (error) {
    if (!error.auth) window.alert(error.message);
  }
});

document.querySelector("#btn-back").addEventListener("click", () => {
  if (formState() !== formBaseline && !window.confirm("¿Volver a las fichas sin guardar?")) return;
  showLibrary();
});

const SEED_PEOPLE = [
  ["Lucía Fernández", "30111201"], ["Mateo Ruiz", "30111202"], ["Sofía Álvarez", "30111203"],
  ["Benjamín Castro", "30111204"], ["Valentina Díaz", "30111205"], ["Joaquín Romero", "30111206"],
  ["Emma Suárez", "30111207"], ["Bautista Molina", "30111208"], ["Catalina Vargas", "30111209"],
  ["Thiago Navarro", "30111210"], ["Olivia Pereyra", "30111211"], ["Santino Acosta", "30111212"],
  ["Isabella Medina", "30111213"], ["Felipe Cabrera", "30111214"], ["Martina Ríos", "30111215"],
  ["Gael Paredes", "30111216"], ["Renata Quiroga", "30111217"], ["Ian Ferreyra", "30111218"],
  ["Zoe Maldonado", "30111219"], ["León Herrera", "30111220"],
];

document.querySelector("#btn-seed").addEventListener("click", async () => {
  if (sessionUser?.username !== "martin") return;
  if (!window.confirm("¿Agregar 20 fichas de prueba?")) return;
  const button = document.querySelector("#btn-seed");
  button.disabled = true;
  try {
    for (let i = 0; i < SEED_PEOPLE.length; i += 1) {
      const [nombre, dni] = SEED_PEOPLE[i];
      const day = String(i + 1).padStart(2, "0");
      const data = { ...blank(), ...exampleFicha(), id: crypto.randomUUID(), nombre, dni, fechaSesion: `2026-09-${day}` };
      await upsert(data);
    }
    showLibrary();
  } catch (error) {
    if (!error.auth) window.alert(error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#btn-new").addEventListener("click", () => {
  fillForm(blank());
  step = 0;
  showForm();
});

document.querySelector("#btn-prev").addEventListener("click", () => showStep(Math.max(0, step - 1)));
document.querySelector("#btn-next").addEventListener("click", () => {
  if (step === 0) {
    const data = readForm();
    const missingKeys = missingFieldKeys(data);
    if (missingKeys.length) {
      highlightMissingFields(missingKeys);
      const firstMissing = form.elements[missingKeys[0]] || form.querySelector(".input-error");
      if (firstMissing) firstMissing.focus();
      return;
    }
  }
  showStep(Math.min(4, step + 1));
});
searchInput.addEventListener("input", () => { page = 0; renderLibrary(); });
pageSizeSelect.addEventListener("change", () => { page = 0; renderLibrary(); });
mineButton.addEventListener("click", () => {
  onlyMine = !onlyMine;
  focusedPatient = null;
  page = 0;
  syncMineButton();
  renderLibrary();
});
document.querySelector("#btn-group").addEventListener("click", () => {
  grouped = !grouped;
  focusedPatient = null;
  page = 0;
  const button = document.querySelector("#btn-group");
  button.textContent = grouped ? "Ver todas las fichas" : "Agrupar por paciente";
  button.classList.toggle("green", grouped);
  button.classList.toggle("light", !grouped);
  renderLibrary();
});

document.querySelector("#btn-clear").addEventListener("click", () => {
  const id = currentId;
  const fresh = blank();
  fresh.id = id || fresh.id;
  fillForm(fresh);
  showStep(0);
});

document.querySelector("#btn-example").addEventListener("click", () => {
  const sample = blank();
  sample.id = currentId || sample.id;
  Object.assign(sample, exampleFicha());
  fillForm(sample);
});

document.querySelector("#file-open").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    window.alert("El archivo no es un JSON válido.");
    return;
  }
  if (!parsed || typeof parsed !== "object") {
    window.alert("El archivo no es una ficha.");
    return;
  }
  if (Array.isArray(parsed)) {
    const fichas = parsed.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    if (!fichas.length) {
      window.alert("El archivo no tiene fichas.");
      return;
    }
    try {
      for (const item of fichas) {
        await upsert(coerceFicha({ ...blank(), ...item, id: item.id || crypto.randomUUID() }));
      }
      showLibrary();
      window.alert(fichas.length === 1 ? "Se cargó 1 ficha." : `Se cargaron ${fichas.length} fichas.`);
    } catch (error) {
      if (!error.auth) window.alert(error.message);
    }
    return;
  }
  const data = coerceFicha({ ...blank(), ...parsed, id: parsed.id || crypto.randomUUID() });
  fillForm(data);
  step = 0;
  showForm();
  const missing = missingFields(data);
  if (missing.length) {
    window.alert(`El archivo se abrió, pero falta completar: ${missing.join(", ")}.`);
  }
});

document.querySelector("#btn-forgot").addEventListener("click", () => showGate({ forgot: true }));
document.querySelector("#btn-forgot-back").addEventListener("click", () => showGate({ login: true }));
document.querySelector("#forgot-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.querySelector("#forgot-error");
  error.hidden = true;
  try {
    const data = await api("forgot.php", {
      method: "POST",
      body: JSON.stringify({ username: event.target.username.value }),
    });
    setGateMessage(error, data.message || "Si el usuario tiene correo, te llega un enlace en unos minutos.", true);
  } catch (err) {
    setGateMessage(error, err.message, false);
  }
});
document.querySelector("#reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.querySelector("#reset-error");
  error.hidden = true;
  const password = event.target.password.value;
  if (password !== event.target.confirm.value) {
    setGateMessage(error, "Las contraseñas no coinciden.", false);
    return;
  }
  try {
    await api("reset.php", {
      method: "POST",
      body: JSON.stringify({ token: event.target.dataset.token, password }),
    });
    history.replaceState(null, "", location.pathname);
    showGate({ login: true });
    setGateMessage(document.querySelector("#login-error"), "Contraseña actualizada. Entrá con la nueva.", true);
  } catch (err) {
    setGateMessage(error, err.message, false);
  }
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.querySelector("#login-error");
  error.hidden = true;
  const body = {
    username: event.target.username.value,
    password: event.target.password.value,
    code: event.target.code.value,
  };
  try {
    const data = await api("login.php", { method: "POST", body: JSON.stringify(body) });
    if (data.enroll) showGate(data);
    else await refresh();
  } catch (err) {
    if (err.auth) return;
    error.textContent = err.message;
    error.hidden = false;
  }
});

document.querySelector("#enroll-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.querySelector("#enroll-error");
  error.hidden = true;
  try {
    await api("totp.php", { method: "POST", body: JSON.stringify({ code: event.target.code.value }) });
    await refresh();
  } catch (err) {
    if (err.auth) return;
    error.textContent = err.message;
    error.hidden = false;
  }
});

document.querySelector("#btn-logout").addEventListener("click", async () => {
  await api("logout.php", { method: "POST" }).catch(() => {});
  cache = [];
  mineDefaultApplied = false;
  showGate({ login: true });
});

document.querySelector("#btn-export").addEventListener("click", () => {
  const items = visibleFichas();
  if (!items.length) {
    window.alert("No hay fichas para exportar.");
    return;
  }
  downloadJSON(items.length === 1 ? items[0] : items);
});
document.querySelector("#btn-export-one").addEventListener("click", () => downloadJSON(readForm()));
document.querySelector("#btn-pdf-all").addEventListener("click", () => {
  const items = itemsForPdf();
  if (items.length) printItems(items);
});
document.querySelector("#btn-pdf-one").addEventListener("click", () => printItems([readForm()]));

fillForm(blank());
const resetToken = new URLSearchParams(location.search).get("reset");
if (resetToken) {
  document.querySelector("#reset-form").dataset.token = resetToken;
  showGate({ reset: true });
} else {
  refresh().catch((error) => {
    if (!error.auth) showGate({ login: true });
  });
}
