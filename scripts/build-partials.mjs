#!/usr/bin/env node
/**
 * Generate partials/header-*, nav-*, footer-*, cta-strip-*, whatsapp-float-* from strings.
 * Run: node scripts/build-partials.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LANG_CODES } from "./languages.mjs";
import {
  PARTIAL_STRINGS,
  TECHNIQUE_NAV_STEMS,
} from "./partials-strings.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "partials");

function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function writePartial(name, lang, comment, body) {
  const key = lang.toUpperCase();
  const file = path.join(OUT, `${name}-${lang}.js`);
  const content = `/* ${comment} */
window.__KINESICA_${name.replace(/-/g, "_").toUpperCase()}_SNIPPET_${key} = \`
${body}
\`.trim();
`;
  fs.writeFileSync(file, content);
  return file;
}

function footerPrefix(lang) {
  return lang === "es" ? "" : `/${lang}`;
}

function buildHeader(lang, s) {
  return writePartial(
    "header",
    lang,
    s.headerComment,
    `  <div class="header-top">
    <div class="container">
      <div class="row">
        <div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
          <span class="text-block time-block">
            <span class="time-text">${s.schedule}</span>
          </span>
        </div>
        <div class="col-lg-8 col-md-8 col-sm-8 col-xs-12">
          <div class="top-text">
            <div class="lang-picker lang-picker--bar" data-lang-picker></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <header class="header">
    <div class="container">
      <div class="row">
        <div class="col-lg-4 col-md-4 col-sm-12 col-xs-12">
          <a href="${s.homeHref}"><img src="${s.logoSrc}" alt="${s.logoAlt}" width="224" height="64"
              loading="eager" /></a>
        </div>
        <div class="col-lg-8 col-md-8 col-sm-12 col-xs-12">
          <div class="header__toolbar">
            <div class="header__mobile-lang">
              <div class="lang-picker lang-picker--compact" data-lang-picker></div>
            </div>
            <nav class="navigation">
              <div id="navigation" class="nav navbar-nav navbar-right" data-nav-inject="true"></div>
            </nav>
          </div>
        </div>
      </div>
    </div>
  </header>`,
  );
}

function buildNav(lang, s) {
  const techniqueItems = TECHNIQUE_NAV_STEMS.map((stem) => {
    const t = s.techniques[stem];
    return `      <li><a href="${stem}.html" title="${escAttr(t.title)}">${escHtml(t.label)}</a></li>`;
  }).join("\n");

  return writePartial(
    "nav",
    lang,
    s.navComment,
    `<ul>
        <li>
    <a href="articulos.html" title="${escAttr(s.articles.title)}">${escHtml(s.articles.label)}</a>
  </li>
  <li class="has-sub">
    <a href="rpg.html" title="${escAttr(s.methodsMenu.title)}">${escHtml(s.methodsMenu.label)}</a>
    <ul>
${techniqueItems}
    </ul>
  </li>
</ul>`,
  );
}

function buildFooter(lang, s) {
  const prefix = footerPrefix(lang);
  const techniqueLinks = TECHNIQUE_NAV_STEMS.map((stem) => {
    const t = s.techniques[stem];
    const href = `${prefix}/${stem}.html`;
    if (stem === "manipulaciones") {
      return `            <li>
              <a href="${href}">${t.label}</a>
            </li>`;
    }
    return `            <li><a href="${href}">${t.label}</a></li>`;
  }).join("\n");

  return writePartial(
    "footer",
    lang,
    s.footerComment,
    `<footer class="footer">
  <div class="container">
    <div class="row">
      <div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
        <div class="footer-widget">
          <h2 class="widget-title">${s.methodsTitle}</h2>
          <ul class="listnone">
${techniqueLinks}
          </ul>
        </div>
      </div>
      <div class="${s.footerSocialColClass}">
        <div class="footer-widget footer-social">
          <h2 class="widget-title">${s.socialTitle}</h2>
          <ul class="listnone">
            <li>
              <a href="https://www.instagram.com/kinesicabrude/" target="_blank" rel="noopener noreferrer"><i
                  class="fa fa-instagram"></i> kinesicabrude</a>
            </li>
            <li>
              <a href="https://www.facebook.com/kinesicabrude/" target="_blank" rel="noopener noreferrer"><i
                  class="fa fa-facebook"></i> kinesicabrude</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
        <div class="footer-widget footer-social">
          <h2 class="widget-title">${s.clinicTitle}</h2>
          <ul class="listnone">
            <li>
              <a href="https://maps.app.goo.gl/urpkh4HYe7dSdjPS9" target="_blank" rel="noopener noreferrer"
                title="${escAttr(s.mapsTitle)}"><i class="fa fa-map-marker"></i> Charcas 3889, CABA</a>
            </li>
            <li>
              <a href="#" class="dynamic-whatsapp-link" target="_blank" rel="noopener noreferrer">
                <i class="fa fa-phone"></i>
                <span class="dynamic-whatsapp-text">+54 (11) 6156-4311</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</footer>
<div class="tiny-footer">
  <div class="container">
    <div class="row">
      <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
        <div class="copyright-content">
          ${s.copyright}
        </div>
      </div>
    </div>
  </div>
</div>`,
  );
}

function buildCtaStrip(lang, s) {
  return writePartial(
    "cta-strip",
    lang,
    "CTA strip — edit strings in scripts/partials-strings.mjs",
    `    <section class="space-small bg-primary site-cta-strip">
      <div class="container">
        <div class="row">
          <div class="col-lg-8 col-sm-8 col-md-8 col-xs-12">
            <h2 class="cta-title">${s.ctaTitle}</h2>
            <p class="cta-text">${s.ctaText}</p>
          </div>
          <div class="col-lg-4 col-sm-4 col-md-4 col-xs-12">
            <a href="https://wa.me/5491161564311" target="_blank" class="btn btn-white btn-lg mt20 dynamic-whatsapp-url"
              rel="noopener noreferrer">${s.ctaButton}</a>
          </div>
        </div>
      </div>
    </section>`,
  );
}

function buildWhatsappFloat(lang, s) {
  return writePartial(
    "whatsapp-float",
    lang,
    s.whatsappComment,
    `<a id="whatsapp-link" href="https://wa.me/5491161564311" class="whatsapp-float" target="_blank"
  aria-label="${escAttr(s.whatsappAria)}" rel="noopener noreferrer">
  <i class="fa fa-whatsapp whatsapp-icon"></i>
</a>`,
  );
}

let count = 0;
for (const lang of LANG_CODES) {
  const s = PARTIAL_STRINGS[lang];
  if (!s) {
    console.warn("skip (no strings):", lang);
    continue;
  }
  buildHeader(lang, s);
  buildNav(lang, s);
  buildFooter(lang, s);
  buildCtaStrip(lang, s);
  buildWhatsappFloat(lang, s);
  count += 5;
}

console.log(`Wrote ${count} partial(s) to partials/`);
