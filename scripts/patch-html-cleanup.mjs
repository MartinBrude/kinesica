#!/usr/bin/env node
/**
 * Remove IE8 shims, Calendly blocks, and #turnos booking comment leftovers.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listHtml() {
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  for (const lang of ["en", "fr"]) {
    const dir = path.join(ROOT, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${lang}/${f}`);
    }
  }
  return files;
}

const IE8_BLOCK =
  /[\s]*<!-- HTML5 shim and Respond\.js for IE8[\s\S]*?<!\[endif\]-->\s*/gi;

const CALENDLY_SECTION =
  /[\s]*<!--\s*\n\s*<section id="turnos"[\s\S]*?<\/section>\s*\n\s*-->\s*/gi;

const TURNOS_BTN =
  /[\s]*<!--\s*<a href="[^"]*#turnos"[^>]*>[\s\S]*?<\/a>\s*-->\s*/gi;

let count = 0;
for (const file of listHtml()) {
  const p = path.join(ROOT, file);
  let html = fs.readFileSync(p, "utf8");
  const orig = html;
  html = html.replace(IE8_BLOCK, "\n");
  html = html.replace(CALENDLY_SECTION, "\n");
  html = html.replace(TURNOS_BTN, "\n");
  if (html !== orig) {
    fs.writeFileSync(p, html);
    count++;
    console.log("cleaned", file);
  }
}

console.log(`Done. ${count} file(s) updated.`);
