/**
 * Kinésica Admin - Reglas de Identidad de Pacientes y Sesiones
 * Normalización de DNI, cálculo de clave de paciente, edad y derivación de sesiones.
 */

export function normalizeDni(dni) {
  const digits = String(dni || "").replace(/\D/g, "");
  if (digits.length >= 4 && !/[a-zA-Z]/.test(String(dni || ""))) {
    return digits;
  }
  return String(dni || "").trim().toLowerCase();
}

export function stripAccents(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchFichaSearch(item, query) {
  const q = String(query || "").trim();
  if (!q) return true;

  const rawNombre = String(item?.nombre || "");
  const normNombre = stripAccents(rawNombre);
  const rawDni = String(item?.dni || "");
  const dniDigits = rawDni.replace(/\D/g, "");

  const normQ = stripAccents(q);
  if (normNombre.includes(normQ) || rawDni.toLowerCase().includes(normQ)) {
    return true;
  }

  const qDigits = q.replace(/\D/g, "");
  if (/^[\d.\s-]+$/.test(q) && qDigits.length > 0) {
    return dniDigits.includes(qDigits);
  }

  const terms = q.split(/\s+/).filter(Boolean);
  return terms.every((term) => {
    const normTerm = stripAccents(term);
    if (normNombre.includes(normTerm)) return true;
    if (rawDni.toLowerCase().includes(normTerm)) return true;
    const termDigits = term.replace(/\D/g, "");
    if (termDigits.length > 0 && dniDigits.includes(termDigits)) {
      return true;
    }
    return false;
  });
}

export function patientKey(item) {
  const dni = normalizeDni(item?.dni);
  if (dni) return `doc:${dni}`;
  const nombre = String(item?.nombre || "").trim().toLowerCase();
  if (!nombre) return "";
  return `nombre:${nombre}`;
}

export function personNameKey(nombre) {
  return stripAccents(nombre).replace(/\s+/g, " ").trim();
}

export function dniNameConflict(data, allFichas = [], ownKey = "") {
  const key = patientKey(data);
  if (!key.startsWith("doc:")) return null;
  const incoming = personNameKey(data?.nombre);
  if (!incoming) return null;
  const other = (allFichas || []).find((ficha) => {
    if (!ficha || ficha.id === data?.id) return false;
    if (ownKey && patientKey(ficha) === ownKey) return false;
    if (patientKey(ficha) !== key) return false;
    const name = personNameKey(ficha.nombre);
    return Boolean(name) && name !== incoming;
  });
  return other || null;
}

export function ownsFicha(item, username) {
  return (item?.profesional || "") === username;
}

function isRealDate([y, m, d]) {
  if (!y || !m || !d || m > 12 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function ageOn(nacimiento, onDate) {
  const birth = String(nacimiento || "").slice(0, 10).split("-").map(Number);
  const on = String(onDate || "").slice(0, 10).split("-").map(Number);
  if (birth.length !== 3 || on.length !== 3 || !isRealDate(birth) || !isRealDate(on)) return "";
  let age = on[0] - birth[0];
  if (on[1] < birth[1] || (on[1] === birth[1] && on[2] < birth[2])) age -= 1;
  return age >= 0 ? String(age) : "";
}

export const PATIENT_FIELDS = [
  "nombre",
  "dni",
  "nacimiento",
  "lugarNac",
  "motivo",
  "antecedentes",
  "habitoApretamiento",
  "habitoBruxismo",
  "habitoMasticacionUni",
  "habitoOnicofagia",
];

export function getUniquePatients(allFichas = []) {
  const map = new Map();
  for (const f of allFichas) {
    const key = patientKey(f);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        key,
        nombre: f.nombre || "Sin nombre",
        dni: f.dni || "",
        nacimiento: f.nacimiento || "",
        lugarNac: f.lugarNac || "",
        motivo: f.motivo || "",
        habitoApretamiento: Boolean(f.habitoApretamiento),
        habitoBruxismo: Boolean(f.habitoBruxismo),
        habitoMasticacionUni: Boolean(f.habitoMasticacionUni),
        habitoOnicofagia: Boolean(f.habitoOnicofagia),
        antecedentes: f.antecedentes || "",
        sessions: [f],
      });
    } else {
      const p = map.get(key);
      p.sessions.push(f);
      if (!p.nacimiento && f.nacimiento) p.nacimiento = f.nacimiento;
      if (!p.lugarNac && f.lugarNac) p.lugarNac = f.lugarNac;
      if (!p.motivo && f.motivo) p.motivo = f.motivo;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  );
}

export function getSessionIndex(item, allFichas = []) {
  if (!item) return 1;
  const key = patientKey(item);
  const pSessions = (allFichas || [])
    .filter((f) => patientKey(f) === key)
    .sort((a, b) => (a.fechaSesion || "").localeCompare(b.fechaSesion || ""));
  if (!pSessions.length) return 1;
  const idx = pSessions.findIndex((s) => s.id === item.id);
  if (idx >= 0) return idx + 1;
  return pSessions.length + 1;
}

export function formatSessionBadgeText(sessionIndex = 1, totalSessions = 1) {
  if (sessionIndex === 1 && totalSessions === 1) return "Evaluación inicial";
  return `Sesión N° ${sessionIndex}${totalSessions > 1 ? ` de ${totalSessions}` : ""}`;
}

export function shouldOmitInvariableFields(sessionIndex = 1, totalSessions = 1) {
  return totalSessions > 1 && sessionIndex > 1;
}

export function assignProfesional(username, previous, requested, clinicians = {}) {
  if (username === "martin" && requested && clinicians[requested]) {
    return requested;
  }
  if (previous) return String(previous);
  if (username === "maria") return "maria";
  return "norberto";
}
