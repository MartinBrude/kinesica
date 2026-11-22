/**
 * Fuente del backend de turnos en Google Apps Script (booking/gas/*.js).
 *
 * Apps Script ejecuta todos los archivos del proyecto en un único ámbito global,
 * en el orden de filePushOrder. Los tests replican eso concatenando en el mismo orden.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const GAS_DIR = path.join(ROOT, "booking", "gas");
/** Archivo que contiene los marcadores BEGIN/END_ARGENTINA_HOLIDAYS. */
export const GAS_HOLIDAYS_FILE = "booking/gas/02-windows-holidays.js";

/** Nombres de archivo .js del proyecto GAS, en orden de carga (prefijo numérico). */
export function gasSourceFiles() {
  return fs
    .readdirSync(GAS_DIR)
    .filter((name) => /^\d{2}-[\w-]+\.js$/.test(name))
    .sort();
}

/** Fuente completa concatenada (equivalente al ámbito global del proyecto). */
export function readGasSource() {
  return gasSourceFiles()
    .map((name) => fs.readFileSync(path.join(GAS_DIR, name), "utf8"))
    .join("\n");
}
