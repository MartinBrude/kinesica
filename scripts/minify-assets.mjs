#!/usr/bin/env node
/**
 * Minifica CSS/JS propios del sitio → archivos .min (producción).
 * Los fuentes (.css / .js sin .min) siguen siendo los que editás.
 *
 * Cache bust: ?v= en refs locales .min.css / .min.js (ver assetCacheVersion).
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
import { listHtmlFiles } from "./languages.mjs";
import {
  applyFaviconCacheQuery,
  faviconCacheVersion,
  stripFaviconCacheQuery,
} from "./favicon-version.mjs";

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

/** Quita ?v=… de CSS/JS en HTML (idempotente). */
function stripCacheQueryFromHtml(html) {
  return html.replace(
    /((?:href|src)=["'][^"']+\.(?:min\.)?(?:css|js))\?v=\d+(["'])/g,
    "$1$2",
  );
}

/** Añade ?v= a CSS/JS locales minificados del manifest (idempotente tras strip). */
function applyCacheQueryToHtml(html, version, sources) {
  let out = html;
  for (const rel of sources) {
    const min = toMinPath(rel);
    const esc = min.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `((?:href|src)=["'])((?:\\.\\./)?${esc})(["'])`,
      "g",
    );
    out = out.replace(re, `$1$2?v=${version}$3`);
  }
  return out;
}

function assetCacheVersion(sources) {
  let max = 0;
  for (const rel of sources) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    max = Math.max(max, fs.statSync(p).mtimeMs);
  }
  return String(Math.floor(max / 1000) || Math.floor(Date.now() / 1000));
}

function cssCacheVersion() {
  const stylePath = path.join(ROOT, "css/style.css");
  const stat = fs.statSync(stylePath);
  return String(Math.floor(stat.mtimeMs / 1000));
}

const SHELL_JS = [
  "partials/nav-es.js",
  "partials/nav-en.js",
  "partials/nav-fr.js",
  "partials/nav-pt.js",
  "partials/header-es.js",
  "partials/header-en.js",
  "partials/header-fr.js",
  "partials/header-pt.js",
  "js/snippet-lang.js",
  "js/nav-include.js",
  "js/header-include.js",
  "js/lang-picker.js",
];

function shellCacheVersion() {
  let max = 0;
  for (const rel of SHELL_JS) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    max = Math.max(max, fs.statSync(p).mtimeMs);
  }
  return String(Math.floor(max / 1000) || cssCacheVersion());
}

async function main() {
  const { css, js } = getSourceManifest();
  const sources = [...css, ...js];
  const rows = [];

  for (const rel of sources) {
    rows.push(await minifyOne(rel));
  }

  const cssVersion = cssCacheVersion();
  const shellVersion = shellCacheVersion();
  const assetVersion = assetCacheVersion(sources);
  const faviconVersion = faviconCacheVersion(ROOT);
  fs.writeFileSync(
    path.join(ROOT, "css", ".asset-version.json"),
    JSON.stringify(
      {
        style: cssVersion,
        shell: shellVersion,
        assets: assetVersion,
        favicon: faviconVersion,
        note: "HTML refs locales usan ?v=assets tras npm run assets:build; favicon usa ?v=favicon.",
      },
      null,
      2,
    ) + "\n",
  );

  let htmlChanged = 0;
  for (const file of listHtmlFiles(ROOT)) {
    const full = path.join(ROOT, file);
    const original = fs.readFileSync(full, "utf8");
    let next = syncHtmlAssetRefs(original, sources);
    next = stripCacheQueryFromHtml(next);
    next = applyCacheQueryToHtml(next, assetVersion, sources);
    next = stripFaviconCacheQuery(next);
    next = applyFaviconCacheQuery(next, faviconVersion);
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
    console.log(`${htmlChanged} HTML file(s) synced (refs .min + ?v=${assetVersion}).`);
  } else {
    console.log(`HTML refs OK (?v=${assetVersion}).`);
  }
  console.log(
    `Build metadata: css/.asset-version.json (style=${cssVersion}, shell=${shellVersion}, assets=${assetVersion}, favicon=${faviconVersion}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
