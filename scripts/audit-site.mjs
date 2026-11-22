#!/usr/bin/env node
/**
 * Site audit: links, metadata, hreflang, assets.
 * Run: node scripts/audit-site.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  SITE,
  STEMS,
  absoluteUrl,
  repoPath,
  stemFromFile,
  HTML_LANG,
  HREFLANG,
  ES_ONLY_STEMS,
} from "./i18n-urls.mjs";
import { LANG_CODES, listHtmlFiles, expectedLangFromFile } from "./languages.mjs";
import {
  extractHrefs,
  extractCanonical,
  extractHreflangs,
  extractOgUrl,
  extractHtmlLang,
  resolveLocal,
  auditLangPicker,
  auditLocalizedNav,
} from "./audit-site-checks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const issues = [];
const warnings = [];

function add(severity, file, msg) {
  (severity === "error" ? issues : warnings).push({ file, msg });
}

const htmlFiles = listHtmlFiles(ROOT);
const allRootFiles = new Set(fs.readdirSync(ROOT));

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const lang = extractHtmlLang(html);
  const expected = expectedLangFromFile(file);

  if (!lang) add("error", file, "Missing <html lang>");
  else if (lang !== HTML_LANG[expected] && !file.includes("404")) {
    add("error", file, `lang="${lang}" expected "${HTML_LANG[expected]}"`);
  }

  if (/<\/main>\s*<\/section>/i.test(html)) add("error", file, "Invalid nesting: </main> before </section>");
  if ((html.match(/<main/g) || []).length !== (html.match(/<\/main>/g) || []).length) {
    add("error", file, "Unbalanced <main> tags");
  }
  if (file.includes("/fr/") && /Squelette FR/i.test(html)) add("error", file, "Phase 0 skeleton comment still present");

  const canonical = extractCanonical(html);
  const ogUrl = extractOgUrl(html);
  if (canonical && ogUrl && canonical !== ogUrl) add("warning", file, `canonical (${canonical}) ≠ og:url (${ogUrl})`);
  if (html.includes('property="og:locale:alternate"')) {
    add("error", file, "Duplicate Open Graph: remove og:locale:alternate (use hreflang only)");
  }

  if (/articulos\.html$/.test(file)) {
    const h1n = (html.match(/<h1\b/gi) || []).length;
    if (h1n === 0) add("error", file, "articulos index: missing <h1>");
    else if (h1n !== 1) add("error", file, `articulos index: expected 1 <h1>, got ${h1n}`);
  }

  if (file !== "404-router.html" && !file.includes("404") && !canonical) add("warning", file, "Missing canonical URL");

  const hreflangs = extractHreflangs(html);
  if (!file.includes("404") && file !== "404-router.html" && !ES_ONLY_STEMS.includes(stemFromFile(file))) {
    const langs = hreflangs.map((h) => h.lang);
    if (!langs.includes("fr") && !file.startsWith("fr/")) add("warning", file, "Missing hreflang fr");
    if (!langs.includes("es-AR") && !langs.includes("es") && !file.startsWith("fr/")) {
      add("warning", file, "Missing hreflang es-AR");
    }
  }

  for (const { lang: hl, href } of hreflangs) {
    if (!href.startsWith(SITE)) add("warning", file, `hreflang ${hl} not absolute: ${href}`);
  }

  auditLangPicker(html, file, add);
  auditLocalizedNav(html, file, add);

  if (
    html.includes("lang-picker") &&
    html.includes("lang-preference.js") &&
    !html.includes("lang-routes.js") &&
    !html.includes("shell-header-") &&
    file !== "404-router.html"
  ) {
    add("error", file, "lang-preference without lang-routes.js (file:// links will break)");
  }

  if (
    html.includes("lang-picker") &&
    html.includes("head-lang") &&
    !html.includes("shell-header-") &&
    file !== "404-router.html"
  ) {
    add("error", file, "head-lang without shell-header bundle (lang routes missing)");
  }

  for (const href of extractHrefs(html)) {
    const local = resolveLocal(href, file);
    if (!local) continue;
    const base = local.split("/").pop();
    if (base.includes("..")) {
      add("error", file, `Suspicious href: ${href}`);
      continue;
    }
    if (
      !fs.existsSync(path.join(ROOT, local)) &&
      !base.endsWith(".pdf") &&
      base !== "" &&
      !href.includes("wa.me") &&
      !href.includes("maps.") &&
      !href.includes("google.com") &&
      !href.includes("facebook.com") &&
      !href.includes("instagram.com") &&
      !href.includes("bootstrapthemes.co")
    ) {
      add("error", file, `Broken local link: ${href} (resolved: ${local})`);
    }
  }

  if (file.endsWith(".html") && !file.includes("404")) {
    const stem = stemFromFile(file);
    if (stem !== "404" && stem !== "index") {
      for (const code of LANG_CODES) {
        const hl = HREFLANG[code];
        const expectedUrl = absoluteUrl(code, stem);
        const found = hreflangs.find((h) => h.lang === hl);
        if (found && found.href !== expectedUrl) {
          add("warning", file, `hreflang ${hl} expected ${expectedUrl}, got ${found.href}`);
        }
      }
    }
  }

  if (html.includes("data-footer-lang")) {
    const m = html.match(/data-footer-lang="([^"]+)"/);
    const fl = m ? m[1] : null;
    if (fl && fl !== expected && !file.includes("404")) add("error", file, `data-footer-lang="${fl}" vs page lang ${expected}`);
    if (fl === "fr" && !/footer-fr(\.min)?\.js/.test(html)) add("error", file, "French footer lang but missing footer-fr.js");
    if (fl === "en" && !/footer-en(\.min)?\.js/.test(html)) add("error", file, "English footer lang but missing footer-en.js");
    if (fl === "pt" && !/footer-pt(\.min)?\.js/.test(html)) add("error", file, "Portuguese footer lang but missing footer-pt.js");
    if (fl === "es" && !/footer-es(\.min)?\.js/.test(html) && !file.includes("404")) add("error", file, "Spanish footer lang but missing footer-es.js");
  }
}

const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  let f = new URL(loc).pathname.replace(/^\//, "");
  if (f === "") f = "index.html";
  else if (f === "en/" || f === "en") f = "en/index.html";
  else if (f === "fr/" || f === "fr") f = "fr/index.html";
  else if (f === "pt/" || f === "pt") f = "pt/index.html";
  if (f.endsWith(".pdf")) {
    if (!allRootFiles.has(path.basename(f))) add("warning", "sitemap.xml", `Sitemap lists missing file: ${path.basename(f)}`);
  } else if (!htmlFiles.includes(f) && f !== "") {
    add("error", "sitemap.xml", `Sitemap URL has no local HTML: ${loc} (expected ${f})`);
  }
}

for (const stem of STEMS) {
  for (const lang of LANG_CODES) {
    const rel = repoPath(lang, stem);
    if (!htmlFiles.includes(rel)) add("error", "structure", `Missing page file: ${rel}`);
  }
}

console.log("=== ERRORS (" + issues.length + ") ===");
issues.forEach((i) => console.log(`[${i.file}] ${i.msg}`));
console.log("\n=== WARNINGS (" + warnings.length + ") ===");
warnings.forEach((i) => console.log(`[${i.file}] ${i.msg}`));
process.exit(issues.length ? 1 : 0);
