import {
  canonicalPatientNameKey,
  cleanPatientDni,
  isPlaceholderPhone,
} from "./pacientes-identifiers.js";

export function deduplicatePatientsInMemory(items = []) {
  if (!Array.isArray(items) || items.length <= 1) return items || [];

  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    if (parent[i] === i) return i;
    return (parent[i] = find(parent[i]));
  };
  const union = (i, j) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  };

  const byDni = new Map();
  const byName = new Map();
  const byPhone = new Map();

  items.forEach((p, idx) => {
    let dni = cleanPatientDni(p.dni);
    if (!dni && String(p.telefono || "").startsWith("sin-tel-dni-")) {
      dni = String(p.telefono).slice(12);
    }
    if (dni) {
      if (byDni.has(dni)) union(idx, byDni.get(dni));
      else byDni.set(dni, idx);
    }

    const rawPhone = String(p.telefono || "").trim();
    const cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone && !isPlaceholderPhone(rawPhone)) {
      if (byPhone.has(cleanPhone)) union(idx, byPhone.get(cleanPhone));
      else byPhone.set(cleanPhone, idx);
    }

    const full = (p.nombre_completo || "").trim() || `${p.nombre || ""} ${p.apellido || ""}`.trim();
    const nameKey = canonicalPatientNameKey(full);
    if (nameKey && nameKey.includes(" ")) {
      if (byName.has(nameKey)) {
        const other = items[byName.get(nameKey)];
        const otherPhone = String(other?.telefono || "").trim();
        const otherClean = otherPhone.replace(/\D/g, "");
        const aReal = cleanPhone && !isPlaceholderPhone(rawPhone);
        const bReal = otherClean && !isPlaceholderPhone(otherPhone);
        if (!(aReal && bReal && cleanPhone !== otherClean)) {
          union(idx, byName.get(nameKey));
        }
      } else {
        byName.set(nameKey, idx);
      }
    }
  });

  const clusters = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(items[i]);
  }

  const result = [];
  for (const cluster of clusters.values()) {
    if (cluster.length === 1) {
      result.push(cluster[0]);
      continue;
    }

    cluster.sort((a, b) => {
      const aReal = !isPlaceholderPhone(a.telefono);
      const bReal = !isPlaceholderPhone(b.telefono);
      if (aReal !== bReal) return aReal ? -1 : 1;

      const aReview = Boolean(a.dejo_review && Number(a.dejo_review) !== 0);
      const bReview = Boolean(b.dejo_review && Number(b.dejo_review) !== 0);
      if (aReview !== bReview) return aReview ? -1 : 1;

      const aProf = a.profesional_habitual === "norberto" || a.profesional_habitual === "maria";
      const bProf = b.profesional_habitual === "norberto" || b.profesional_habitual === "maria";
      if (aProf !== bProf) return aProf ? -1 : 1;

      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    const survivor = { ...cluster[0] };

    const hasReview = cluster.some((p) => Boolean(p.dejo_review && Number(p.dejo_review) !== 0));
    survivor.dejo_review = hasReview ? 1 : 0;

    const specificProf = cluster.find((p) => p.profesional_habitual === "norberto" || p.profesional_habitual === "maria");
    survivor.profesional_habitual = specificProf ? specificProf.profesional_habitual : "indistinto";

    const realPhoneRecord = cluster.find((p) => !isPlaceholderPhone(p.telefono));
    if (realPhoneRecord) {
      survivor.telefono = realPhoneRecord.telefono;
    }

    const survivorDni = cleanPatientDni(survivor.dni);
    if (survivorDni) {
      survivor.dni = survivorDni;
    } else {
      const withDni = cluster.find((p) => cleanPatientDni(p.dni));
      survivor.dni = withDni ? cleanPatientDni(withDni.dni) : "";
    }

    if (!survivor.email) {
      const withEmail = cluster.find((p) => p.email && String(p.email).includes("@"));
      if (withEmail) survivor.email = withEmail.email;
    }

    const motivos = cluster.map((p) => (p.motivo_consulta || "").trim()).filter(Boolean);
    if (motivos.length > 0) {
      survivor.motivo_consulta = Array.from(new Set(motivos)).join(" / ");
    }

    const notasList = cluster.map((p) => (p.notas || "").trim()).filter(Boolean);
    if (notasList.length > 0) {
      survivor.notas = Array.from(new Set(notasList)).join("\n");
    }

    if (!survivor.contacto_nombre) {
      const withContact = cluster.find((p) => p.contacto_nombre);
      if (withContact) {
        survivor.contacto_nombre = withContact.contacto_nombre;
        survivor.contacto_telefono = withContact.contacto_telefono || survivor.contacto_telefono;
        survivor.contacto_email = withContact.contacto_email || survivor.contacto_email;
        survivor.contacto_notas = withContact.contacto_notas || survivor.contacto_notas;
      }
    }

    const accentedName = cluster.find((p) => /[áéíóúÁÉÍÓÚñÑ]/.test(p.nombre_completo || ""));
    if (accentedName && !/[áéíóúÁÉÍÓÚñÑ]/.test(survivor.nombre_completo || "")) {
      survivor.nombre_completo = accentedName.nombre_completo;
      if (accentedName.nombre) survivor.nombre = accentedName.nombre;
      if (accentedName.apellido) survivor.apellido = accentedName.apellido;
    }

    result.push(survivor);
  }

  return result;
}
