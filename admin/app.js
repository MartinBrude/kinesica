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
const listEl = document.querySelector("#library-list");
const patientSelect = document.querySelector("#pdf-patient");
const searchInput = document.querySelector("#search");
const eva = form.elements.eva;
const evaValue = document.querySelector("#eva-value");

let step = 0;
let currentId = null;
const singles = {};

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

function showGate(data) {
  document.querySelector("#view-library").hidden = true;
  document.querySelector("#view-form").hidden = true;
  document.querySelector("#view-gate").hidden = false;
  document.querySelector("#btn-logout").hidden = true;
  const enroll = Boolean(data && data.enroll);
  document.querySelector("#login-form").hidden = enroll;
  document.querySelector("#enroll-form").hidden = !enroll;
  if (enroll) {
    document.querySelector("#enroll-account").textContent = data.account || "Kinésica";
    const secret = data.secret || "";
    document.querySelector("#enroll-secret").textContent = secret.replace(/(.{4})/g, "$1 ").trim();
  }
}

function hideGate() {
  document.querySelector("#view-gate").hidden = true;
  document.querySelector("#btn-logout").hidden = false;
}

async function refresh() {
  sessionUser = await api("me.php");
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
    nombre: "",
    dni: "",
    fechaSesion: todayISO(),
    nacimiento: "",
    edad: "",
    lugarNac: "",
    motivo: "",
    antecedentes: "",
    ruidos: "",
    ruidosIzq: false,
    ruidosDer: false,
    faseApertura: false,
    faseCierre: false,
    dolorCondilar: "",
    condilarIzq: false,
    condilarDer: false,
    aperturaLibre: "",
    aperturaDolor: "",
    desviacion: "",
    desvIzq: false,
    desvDer: false,
    protrusion: "",
    latIzq: "",
    latDer: "",
    maseteroIzq: false,
    maseteroDer: false,
    temporalIzq: false,
    temporalDer: false,
    pterMedIzq: false,
    pterMedDer: false,
    pterLatIzq: false,
    pterLatDer: false,
    discoConIzq: false,
    discoConDer: false,
    discoSinIzq: false,
    discoSinDer: false,
    eva: 0,
    zona: "",
    caracteristicas: "",
    factores: "",
    contacto: "",
    estabilidad: "",
    angle: "",
    esqueletal: "",
    cdi: [],
    observaciones: "",
    plan: "",
    profesional: sessionUser?.username || "",
    profesionalNombre: sessionUser?.name || "",
  };
}

function readForm() {
  const data = blank();
  data.id = currentId || data.id;
  const fd = new FormData(form);
  for (const [key, value] of fd.entries()) {
    if (key === "cdi") continue;
    const el = form.elements[key];
    if (el && el.type === "checkbox") data[key] = true;
    else data[key] = value;
  }
  for (const el of form.querySelectorAll('input[type="checkbox"]')) {
    if (el.name !== "cdi") data[el.name] = el.checked;
  }
  data.cdi = [...form.querySelectorAll('input[name="cdi"]:checked')].map((el) => el.value);
  data.eva = Number(eva.value);
  Object.assign(data, singles);
  data.savedAt = new Date().toISOString();
  return data;
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
  evaValue.textContent = `${eva.value} / 10`;
}

function showStep(index) {
  step = index;
  document.querySelectorAll(".panel, .sheet-tools").forEach((panel) => {
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
  libraryView.hidden = false;
  renderLibrary();
}

function showForm() {
  libraryView.hidden = true;
  formView.hidden = false;
  showStep(step);
}

function formatDate(iso) {
  if (!iso) return "Sin fecha";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function patientKey(item) {
  return `${(item.nombre || "").trim().toLowerCase()}|${(item.dni || "").trim()}`;
}

function renderLibrary() {
  const q = searchInput.value.trim().toLowerCase();
  const items = loadAll()
    .filter((item) => {
      const blob = `${item.nombre} ${item.dni}`.toLowerCase();
      return !q || blob.includes(q);
    })
    .sort((a, b) => (b.fechaSesion || "").localeCompare(a.fechaSesion || ""));

  const patients = new Map();
  for (const item of loadAll()) {
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
  if (!items.length) {
    listEl.innerHTML = '<p class="empty">Todavía no hay fichas. Creá una nueva o abrí un archivo .json.</p>';
    return;
  }
  for (const item of items) {
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
      api(`fichas.php?id=${encodeURIComponent(item.id)}`, { method: "DELETE" })
        .then(() => refresh())
        .catch((error) => { if (!error.auth) window.alert(error.message); });
    });
    actions.append(open, pdf, del);
    listEl.append(row);
  }
}

function downloadJSON(data) {
  const slug = (data.nombre || "paciente").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const name = `atm-${slug || "paciente"}-${(data.dni || "sindni").replace(/\D/g, "")}-${data.fechaSesion || "sinfec"}.json`;
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

function add(parent, child) {
  if (child) parent.append(child);
}

function buildSheet(item) {
  const sheet = node("article", "print-sheet");

  const head = node("header", "pf-head");
  const brand = node("div", "pf-brand");
  const logo = document.createElement("img");
  logo.src = "logo.png";
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
    ["Nacimiento", [formatDate(item.nacimiento), item.lugarNac].filter((part) => part && part !== "Sin fecha").join(" · ")],
    ["Motivo de consulta", item.motivo],
  ]));
  add(who, prose("Antecedentes clínicos", item.antecedentes));

  const atm = section("Articulación temporomandibular");
  const fases = [item.faseApertura ? "apertura" : "", item.faseCierre ? "cierre" : ""].filter(Boolean).join(" y ");
  add(atm, grid([
    ["Ruidos articulares", [item.ruidos, side(item.ruidosIzq, item.ruidosDer), fases && `en ${fases}`].filter((part) => part && part !== "—").join(" · ")],
    ["Dolor condilar", [item.dolorCondilar, side(item.condilarIzq, item.condilarDer)].filter((part) => part && part !== "—").join(" · ")],
    ["Apertura libre de dolor", item.aperturaLibre ? `${item.aperturaLibre} mm` : ""],
    ["Apertura con dolor", item.aperturaDolor ? `${item.aperturaDolor} mm` : ""],
    ["Desviación de trayectoria", [item.desviacion, side(item.desvIzq, item.desvDer)].filter((part) => part && part !== "—").join(" · ")],
    ["Protrusión", item.protrusion ? `${item.protrusion} mm` : ""],
    ["Lateralidad izquierda", item.latIzq ? `${item.latIzq} mm` : ""],
    ["Lateralidad derecha", item.latDer ? `${item.latDer} mm` : ""],
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

  const foot = node("footer", "pf-foot");
  foot.append(
    node("span", "", "Documento clínico confidencial · Kinésica"),
    node("span", "", "Charcas 3889, Palermo, CABA · +54 (11) 6156-4311"),
  );

  sheet.append(head, who);
  for (const block of [atm, mus, pain, cdi]) {
    if (block.querySelector(".pf-grid, .pf-prose, .pf-eva, .pf-chip, .pf-empty")) sheet.append(block);
  }
  sheet.append(foot);
  return sheet;
}

function printItems(items) {
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
  window.print();
  setTimeout(() => { document.title = previousTitle; }, 1000);
}

function itemsForPdf() {
  const all = loadAll();
  if (patientSelect.value === "__all__") return all;
  return all.filter((item) => patientKey(item) === patientSelect.value);
}

document.querySelectorAll("[data-single]").forEach((group) => {
  group.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const key = group.dataset.single;
    const next = singles[key] === btn.dataset.value ? "" : btn.dataset.value;
    singles[key] = next;
    group.querySelectorAll("button").forEach((el) => el.classList.toggle("on", el.dataset.value === next));
  });
});

document.querySelectorAll(".steps button").forEach((btn) => {
  btn.addEventListener("click", () => showStep(Number(btn.dataset.step)));
});

eva.addEventListener("input", () => {
  evaValue.textContent = `${eva.value} / 10`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = readForm();
  if (!data.nombre.trim()) {
    showStep(0);
    form.elements.nombre.focus();
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

document.querySelector("#btn-new").addEventListener("click", () => {
  fillForm(blank());
  step = 0;
  showForm();
});

document.querySelector("#btn-prev").addEventListener("click", () => showStep(Math.max(0, step - 1)));
document.querySelector("#btn-next").addEventListener("click", () => showStep(Math.min(4, step + 1)));
searchInput.addEventListener("input", renderLibrary);

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
  Object.assign(sample, {
    nombre: "Carolina Méndez",
    dni: "34.205.109",
    edad: "34",
    lugarNac: "Córdoba",
    motivo: "No Traumático",
    aperturaLibre: "35",
    aperturaDolor: "46",
    protrusion: "8",
    latIzq: "10",
    latDer: "10",
    zona: "Fosa temporal anterior e intraauricular",
    caracteristicas: "Sordo, opresivo, continuo, punzante",
    factores: "Aumenta al masticar chicles, pan duro. Disminuye al usar calor local o relajación muscular.",
  });
  fillForm(sample);
});

document.querySelector("#file-open").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const data = JSON.parse(await file.text());
  if (!data || typeof data !== "object" || !("nombre" in data)) return;
  if (!data.id) data.id = crypto.randomUUID();
  try {
    await upsert(data);
    fillForm(data);
    step = 0;
    showForm();
  } catch (error) {
    if (!error.auth) window.alert(error.message);
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
  showGate({ login: true });
});

document.querySelector("#btn-pdf-all").addEventListener("click", () => {
  const items = itemsForPdf();
  if (items.length) printItems(items);
});
document.querySelector("#btn-pdf-one").addEventListener("click", () => printItems([readForm()]));

fillForm(blank());
refresh().catch((error) => {
  if (!error.auth) showGate({ login: true });
});
