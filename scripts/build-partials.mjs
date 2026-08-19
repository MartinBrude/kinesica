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
  FOOTER_SOCIAL_COL_CLASS,
  PARTIAL_STRINGS,
  TECHNIQUE_NAV_STEMS,
} from "./partials-strings.mjs";
import { METHODS } from "./methods-content.mjs";
import { escAttr, escHtml } from "./html-utils.mjs";
import { CONTACT, SOCIALS, waMeUrl } from "./site-contact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "partials");

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
            <div class="lang-picker" data-lang-picker></div>
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
          <nav class="navigation">
            <div id="navigation" class="nav navbar-nav navbar-right" data-nav-inject="true"></div>
          </nav>
        </div>
      </div>
    </div>
  </header>`,
  );
}

function techniqueNavLabel(lang, stem) {
  const name = METHODS[stem]?.[lang]?.breadcrumb;
  if (!name) {
    throw new Error(`Missing method breadcrumb for ${stem}/${lang}`);
  }
  return name;
}

function buildNav(lang, s) {
  const techniqueItems = TECHNIQUE_NAV_STEMS.map((stem) => {
    const label = techniqueNavLabel(lang, stem);
    return `      <li><a href="${stem}.html" title="${escAttr(label)}">${escHtml(label)}</a></li>`;
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
    <button type="button" class="nav-parent" title="${escAttr(s.methodsMenu.title)}" aria-haspopup="true" aria-expanded="false">${escHtml(s.methodsMenu.label)}</button>
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
    const label = techniqueNavLabel(lang, stem);
    const href = `${prefix}/${stem}.html`;
    return `            <li><a href="${href}">${escHtml(label)}</a></li>`;
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
      <div class="${FOOTER_SOCIAL_COL_CLASS}">
        <div class="footer-widget footer-social">
          <h2 class="widget-title">${s.socialTitle}</h2>
          <ul class="listnone">
            <li>
              <a href="${SOCIALS.instagramBusiness}" target="_blank" rel="noopener noreferrer"><i
                  class="fa fa-instagram" aria-hidden="true"></i> ${SOCIALS.handles.instagramBusiness}</a>
            </li>
            <li>
              <a href="${SOCIALS.instagramMaria}" target="_blank" rel="noopener noreferrer"><i
                  class="fa fa-instagram" aria-hidden="true"></i> ${SOCIALS.handles.instagramMaria}</a>
            </li>
            <li>
              <a href="${SOCIALS.facebookBusiness}" target="_blank" rel="noopener noreferrer"><i
                  class="fa fa-facebook" aria-hidden="true"></i> ${SOCIALS.handles.facebookBusiness}</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
        <div class="footer-widget footer-social">
          <h2 class="widget-title">${s.clinicTitle}</h2>
          <ul class="listnone">
            <li>
              <a href="${CONTACT.mapsUrl}" target="_blank" rel="noopener noreferrer"
                title="${escAttr(s.mapsTitle)}"><i class="fa fa-map-marker" aria-hidden="true"></i> ${CONTACT.address.shortLine}</a>
            </li>
            <li>
              <a href="#" class="dynamic-whatsapp-link" target="_blank" rel="noopener noreferrer">
                <i class="fa fa-phone" aria-hidden="true"></i>
                <span class="dynamic-whatsapp-text">${CONTACT.phoneDisplay}</span>
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
            <a href="${waMeUrl(CONTACT.whatsappDigits)}" target="_blank" class="btn btn-white btn-lg mt20 dynamic-whatsapp-url"
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
    `<a id="whatsapp-link" href="${waMeUrl(CONTACT.whatsappDigits)}" class="whatsapp-float" target="_blank"
  aria-label="${escAttr(s.whatsappAria)}" rel="noopener noreferrer">
  <i class="fa fa-whatsapp whatsapp-icon" aria-hidden="true"></i>
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
