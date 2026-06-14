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
  sitePath,
  stemFromFile,
  HTML_LANG,
  HREFLANG,
} from "./i18n-urls.mjs";
import {
  LANG_CODES,
  langByCode,
  listHtmlFiles,
  expectedLangFromFile,
} from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  return expectedLangFromFile(file);
}

function resolveLocal(href, fromFile) {
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return null;
  const pathOnly = href.split("?")[0].split("#")[0];
  if (pathOnly.startsWith("/")) return pathOnly.slice(1);
  const dir = path.dirname(fromFile);
  return path.normalize(path.join(dir === "." ? "" : dir, pathOnly)).replace(/\\/g, "/");
}

function usesJsShell(html) {
  return /<div id="site-header-root"[^>]*>\s*<\/div>/.test(html);
}

function auditJsShellScripts(html, file) {
  if (!usesJsShell(html)) return;
  const prefix = file.includes("/") ? "../" : "";
  const required = [
    `${prefix}js/lang-routes`,
    `${prefix}js/header-include`,
    `${prefix}js/lang-picker`,
    `${prefix}js/nav-include`,
    `${prefix}partials/header-`,
    `${prefix}partials/nav-`,
  ];
  for (const fragment of required) {
    if (!html.includes(fragment)) {
      add("error", file, `JS shell: missing ${fragment}`);
    }
  }
}

function auditLangPicker(html, file) {
  if (file.includes("404")) return;

  if (usesJsShell(html)) {
    const stem = stemFromFile(file);
    const hreflangs = extractHreflangs(html);
    for (const code of LANG_CODES) {
      const expected = absoluteUrl(code, stem);
      const hl = HREFLANG[code];
      const found = hreflangs.find((h) => h.lang === hl);
      if (!found) {
        add("error", file, `JS shell hreflang: missing ${hl}`);
      } else if (found.href !== expected) {
        add(
          "error",
          file,
          `JS shell hreflang ${hl}: expected ${expected}, got ${found.href}`,
        );
      }
    }
    auditJsShellScripts(html, file);
    return;
  }

  if (!html.includes("lang-picker")) return;

  const hrefs = [
    ...html.matchAll(
      /class="lang-picker__option"[^>]*href=["']([^"'#]+)["']/gi,
    ),
  ].map((m) => m[1]);

  if (hrefs.length !== LANG_CODES.length) {
    add(
      "error",
      file,
      `Lang picker: expected ${LANG_CODES.length} options, got ${hrefs.length} (${hrefs.join(", ")})`,
    );
    return;
  }

  const stem = stemFromFile(file);
  for (const code of LANG_CODES) {
    const expected = sitePath(code, stem);
    const entry = langByCode(code);
    const found = hrefs.some((href) => {
      if (href === expected) return true;
      if (entry.isDefault && (href === "index.html" || href === "../index.html"))
        return stem === "index";
      return false;
    });
    if (!found) {
      add(
        "error",
        file,
        `Lang picker ${code}: missing href ${expected} (got ${hrefs.join(", ")})`,
      );
    }
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
        : pageLang === "pt"
          ? "/pt/articulos.html"
          : "articulos.html";
  if (!html.includes(mustInclude)) {
    add("error", file, `Articles nav missing link to ${mustInclude}`);
  }
}

const htmlFiles = listHtmlFiles(ROOT);
const allRootFiles = new Set(fs.readdirSync(ROOT));

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const lang = extractHtmlLang(html);

  if (!lang) add("error", file, "Missing <html lang>");
  else if (lang !== HTML_LANG[expectedLang(file)] && !file.includes("404"))
    add("error", file, `lang="${lang}" expected "${HTML_LANG[expectedLang(file)]}"`);

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

  if (html.includes('property="og:locale:alternate"'))
    add(
      "error",
      file,
      "Duplicate Open Graph: remove og:locale:alternate (use hreflang only)",
    );

  if (/articulos\.html$/.test(file) && !/<h1\b/i.test(html))
    add("error", file, "articulos index: missing <h1>");

  if (/articulos\.html$/.test(file)) {
    const h1n = (html.match(/<h1\b/gi) || []).length;
    if (h1n !== 1) add("error", file, `articulos index: expected 1 <h1>, got ${h1n}`);
  }

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

  auditLangPicker(html, file);
  auditLocalizedNav(html, file);

  if (
    html.includes("lang-picker") &&
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
  for (const lang of LANG_CODES) {
    const entry = langByCode(lang);
    const hl = HREFLANG[lang];
    const expected = absoluteUrl(lang, stem);
    const found = hreflangs.find((h) => h.lang === hl);
    if (found && found.href !== expected) {
      add("warning", file, `hreflang ${hl} expected ${expected}, got ${found.href}`);
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
    if (fl === "pt" && !/footer-pt(\.min)?\.js/.test(html))
      add("error", file, "Portuguese footer lang but missing footer-pt.js");
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
  else if (f === "pt/" || f === "pt") f = "pt/index.html";
  if (f.endsWith(".pdf")) {
    if (!allRootFiles.has(path.basename(f)))
      add("warning", "sitemap.xml", `Sitemap lists missing file: ${path.basename(f)}`);
  } else if (!htmlFiles.includes(f) && f !== "") {
    add("error", "sitemap.xml", `Sitemap URL has no local HTML: ${loc} (expected ${f})`);
  }
}

for (const stem of STEMS) {
  for (const lang of LANG_CODES) {
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
