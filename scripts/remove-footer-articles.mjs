#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BLOCKS = [
  /\s*<div class="col-lg-2 col-md-2 col-sm-2 col-xs-12">\s*<div class="footer-widget">\s*<h2 class="widget-title">Artículos<\/h2>[\s\S]*?<\/div>\s*<\/div>/g,
  /\s*<div class="col-lg-2 col-md-2 col-sm-2 col-xs-12">\s*<div class="footer-widget">\s*<h2 class="widget-title">Articles<\/h2>[\s\S]*?<\/div>\s*<\/div>/g,
];

function listHtml() {
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  for (const lang of ["en", "fr"]) {
    for (const f of fs.readdirSync(path.join(ROOT, lang))) {
      if (f.endsWith(".html")) files.push(`${lang}/${f}`);
    }
  }
  return files;
}

let n = 0;
for (const file of listHtml()) {
  if (/404/.test(file)) continue;
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const orig = html;
  html = html.replace(
    /<div id="site-footer-root data-footer-lang=/g,
    '<div id="site-footer-root" data-footer-lang=',
  );
  html = html.replace(/col-lg-3 col-md-2 col-sm-2 col-xs-12">\s*<div class="footer-widget">\s*<h2 class="widget-title">Métodos/g, 'col-lg-4 col-md-2 col-sm-2 col-xs-12">\n        <div class="footer-widget">\n          <h2 class="widget-title">Métodos');
  html = html.replace(/col-lg-3 col-md-2 col-sm-2 col-xs-12">\s*<div class="footer-widget">\s*<h2 class="widget-title">Methods/g, 'col-lg-4 col-md-2 col-sm-2 col-xs-12">\n        <div class="footer-widget">\n          <h2 class="widget-title">Methods');
  html = html.replace(/col-lg-3 col-md-2 col-sm-2 col-xs-12">\s*<div class="footer-widget">\s*<h2 class="widget-title">Méthodes/g, 'col-lg-4 col-md-2 col-sm-2 col-xs-12">\n        <div class="footer-widget">\n          <h2 class="widget-title">Méthodes');
  for (const re of BLOCKS) {
    html = html.replace(re, "");
  }
  if (html !== orig) {
    fs.writeFileSync(full, html);
    n++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${n} file(s).`);
