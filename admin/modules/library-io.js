/**
 * Kinésica Admin - Exportación e Importación de Fichas (Biblioteca)
 * Funciones puras de formateo JSON, planificación y reconciliación de entidades de sesión.
 */

import { patientKey, coerceFicha } from "../ficha-rules.mjs?v=87";
import { dialogAlert } from "./dom.js?v=78";

export const IMPORT_BATCH = 20;

export const SEED_PEOPLE = [
  ["Lucía Fernández", "30111201"], ["Mateo Ruiz", "30111202"], ["Sofía Álvarez", "30111203"],
  ["Benjamín Castro", "30111204"], ["Valentina Díaz", "30111205"], ["Joaquín Romero", "30111206"],
  ["Emma Suárez", "30111207"], ["Bautista Molina", "30111208"], ["Catalina Vargas", "30111209"],
  ["Thiago Navarro", "30111210"], ["Olivia Pereyra", "30111211"], ["Santino Acosta", "30111212"],
  ["Isabella Medina", "30111213"], ["Felipe Cabrera", "30111214"], ["Martina Ríos", "30111215"],
  ["Gael Paredes", "30111216"], ["Renata Quiroga", "30111217"], ["Ian Ferreyra", "30111218"],
  ["Zoe Maldonado", "30111219"], ["León Herrera", "30111220"],
];

export function sessionIdentity(item) {
  return `${patientKey(item)}|${String(item?.fechaSesion || "")}`;
}

export function planImport(rawItems, currentCache = [], blankItem = {}) {
  const byId = new Map(currentCache.filter((ficha) => ficha && ficha.id).map((ficha) => [ficha.id, ficha]));
  const bySession = new Map();
  for (const ficha of currentCache) {
    const key = sessionIdentity(ficha);
    if (key !== "|") bySession.set(key, ficha);
  }
  const planned = new Map();
  for (const item of rawItems) {
    const coerced = coerceFicha({ ...blankItem, ...item });
    const known = (item.id && byId.get(item.id)) || bySession.get(sessionIdentity(coerced));
    const id = (known && known.id) || (typeof item.id === "string" && item.id) || crypto.randomUUID();
    const data = { ...coerced, id };
    planned.set(id, data);
    byId.set(id, data);
    const key = sessionIdentity(data);
    if (key !== "|") bySession.set(key, data);
  }
  return [...planned.values()];
}

export async function executeBatchImport(parsed, cache, blankItem, upsert, fileOpen, showLibrary) {
  const raw = parsed.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  if (!raw.length) {
    dialogAlert("El archivo no tiene fichas.");
    return;
  }
  const fichas = planImport(raw, cache, blankItem);
  const already = fichas.filter((item) => cache.some((ficha) => ficha.id === item.id)).length;
  const fileBtn = fileOpen.closest("label");
  const fileLabel = fileBtn ? fileBtn.childNodes[0] : null;
  const previousLabel = fileLabel && fileLabel.textContent;
  fileOpen.disabled = true;
  const failed = [];
  try {
    for (let offset = 0; offset < fichas.length; offset += IMPORT_BATCH) {
      const batch = fichas.slice(offset, offset + IMPORT_BATCH);
      if (fileLabel) {
        fileLabel.textContent = `Importando ${Math.min(offset + batch.length, fichas.length)}/${fichas.length}… `;
      }
      const results = await Promise.allSettled(batch.map((item) => upsert(item)));
      results.forEach((result) => {
        if (result.status === "rejected") failed.push(result.reason);
      });
      if (failed.some((error) => error && error.auth)) break;
    }
    showLibrary();
    if (failed.some((error) => error && error.auth)) return;
    const saved = fichas.length - failed.length;
    const replaced = already ? ` ${already === 1 ? "1 ya estaba y se actualizó." : `${already} ya estaban y se actualizaron.`}` : "";
    if (!failed.length) {
      dialogAlert((saved === 1 ? "Se importó 1 ficha." : `Se importaron ${saved} fichas.`) + replaced);
    } else {
      dialogAlert(`Se importaron ${saved} de ${fichas.length}.${replaced} ${failed[0]?.message || ""}`.trim());
    }
  } finally {
    if (fileLabel && previousLabel) fileLabel.textContent = previousLabel;
    fileOpen.disabled = false;
  }
}

export function downloadJSON(data, todayStr = "", fileStem = "") {
  const isArray = Array.isArray(data);
  const rawName = fileStem
    || (isArray
      ? "fichas-atm"
      : `ficha-${(data.nombre || "paciente")}`);
  const safeName = rawName.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, "_").replace(/_+/g, "_");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName}-${todayStr || new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
