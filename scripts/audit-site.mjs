#!/usr/bin/env node
/**
 * Site audit: links, metadata, hreflang, assets.
 * Run: node scripts/audit-site.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.kinesica.com.ar";

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const allFiles = new Set(fs.readdirSync(ROOT));
const issues = [];
const warnings = [];

function add(severity, file, msg) {
  (severity === "error" ? issues : warnings).push({ file, msg });
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

function extractCanonical(html) {
  const m = html.match(/<link rel="canonical" href="([^"]+)"/);
  return m ? m[1] : null;
}

function extractHreflangs(html) {
  const langs = [];
  const re = /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) langs.push({ lang: m[1], href: m[2] });
  return langs;
}

function extractOgUrl(html) {
  const m = html.match(/<meta property="og:url" content="([^"]+)"/);
  return m ? m[1] : null;
}

function extractHtmlLang(html) {
  const m = html.match(/<html lang="([^"]+)"/);
  return m ? m[1] : null;
}

function expectedLang(file) {
  if (file.endsWith("_fr.html")) return "fr";
  if (file.endsWith("_en.html")) return "en";
  return "es";
}

function stemFromFile(file) {
  if (file === "index.html" || file === "index_en.html" || file === "index_fr.html")
    return "index";
  const m = file.match(/^(.+)_(en|fr)\.html$/);
  if (m) return m[1];
  if (file.startsWith("404")) return "404";
  return file.replace(/\.html$/, "");
}

function resolveLocal(href, fromFile) {
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return null;
  if (href.startsWith("/")) return href.slice(1);
  return path.normalize(path.join(path.dirname(fromFile), href)).replace(/\\/g, "/");
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const lang = extractHtmlLang(html);

  if (!lang) add("error", file, "Missing <html lang>");
  else if (lang !== expectedLang(file) && !file.startsWith("404"))
    add("error", file, `lang="${lang}" expected "${expectedLang(file)}"`);

  if (/<\/main>\s*<\/section>/i.test(html))
    add("error", file, "Invalid nesting: </main> before </section>");

  if ((html.match(/<main/g) || []).length !== (html.match(/<\/main>/g) || []).length)
    add("error", file, "Unbalanced <main> tags");

  if (file.includes("_fr") && /Squelette FR/i.test(html))
    add("error", file, "Phase 0 skeleton comment still present");

  const canonical = extractCanonical(html);
  const ogUrl = extractOgUrl(html);
  if (canonical && ogUrl && canonical !== ogUrl)
    add("warning", file, `canonical (${canonical}) ≠ og:url (${ogUrl})`);

  if (file !== "404-router.html" && !file.startsWith("404") && !canonical)
    add("warning", file, "Missing canonical URL");

  const hreflangs = extractHreflangs(html);
  if (!file.startsWith("404") && file !== "404-router.html") {
    const langs = hreflangs.map((h) => h.lang);
    if (!langs.includes("fr") && !file.endsWith("_fr.html"))
      add("warning", file, "Missing hreflang fr");
    if (!langs.includes("es") && file !== "index_fr.html")
      add("warning", file, "Missing hreflang es");
  }

  for (const { lang: hl, href } of hreflangs) {
    if (!href.startsWith(SITE))
      add("warning", file, `hreflang ${hl} not absolute: ${href}`);
  }

  for (const href of extractHrefs(html)) {
    const local = resolveLocal(href, file);
    if (!local) continue;
    const base = local.split("/").pop();
    if (base.includes("..")) {
      add("error", file, `Suspicious href: ${href}`);
      continue;
    }
    const fullPath = path.join(ROOT, local);
    if (
      !fs.existsSync(fullPath) &&
      !base.endsWith(".pdf") &&
      base !== "" &&
      !href.includes("wa.me") &&
      !href.includes("maps.") &&
      !href.includes("google.com") &&
      !href.includes("facebook.com") &&
      !href.includes("instagram.com") &&
      !href.includes("bootstrapthemes.co") &&
      !href.includes("#")
    ) {
      add("error", file, `Broken local link: ${href} (resolved: ${local})`);
    }
  }

  if (file.endsWith(".html") && !file.startsWith("404")) {
    const stem = stemFromFile(file);
    if (stem !== "404" && stem !== "index") {
      const es = `${stem}.html`;
      const en = `${stem}_en.html`;
      const fr = `${stem}_fr.html`;
      for (const [hl, expected] of [
        ["es", `${SITE}/${es}`],
        ["en", `${SITE}/${en}`],
        ["fr", `${SITE}/${fr}`],
      ]) {
        const entry = hreflangs.find((h) => h.lang === hl);
        if (entry && entry.href !== expected && stem === "index") {
          if (hl === "es" && entry.href !== `${SITE}/` && entry.href !== expected)
            add("warning", file, `hreflang es expected ${SITE}/ or ${expected}, got ${entry.href}`);
        } else if (entry && entry.href !== expected && stem !== "index") {
          add("warning", file, `hreflang ${hl} expected ${expected}, got ${entry.href}`);
        }
      }
    }
  }

  if (html.includes("data-footer-lang")) {
    const m = html.match(/data-footer-lang="([^"]+)"/);
    const fl = m ? m[1] : null;
    if (fl && fl !== expectedLang(file) && !file.startsWith("404"))
      add("error", file, `data-footer-lang="${fl}" vs page lang ${expectedLang(file)}`);
    if (fl === "fr" && !html.includes("footer-fr.js"))
      add("error", file, "French footer lang but missing footer-fr.js");
    if (fl === "en" && !html.includes("footer-en.js"))
      add("error", file, "English footer lang but missing footer-en.js");
    if (fl === "es" && !html.includes("footer-es.js") && !file.startsWith("404"))
      add("error", file, "Spanish footer lang but missing footer-es.js");
  }
}

// PDF assets
for (const pdf of ["cv-norberto-brude.pdf", "cv-norberto-brude_en.pdf"]) {
  if (!allFiles.has(pdf)) warnings.push({ file: "sitemap/refs", msg: `Missing ${pdf} in repo root` });
}

// sitemap URLs vs files
const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  const u = new URL(loc);
  let f = u.pathname.replace(/^\//, "");
  if (f === "") f = "index.html";
  if (f.endsWith(".pdf")) {
    if (!allFiles.has(f)) add("warning", "sitemap.xml", `Sitemap lists missing file: ${f}`);
  } else if (!htmlFiles.includes(f) && f !== "") {
    add("error", "sitemap.xml", `Sitemap URL has no local HTML: ${loc}`);
  }
}

console.log("=== ERRORS (" + issues.length + ") ===");
issues.forEach((i) => console.log(`[${i.file}] ${i.msg}`));
console.log("\n=== WARNINGS (" + warnings.length + ") ===");
warnings.forEach((i) => console.log(`[${i.file}] ${i.msg}`));
process.exit(issues.length ? 1 : 0);
