#!/usr/bin/env node
/**
 * Propaga ARGENTINA_HOLIDAYS a booking-engine, GAS y lib_argentina_holidays.php.
 * Run: npm run holidays:sync
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ARGENTINA_HOLIDAYS } from "./argentina-holidays.mjs";
import { GAS_HOLIDAYS_FILE } from "./gas-source.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BEGIN = "BEGIN_ARGENTINA_HOLIDAYS";
const END = "END_ARGENTINA_HOLIDAYS";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function jsBody(indent) {
  return chunk([...ARGENTINA_HOLIDAYS], 5)
    .map((row) => `${indent}${row.map((d) => `"${d}"`).join(", ")},`)
    .join("\n")
    .replace(/,$/, "");
}

function phpBody(indent) {
  return chunk([...ARGENTINA_HOLIDAYS], 5)
    .map((row) => `${indent}${row.map((d) => `'${d}'`).join(", ")},`)
    .join("\n")
    .replace(/,$/, "");
}

function patch(rel, body) {
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, "utf8");
  const re = new RegExp(
    `([ \\t]*)// ${BEGIN}\\n[\\s\\S]*?\\n([ \\t]*)// ${END}`
  );
  if (!re.test(src)) {
    throw new Error(`Missing // ${BEGIN} … // ${END} markers in ${rel}`);
  }
  const next = src.replace(re, `$1// ${BEGIN}\n${body}\n$2// ${END}`);
  fs.writeFileSync(file, next);
  console.log("Updated", rel);
}

patch("booking/booking-engine.js", jsBody("    "));
patch(GAS_HOLIDAYS_FILE, jsBody("  "));
patch("admin/api/lib_argentina_holidays.php", phpBody("    "));
console.log(`Synced ${ARGENTINA_HOLIDAYS.length} holidays.`);
