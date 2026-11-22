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
import { buildAllJsBundles } from "./build-js-bundles.mjs";
import { allBundlePaths } from "./js-bundles.mjs";
import {
  applyFaviconCacheQuery,
  faviconCacheVersion,
  stripFaviconCacheQuery,
} from "./favicon-version.mjs";
import {
  applyCacheQueryToHtml,
  applyImageCacheQuery,
  stripCacheQueryFromHtml,
  stripImageCacheQuery,
  syncHtmlAssetRefs,
} from "./minify-assets-html.mjs";

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

function assetCacheVersion(refs) {
  let max = 0;
  for (const rel of refs) {
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

  const bundleRows = buildAllJsBundles();
  const bundles = allBundlePaths();

  const cssVersion = cssCacheVersion();
  const shellVersion = shellCacheVersion();
  const assetVersion = assetCacheVersion([
    ...sources.map((rel) => toMinPath(rel)),
    ...bundles,
  ]);
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
  const htmlFilesToProcess = [...listHtmlFiles(ROOT)];
  if (fs.existsSync(path.join(ROOT, "admin/index.html"))) {
    htmlFilesToProcess.push("admin/index.html");
  }
  for (const file of htmlFilesToProcess) {
    const full = path.join(ROOT, file);
    const original = fs.readFileSync(full, "utf8");
    let next = syncHtmlAssetRefs(original, sources);
    next = stripCacheQueryFromHtml(next);
    next = applyCacheQueryToHtml(next, assetVersion, sources, bundles);
    next = stripFaviconCacheQuery(next);
    next = applyFaviconCacheQuery(next, faviconVersion);
    next = stripImageCacheQuery(next);
    next = applyImageCacheQuery(next);
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
  if (bundleRows.length) {
    console.log(`\n${bundleRows.length} JS bundle(s) built.`);
  }
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
