/**
 * Shared Artículos submenu HTML from pathology-content.
 */
import { PATHOLOGIES } from "./pathology-content.mjs";

export function articlesSubmenuItems(lang) {
  return PATHOLOGIES.map((p) => {
    const label = p[lang].breadcrumb;
    return `      <li><a href="${p.stem}.html" title="${label}">${label}</a></li>`;
  }).join("\n");
}

export function patchArticlesSubmenu(html, submenu) {
  const re =
    /(<li class="has-sub">\s*<a href="articulos\.html"[^>]*>[^<]*<\/a>\s*<ul>\s*)([\s\S]*?)(\s*<\/ul>\s*<\/li>\s*<li class="has-sub">)/;
  if (!re.test(html)) {
    return null;
  }
  return html.replace(re, `$1\n${submenu}\n$3`);
}

export function countArticlesSubmenuItems(html) {
  const m = html.match(
    /<a href="articulos\.html"[^>]*>[\s\S]*?<ul>\s*([\s\S]*?)<\/ul>/,
  );
  if (!m) return 0;
  return (m[1].match(/<li>/g) || []).length;
}
