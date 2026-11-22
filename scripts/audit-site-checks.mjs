/**
 * HTML extractors and shell/lang-picker/nav audit helpers for audit-site.mjs.
 */
import path from "path";
import {
  absoluteUrl,
  sitePath,
  stemFromFile,
  HREFLANG,
  ES_ONLY_STEMS,
} from "./i18n-urls.mjs";
import { LANG_CODES, langByCode, expectedLangFromFile } from "./languages.mjs";

export function extractHrefs(html) {
  const hrefs = [];
  const re = /href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

export function extractCanonical(html) {
  const m = html.match(/<link rel="canonical" href="([^"]+)"/);
  return m ? m[1] : null;
}

export function extractHreflangs(html) {
  const langs = [];
  const re = /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) langs.push({ lang: m[1], href: m[2] });
  return langs;
}

export function extractOgUrl(html) {
  const m = html.match(/<meta property="og:url" content="([^"]+)"/);
  return m ? m[1] : null;
}

export function extractHtmlLang(html) {
  const m = html.match(/<html lang="([^"]+)"/);
  return m ? m[1] : null;
}

export function resolveLocal(href, fromFile) {
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return null;
  const pathOnly = href.split("?")[0].split("#")[0];
  if (pathOnly.startsWith("/")) return pathOnly.slice(1);
  const dir = path.dirname(fromFile);
  return path.normalize(path.join(dir === "." ? "" : dir, pathOnly)).replace(/\\/g, "/");
}

export function usesJsShell(html) {
  return /<div id="site-header-root"[^>]*>\s*<\/div>/.test(html);
}

export function auditJsShellScripts(html, file, add) {
  if (!usesJsShell(html)) return;
  const prefix = file.includes("/") ? "../" : "";
  const required = [`${prefix}js/shell-header-`, `${prefix}js/shell-footer-`, `${prefix}js/ui-core`];
  for (const fragment of required) {
    if (!html.includes(fragment)) {
      add("error", file, `JS shell: missing ${fragment}`);
    }
  }
}

export function auditLangPicker(html, file, add) {
  if (file.includes("404")) return;

  if (usesJsShell(html)) {
    const stem = stemFromFile(file);
    if (ES_ONLY_STEMS.includes(stem)) {
      auditJsShellScripts(html, file, add);
      return;
    }
    const hreflangs = extractHreflangs(html);
    for (const code of LANG_CODES) {
      const expected = absoluteUrl(code, stem);
      const hl = HREFLANG[code];
      const found = hreflangs.find((h) => h.lang === hl);
      if (!found) {
        add("error", file, `JS shell hreflang: missing ${hl}`);
      } else if (found.href !== expected) {
        add("error", file, `JS shell hreflang ${hl}: expected ${expected}, got ${found.href}`);
      }
    }
    auditJsShellScripts(html, file, add);
    return;
  }

  if (!html.includes("lang-picker")) return;

  const hrefs = [...html.matchAll(/class="lang-picker__option"[^>]*href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  if (hrefs.length !== LANG_CODES.length) {
    add("error", file, `Lang picker: expected ${LANG_CODES.length} options, got ${hrefs.length} (${hrefs.join(", ")})`);
    return;
  }

  const stem = stemFromFile(file);
  for (const code of LANG_CODES) {
    const expected = sitePath(code, stem);
    const entry = langByCode(code);
    const found = hrefs.some((href) => {
      if (href === expected) return true;
      if (entry.isDefault && (href === "index.html" || href === "../index.html")) return stem === "index";
      return false;
    });
    if (!found) {
      add("error", file, `Lang picker ${code}: missing href ${expected} (got ${hrefs.join(", ")})`);
    }
  }
}

export function auditLocalizedNav(html, file, add) {
  if (!file.endsWith("articulos.html")) return;
  const pageLang = expectedLangFromFile(file);
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
