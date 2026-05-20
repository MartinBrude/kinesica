#!/usr/bin/env node
/**
 * Minifica CSS/JS propios del sitio → archivos .min (producción).
 * Los fuentes (.css / .js sin .min) siguen siendo los que editás.
 *
 *   npm run assets:build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import esbuild from "esbuild";
import {
  ROOT,
  getSourceManifest,
  toMinPath,
} from "../assets.config.cjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function minifyOne(rel) {
  const inPath = path.join(ROOT, rel);
  const outPath = path.join(ROOT, toMinPath(rel));
  if (!fs.existsSync(inPath)) {
    throw new Error(`Missing source: ${rel}`);
  }

  const before = fs.statSync(inPath).size;
  const isCss = rel.endsWith(".css");

  await esbuild.build({
    entryPoints: [inPath],
    outfile: outPath,
    minify: true,
    bundle: false,
    logLevel: "silent",
    ...(isCss
      ? { loader: { ".css": "css" } }
      : { target: ["es2018"], legalComments: "none" }),
  });

  const after = fs.statSync(outPath).size;
  const pct = before ? Math.round((1 - after / before) * 100) : 0;
  return { rel, out: toMinPath(rel), before, after, pct };
}

function listHtmlFiles() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html") && !f.startsWith("cv-"));
  for (const lang of ["en", "fr"]) {
    const dir = path.join(ROOT, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${lang}/${f}`);
    }
  }
  return files;
}

/** Apunta href/src de fuentes → .min en HTML (idempotente). */
function syncHtmlAssetRefs(html, sources) {
  let out = html;
  for (const rel of sources) {
    const min = toMinPath(rel);
    if (rel === min) continue;
    const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(href|src)=(["'])(?:\\.\\./)?${esc}\\2`,
      "g",
    );
    out = out.replace(re, (match, attr, quote) => {
      const prefix = match.includes("../") ? "../" : "";
      return `${attr}=${quote}${prefix}${min}${quote}`;
    });
  }
  return out;
}

async function main() {
  const { css, js } = getSourceManifest();
  const sources = [...css, ...js];
  const rows = [];

  for (const rel of sources) {
    rows.push(await minifyOne(rel));
  }

  let htmlChanged = 0;
  for (const file of listHtmlFiles()) {
    const full = path.join(ROOT, file);
    const original = fs.readFileSync(full, "utf8");
    const next = syncHtmlAssetRefs(original, sources);
    if (next !== original) {
      fs.writeFileSync(full, next);
      htmlChanged++;
    }
  }

  console.log("Minified assets:\n");
  for (const r of rows) {
    console.log(
      `  ${r.rel} → ${r.out}  ${formatKb(r.before)} → ${formatKb(r.after)} (−${r.pct}%)`,
    );
  }
  console.log(`\n${rows.length} file(s) minified.`);
  if (htmlChanged) {
    console.log(`${htmlChanged} HTML file(s) updated to use .min assets.`);
  } else {
    console.log("HTML already references .min assets.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
