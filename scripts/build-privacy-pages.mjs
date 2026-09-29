#!/usr/bin/env node
/**
 * Generate privacy policy and personal data deletion pages (ES / EN / FR / PT).
 * Run: node scripts/build-privacy-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PRIVACY } from "./privacy-content.mjs";
import { SITE, absoluteUrl, HTML_LANG, repoPath, sitePath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { breadcrumbListSchema, escAttr, escHtml } from "./html-utils.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  headCriticalCss,
  headFavicon,
  headJsClassScript,
  headLangDeferScripts,
  headSeoBlock,
  headStandardStylesheets,
  pageBreadcrumbSection,
  pageCaptionMarkup,
  pageHeaderSection,
} from "./page-shell.mjs";
import { CONTACT, mailtoUrl, waMeUrl } from "./site-contact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HOME_LABELS = {
  es: "Inicio",
  en: "Home",
  fr: "Accueil",
  pt: "Início",
};

function formatText(str) {
  if (!str) return "";
  return str.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderDeletionCard(sec, form, lang, copy) {
  const optionsHtml = form.scopeOptions
    .map(
      (opt) =>
        `            <option value="${escAttr(opt.value)}">${escHtml(opt.label)}</option>`,
    )
    .join("\n");

  const directLabels = {
    es: { email: "Correo electrónico", wa: "WhatsApp", address: "Consultorio" },
    en: { email: "Email", wa: "WhatsApp", address: "Clinic" },
    fr: { email: "Courrier électronique", wa: "WhatsApp", address: "Cabinet" },
    pt: { email: "Correio eletrônico", wa: "WhatsApp", address: "Consultório" },
  };
  const dLabel = directLabels[lang] || directLabels.es;

  const directContacts = [
    {
      label: dLabel.email,
      value: CONTACT.email,
      href: mailtoUrl(CONTACT.email),
      icon: "fa-envelope",
    },
    {
      label: dLabel.wa,
      value: CONTACT.phoneDisplay,
      href: waMeUrl(),
      icon: "fa-whatsapp",
    },
    {
      label: dLabel.address,
      value: `${CONTACT.address.shortLine}, ${CONTACT.address.addressCountry}`,
      href: CONTACT.mapsUrl,
      icon: "fa-map-marker",
    },
  ];

  const directListHtml = directContacts
    .map(
      (c) =>
        `            <li><a href="${escAttr(c.href)}" ${
          c.href.startsWith("http")
            ? 'target="_blank" rel="noopener noreferrer"'
            : ""
        }><i class="fa ${c.icon}" aria-hidden="true"></i> ${escHtml(
          c.label,
        )}: <strong>${escHtml(c.value)}</strong></a></li>`,
    )
    .join("\n");

  return `
          <div class="privacy-deletion-card" id="${sec.id}">
            <div class="privacy-card-header">
              <h2 class="privacy-card-title"><i class="fa fa-shield" aria-hidden="true"></i> ${escHtml(
                sec.title,
              )}</h2>
              ${(sec.paragraphs || [])
                .map(
                  (p) => `<p class="privacy-card-desc">${formatText(p)}</p>`,
                )
                .join("\n              ")}
            </div>

            <form class="privacy-request-form" data-lang="${escAttr(
              lang,
            )}" data-email="${escAttr(CONTACT.email)}" data-whatsapp="${escAttr(
    CONTACT.whatsappDigits,
  )}" novalidate>
              <div class="privacy-form-grid">
                <div class="privacy-form-group">
                  <label for="priv-name">${escHtml(form.nameLabel)} *</label>
                  <input type="text" id="priv-name" name="name" class="form-control" placeholder="${escAttr(
                    form.namePlaceholder,
                  )}" required />
                </div>
                <div class="privacy-form-group">
                  <label for="priv-email">${escHtml(form.emailLabel)} *</label>
                  <input type="email" id="priv-email" name="email" class="form-control" placeholder="${escAttr(
                    form.emailPlaceholder,
                  )}" />
                </div>
              </div>

              <div class="privacy-form-grid">
                <div class="privacy-form-group">
                  <label for="priv-phone">${escHtml(form.phoneLabel)}</label>
                  <input type="tel" id="priv-phone" name="phone" class="form-control" placeholder="${escAttr(
                    form.phonePlaceholder,
                  )}" />
                </div>
                <div class="privacy-form-group">
                  <label for="priv-scope">${escHtml(form.scopeLabel)}</label>
                  <select id="priv-scope" name="scope" class="form-control">
${optionsHtml}
                  </select>
                </div>
              </div>

              <div class="privacy-form-group">
                <label for="priv-details">${escHtml(form.detailsLabel)}</label>
                <textarea id="priv-details" name="details" class="form-control" rows="3" placeholder="${escAttr(
                  form.detailsPlaceholder,
                )}"></textarea>
              </div>

              <div class="privacy-actions">
                <button type="button" class="privacy-btn privacy-btn-primary" data-action="send-email">
                  <i class="fa fa-envelope" aria-hidden="true"></i> ${escHtml(
                    form.btnEmail,
                  )}
                </button>
                <button type="button" class="privacy-btn privacy-btn-whatsapp" data-action="send-whatsapp">
                  <i class="fa fa-whatsapp" aria-hidden="true"></i> ${escHtml(
                    form.btnWhatsapp,
                  )}
                </button>
                <button type="button" class="privacy-btn privacy-btn-secondary" data-action="copy-text">
                  <i class="fa fa-clipboard" aria-hidden="true"></i> ${escHtml(
                    form.btnCopy,
                  )}
                </button>
              </div>

              <div class="privacy-form-alert alert" role="status" aria-live="polite"></div>

              <p class="privacy-legal-notice">
                <i class="fa fa-clock-o" aria-hidden="true"></i> ${escHtml(
                  form.legalNotice,
                )}
              </p>

              <div class="privacy-direct-card">
                <h4>${escHtml(copy.directContactTitle)}</h4>
                <p>${escHtml(copy.directContactText)}</p>
                <ul class="privacy-contact-links">
${directListHtml}
                </ul>
              </div>
            </form>
          </div>`;
}

function renderSection(sec, lang, copy) {
  if (sec.id === "eliminacion") {
    return renderDeletionCard(sec, copy.form, lang, copy);
  }

  let html = `          <div class="privacy-section-block" id="${sec.id}">\n`;
  html += `            <h2>${escHtml(sec.title)}</h2>\n`;
  for (const p of sec.paragraphs || []) {
    html += `            <p>${formatText(p)}</p>\n`;
  }
  if (sec.contactList) {
    html += `            <ul class="privacy-contact-links">\n`;
    for (const c of sec.contactList) {
      html += `              <li><a href="${escAttr(c.href)}" ${
        c.href.startsWith("http")
          ? 'target="_blank" rel="noopener noreferrer"'
          : ""
      }>${escHtml(c.label)}: <strong>${escHtml(c.value)}</strong></a></li>\n`;
    }
    html += `            </ul>\n`;
  }
  if (sec.bullets) {
    html += `            <ul>\n`;
    for (const b of sec.bullets) {
      html += `              <li>${formatText(b)}</li>\n`;
    }
    html += `            </ul>\n`;
  }
  if (sec.note) {
    html += `            <p class="text-muted"><em>${formatText(
      sec.note,
    )}</em></p>\n`;
  }
  html += `          </div>`;
  return html;
}

function buildHtml(lang) {
  const copy = PRIVACY[lang];
  const prefix = assetPrefixForLang(lang);
  const canonical = absoluteUrl(lang, "privacidad");
  const homeHref = sitePath(lang, "index");
  const homeLabel = HOME_LABELS[lang];

  const breadcrumbSchema = JSON.stringify(
    breadcrumbListSchema([
      { name: homeLabel, item: absoluteUrl(lang, "index") },
      { name: copy.breadcrumb, item: canonical },
    ]),
    null,
    2,
  );

  const webPageSchema = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: copy.title,
      description: copy.description,
      inLanguage: HTML_LANG[lang],
      isPartOf: {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: absoluteUrl(lang, "index"),
        name: "Kinésica",
      },
    },
    null,
    2,
  );

  const sectionsHtml = copy.sections
    .map((sec) => renderSection(sec, lang, copy))
    .join("\n\n");

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
${headFavicon(prefix)}  <meta charset="utf-8" />
${headJsClassScript()}${headCriticalCss(prefix)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(prefix)}${headSeoBlock({
    lang,
    stem: "privacidad",
    title: copy.title,
    description: copy.description,
    type: "website",
    canonical,
  })}
${headStandardStylesheets(prefix)}  <script src="${prefix}partials/gtm-head.min.js" defer></script>
  <script type="application/ld+json">
${breadcrumbSchema}
  </script>
  <script type="application/ld+json">
${webPageSchema}
  </script>
</head>

<body>
${bodyShellTop(prefix)}${headerShellMarkup(lang, prefix)}
  <main id="main" tabindex="-1">
${pageHeaderSection(pageCaptionMarkup(copy.breadcrumb, { variant: "word" }))}
${pageBreadcrumbSection({
  homeHref,
  homeLabel,
  activeLabel: copy.breadcrumb,
})}
    <section class="content privacy-page">
      <div class="container">
        <div class="privacy-page-layout">
          <div class="privacy-intro-box">
            <p class="privacy-updated">${escHtml(copy.lastUpdated)}</p>
            <h1>${escHtml(copy.h1)}</h1>
            <p class="lead">${escHtml(copy.lead)}</p>
          </div>

${sectionsHtml}
        </div>
      </div>
    </section>
  </main>
  <script src="${prefix}js/privacy-request.min.js" defer></script>
${bodyFooterAndUiScripts(lang, prefix)}
</body>

</html>
`;
}

for (const lang of LANG_CODES) {
  const out = path.join(ROOT, repoPath(lang, "privacidad"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildHtml(lang));
  console.log("Wrote", out);
}
