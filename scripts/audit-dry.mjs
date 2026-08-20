#!/usr/bin/env node
/**
 * DRY audit: source-of-truth drift in generators (not HTML SEO).
 * Run: npm run seo:dry
 *
 * Errors fail CI via `npm run verify`. Warnings are known leftover debt.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SITE, repoPath, sitePath } from "./i18n-urls.mjs";
import { LANG_CODES, SUBDIR_PREFIXES } from "./languages.mjs";
import { HOME, HOME_METHOD_CARD_STEMS } from "./home-content.mjs";
import { ARTICLES_INDEX_UI } from "./articles-index-content.mjs";
import { FAQ_UI, FAQS, faqsForSchema } from "./faq-content.mjs";
import { googleReviewsAggregateRating } from "./fetch-google-reviews.mjs";
import { METHOD_STEMS } from "./methods-content.mjs";
import { TECHNIQUE_NAV_STEMS } from "./partials-strings.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

function add(severity, file, msg) {
  (severity === "error" ? errors : warnings).push({ file, msg });
}

function readRel(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function scriptMjsFiles() {
  return fs
    .readdirSync(path.join(ROOT, "scripts"))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => `scripts/${name}`);
}

function assertLangMap(obj, file, label) {
  for (const lang of LANG_CODES) {
    if (!obj?.[lang]) {
      add("error", file, `${label} missing lang "${lang}"`);
    }
  }
}

/** Contact literals belong in site-contact.mjs only. */
const CONTACT_SOURCE = "scripts/site-contact.mjs";
const CONTACT_FORBIDDEN = [
  { pattern: /5491161564311/, label: "WhatsApp digits" },
  { pattern: /Charcas 3889/, label: "street address" },
  { pattern: /norberto1712@gmail\.com/, label: "email" },
];
const CONTACT_ALLOW = new Set([
  CONTACT_SOURCE,
  "scripts/audit-dry.mjs",
  "scripts/audit-site.mjs",
]);

function auditContactHardcodes() {
  for (const rel of scriptMjsFiles()) {
    if (CONTACT_ALLOW.has(rel)) continue;
    const text = readRel(rel);
    for (const { pattern, label } of CONTACT_FORBIDDEN) {
      if (pattern.test(text)) {
        add("error", rel, `Hardcoded ${label} — import from ${CONTACT_SOURCE}`);
        break;
      }
    }
  }
}

/** Site origin belongs in i18n-urls.mjs (`SITE`). */
const SITE_ALLOW = new Set([
  "scripts/i18n-urls.mjs",
  "scripts/audit-dry.mjs",
  "scripts/verify-i18n.mjs",
  "scripts/bootstrap-pt-pages.mjs",
]);

function auditSiteUrlHardcodes() {
  for (const rel of scriptMjsFiles()) {
    if (SITE_ALLOW.has(rel)) continue;
    const text = readRel(rel);
    if (text.includes(SITE)) {
      add(
        "error",
        rel,
        `Hardcoded ${SITE} — import SITE from scripts/i18n-urls.mjs`,
      );
    }
  }
}

function auditHomeFaqSource() {
  const rel = "scripts/home-content.mjs";
  const src = readRel(rel);
  const placeholders = (src.match(/__FAQ_ACCORDION__/g) || []).length;
  if (placeholders !== LANG_CODES.length) {
    add(
      "error",
      rel,
      `expected ${LANG_CODES.length} __FAQ_ACCORDION__ placeholders, got ${placeholders}`,
    );
  }
  if (src.includes("faqAccordion")) {
    add(
      "error",
      rel,
      "FAQ accordion markup must live in faq-content.mjs (use __FAQ_ACCORDION__)",
    );
  }
  if (!src.includes("renderHomeMethodCards") || !src.includes("sitePath")) {
    add(
      "error",
      rel,
      "method cards must be rendered via renderHomeMethodCards() + sitePath()",
    );
  }
  if (/href=\\"rpg\.html\\"/.test(src)) {
    add("error", rel, "hardcoded rpg.html — use sitePath(lang, stem) in renderHomeMethodCards()");
  }
  for (const prefix of SUBDIR_PREFIXES) {
    if (src.includes(`href="/${prefix}/`) || src.includes(`href=\\"/${prefix}/`)) {
      add(
        "error",
        rel,
        `lang-prefixed href "/${prefix}/…" hardcoded — call sitePath(lang, stem)`,
      );
    }
  }
}

function auditFaqSchemaSource() {
  const rel = "scripts/schema-local-business.mjs";
  const src = readRel(rel);
  if (!src.includes("faqsForSchema")) {
    add("error", rel, "FAQ JSON-LD must import faqsForSchema from faq-content.mjs");
  }
  if (!src.includes("googleReviewsAggregateRating")) {
    add(
      "error",
      rel,
      "clinic schema must import googleReviewsAggregateRating from fetch-google-reviews.mjs",
    );
  }
  if (/\bfaqs:\s*\[/.test(src)) {
    add("error", rel, "COPY.faqs duplicates faq-content.mjs — remove and use faqsForSchema()");
  }
}

function auditHomeBuilder() {
  const rel = "scripts/build-home-pages.mjs";
  const src = readRel(rel);
  if (!src.includes("renderFaqSection")) {
    add("error", rel, "must replace __FAQ_ACCORDION__ via renderFaqSection()");
  }
}

function auditArticulosBuilder() {
  const rel = "scripts/build-articulos-pages.mjs";
  const src = readRel(rel);
  if (!src.includes("headSeoBlock") || !src.includes("pageHeaderSection")) {
    add("error", rel, "articulos pages must be generated from page-shell (headSeoBlock + pageHeaderSection)");
  }
  if (src.includes("replaceContentBlock") || src.includes("patchArticulosFile")) {
    add("error", rel, "do not patch existing articulos.html — generate the full page");
  }
}

function auditNavMethodStems() {
  if (JSON.stringify(TECHNIQUE_NAV_STEMS) !== JSON.stringify(METHOD_STEMS)) {
    add(
      "error",
      "scripts/partials-strings.mjs",
      "TECHNIQUE_NAV_STEMS must stay aligned with METHOD_STEMS",
    );
  }
}

function auditLangCoverage() {
  assertLangMap(HOME, "scripts/home-content.mjs", "HOME");
  assertLangMap(FAQ_UI, "scripts/faq-content.mjs", "FAQ_UI");
  assertLangMap(ARTICLES_INDEX_UI, "scripts/articles-index-content.mjs", "ARTICLES_INDEX_UI");
  FAQS.forEach((item, i) => {
    assertLangMap(item.q, "scripts/faq-content.mjs", `FAQS[${i}].q`);
    assertLangMap(item.a, "scripts/faq-content.mjs", `FAQS[${i}].a`);
  });
}

function auditGeneratedHomes() {
  for (const lang of LANG_CODES) {
    const rel = repoPath(lang, "index");
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      add("error", rel, "missing generated home (run npm run build:home)");
      continue;
    }
    const html = fs.readFileSync(full, "utf8");
    if (!html.includes('id="faqAccordion"')) {
      add("error", rel, "generated FAQ accordion missing");
    }
    for (const item of faqsForSchema(lang)) {
      if (!html.includes(item.q)) {
        add(
          "error",
          rel,
          `FAQ question missing from generated HTML (source: faq-content.mjs): “${item.q}”`,
        );
      }
    }
    for (const stem of HOME_METHOD_CARD_STEMS) {
      const href = sitePath(lang, stem);
      if (!html.includes(`href="${href}"`)) {
        add(
          "error",
          rel,
          `method card missing sitePath href ${href}`,
        );
      }
    }
    if (googleReviewsAggregateRating() && !html.includes('"AggregateRating"')) {
      add("error", rel, "home schema missing AggregateRating from Google reviews payload");
    }
  }
}

auditContactHardcodes();
auditSiteUrlHardcodes();
auditHomeFaqSource();
auditFaqSchemaSource();
auditHomeBuilder();
auditArticulosBuilder();
auditNavMethodStems();
auditLangCoverage();
auditGeneratedHomes();

console.log("=== DRY ERRORS (" + errors.length + ") ===");
errors.forEach((i) => console.log(`[${i.file}] ${i.msg}`));
console.log("\n=== DRY WARNINGS (" + warnings.length + ") ===");
warnings.forEach((i) => console.log(`[${i.file}] ${i.msg}`));
if (!warnings.length) {
  console.log("(none)");
}

if (errors.length) {
  process.exit(1);
}
console.log("\nseo:dry OK");
