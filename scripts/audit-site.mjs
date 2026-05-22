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
} from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const issues = [];
const warnings = [];

function add(severity, file, msg) {
  (severity === "error" ? issues : warnings).push({ file, msg });
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
  if (file.startsWith("en/")) return "en";
  if (file.startsWith("fr/")) return "fr";
  return "es";
}

function stemFromFile(file) {
  const base = file.includes("/") ? file.split("/").pop() : file;
  if (base === "index.html") return "index";
  if (base.startsWith("404")) return "404";
  return base.replace(/\.html$/, "");
}

function resolveLocal(href, fromFile) {
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return null;
  if (href.startsWith("/")) return href.slice(1);
  const dir = path.dirname(fromFile);
  return path.normalize(path.join(dir === "." ? "" : dir, href)).replace(/\\/g, "/");
}

function expectedLangSwitcherPaths(stem) {
  return {
    es:
      stem === "index"
        ? ["/", "index.html"]
        : [`/${stem}.html`, `${stem}.html`],
    en: [stem === "index" ? "/en/" : `/en/${stem}.html`],
    fr: [stem === "index" ? "/fr/" : `/fr/${stem}.html`],
  };
}

function auditLangSwitcher(html, file) {
  if (file.includes("404")) return;
  const block = html.match(/<ul class="lang-switcher">([\s\S]*?)<\/ul>/);
  if (!block) return;

  const hrefs = [...block[1].matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  if (hrefs.length !== 3) {
    add("error", file, `Lang switcher: expected 3 flags, got ${hrefs.length} (${hrefs.join(", ")})`);
    return;
  }

  const stem = stemFromFile(file);
  const exp = expectedLangSwitcherPaths(stem);
  const fr = hrefs.filter((h) => h.includes("/fr/") || h === "/fr/");
  const en = hrefs.filter((h) => h.includes("/en/") || h === "/en/");
  const es = hrefs.filter((h) => !h.includes("/en/") && !h.includes("/fr/"));

  if (fr.length !== 1 || !exp.fr.includes(fr[0])) {
    add("error", file, `Lang switcher FR: ${fr[0] || "(none)"} expected ${exp.fr.join(" or ")}`);
  }
  if (en.length !== 1 || !exp.en.includes(en[0])) {
    add("error", file, `Lang switcher EN: ${en[0] || "(none)"} expected ${exp.en.join(" or ")}`);
  }
  if (es.length !== 1 || !exp.es.includes(es[0])) {
    add("error", file, `Lang switcher ES: ${es[0] || "(none)"} expected ${exp.es.join(" or ")}`);
  }
}

function auditLocalizedNav(html, file) {
  if (!file.endsWith("articulos.html")) return;
  const pageLang = expectedLang(file);
  const mustInclude =
    pageLang === "fr"
      ? "/fr/articulos.html"
      : pageLang === "en"
        ? "/en/articulos.html"
        : "articulos.html";
  if (!html.includes(mustInclude)) {
    add("error", file, `Articles nav missing link to ${mustInclude}`);
  }
}

const htmlFiles = listHtmlFiles();
const allRootFiles = new Set(fs.readdirSync(ROOT));

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const lang = extractHtmlLang(html);

  if (!lang) add("error", file, "Missing <html lang>");
  else if (lang !== expectedLang(file) && !file.includes("404"))
    add("error", file, `lang="${lang}" expected "${expectedLang(file)}"`);

  if (/<\/main>\s*<\/section>/i.test(html))
    add("error", file, "Invalid nesting: </main> before </section>");

  if ((html.match(/<main/g) || []).length !== (html.match(/<\/main>/g) || []).length)
    add("error", file, "Unbalanced <main> tags");

  if (file.includes("/fr/") && /Squelette FR/i.test(html))
    add("error", file, "Phase 0 skeleton comment still present");

  const canonical = extractCanonical(html);
  const ogUrl = extractOgUrl(html);
  if (canonical && ogUrl && canonical !== ogUrl)
    add("warning", file, `canonical (${canonical}) ≠ og:url (${ogUrl})`);

  if (file !== "404-router.html" && !file.includes("404") && !canonical)
    add("warning", file, "Missing canonical URL");

  const hreflangs = extractHreflangs(html);
  if (!file.includes("404") && file !== "404-router.html") {
    const langs = hreflangs.map((h) => h.lang);
    if (!langs.includes("fr") && !file.startsWith("fr/"))
      add("warning", file, "Missing hreflang fr");
    if (!langs.includes("es-AR") && !langs.includes("es") && !file.startsWith("fr/"))
      add("warning", file, "Missing hreflang es-AR");
  }

  for (const { lang: hl, href } of hreflangs) {
    if (!href.startsWith(SITE))
      add("warning", file, `hreflang ${hl} not absolute: ${href}`);
  }

  auditLangSwitcher(html, file);
  auditLocalizedNav(html, file);

  if (
    html.includes("lang-switcher") &&
    html.includes("lang-preference.js") &&
    !html.includes("lang-routes.js") &&
    file !== "404-router.html"
  ) {
    add("error", file, "lang-preference without lang-routes.js (file:// links will break)");
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
      !href.includes("bootstrapthemes.co")
    ) {
      add("error", file, `Broken local link: ${href} (resolved: ${local})`);
    }
  }

  if (file.endsWith(".html") && !file.includes("404")) {
    const stem = stemFromFile(file);
    if (stem !== "404" && stem !== "index") {
      for (const [hl, expected] of [
        ["es-AR", absoluteUrl("es", stem)],
        ["en", absoluteUrl("en", stem)],
        ["fr", absoluteUrl("fr", stem)],
      ]) {
        const entry = hreflangs.find((h) => h.lang === hl);
        if (entry && entry.href !== expected) {
          add("warning", file, `hreflang ${hl} expected ${expected}, got ${entry.href}`);
        }
      }
    }
  }

  if (html.includes("data-footer-lang")) {
    const m = html.match(/data-footer-lang="([^"]+)"/);
    const fl = m ? m[1] : null;
    if (fl && fl !== expectedLang(file) && !file.includes("404"))
      add("error", file, `data-footer-lang="${fl}" vs page lang ${expectedLang(file)}`);
    if (fl === "fr" && !/footer-fr(\.min)?\.js/.test(html))
      add("error", file, "French footer lang but missing footer-fr.js");
    if (fl === "en" && !/footer-en(\.min)?\.js/.test(html))
      add("error", file, "English footer lang but missing footer-en.js");
    if (fl === "es" && !/footer-es(\.min)?\.js/.test(html) && !file.includes("404"))
      add("error", file, "Spanish footer lang but missing footer-es.js");
  }
}


const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  const u = new URL(loc);
  let f = u.pathname.replace(/^\//, "");
  if (f === "") f = "index.html";
  else if (f === "en/" || f === "en") f = "en/index.html";
  else if (f === "fr/" || f === "fr") f = "fr/index.html";
  if (f.endsWith(".pdf")) {
    if (!allRootFiles.has(path.basename(f)))
      add("warning", "sitemap.xml", `Sitemap lists missing file: ${path.basename(f)}`);
  } else if (!htmlFiles.includes(f) && f !== "") {
    add("error", "sitemap.xml", `Sitemap URL has no local HTML: ${loc} (expected ${f})`);
  }
}

for (const stem of STEMS) {
  for (const lang of ["es", "en", "fr"]) {
    const rel = repoPath(lang, stem);
    if (!htmlFiles.includes(rel)) {
      add("error", "structure", `Missing page file: ${rel}`);
    }
  }
}

console.log("=== ERRORS (" + issues.length + ") ===");
issues.forEach((i) => console.log(`[${i.file}] ${i.msg}`));
console.log("\n=== WARNINGS (" + warnings.length + ") ===");
warnings.forEach((i) => console.log(`[${i.file}] ${i.msg}`));
process.exit(issues.length ? 1 : 0);
