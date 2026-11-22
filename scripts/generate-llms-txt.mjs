#!/usr/bin/env node
/**
 * Generate /llms-small.txt, /llms.txt and /llms-full.txt (https://llmstxt.org/) for LLM crawlers.
 * Run: node scripts/generate-llms-txt.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SITE } from "./i18n-urls.mjs";
import { PATHOLOGIES } from "./pathology-content.mjs";
import { METHOD_STEMS, METHODS } from "./methods-content.mjs";
import { CONTACT, FOUNDER, OPENING_HOURS, waMeUrl } from "./site-contact.mjs";
import { faqsForSchema } from "./faq-content.mjs";
import { HOME } from "./home-content.mjs";
import { LANG_CODES } from "./languages.mjs";
import {
  INTRO,
  METHOD_SECTION_TITLES,
  PATHOLOGY_SECTION_TITLES,
  createLlmsHelpers,
  link,
  section,
} from "./llms-txt-sections.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_SMALL = path.join(ROOT, "llms-small.txt");
const OUT = path.join(ROOT, "llms.txt");
const OUT_FULL = path.join(ROOT, "llms-full.txt");

const {
  techniqueLines,
  pathologyLines,
  mainPagesEs,
  mainLinesByLang,
  optionalLines,
} = createLlmsHelpers(ROOT);

function buildLlmsSmallTxt() {
  return `# Kinésica

> ${HOME.es.description}

- **Turnos:** WhatsApp [${CONTACT.phoneDisplay}](${waMeUrl()})
- **Horario:** ${OPENING_HOURS.llmsLine}
- **Ubicación:** ${CONTACT.address.streetAddress}, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressRegion} (${CONTACT.address.postalCode})
- **Profesional:** ${FOUNDER.name}

${section("Páginas principales", mainPagesEs.map(([title, lang, stem]) => link(title, lang, stem)))}
${section("Métodos y técnicas", METHOD_STEMS.map((stem) => link(METHODS[stem].es.breadcrumb, "es", stem)))}
${section("Índices", [
    `- [llms.txt](${SITE}/llms.txt): métodos y patologías en es/en/fr/pt.`,
    `- [llms-full.txt](${SITE}/llms-full.txt): resúmenes ampliados.`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
  ])}
`.trimEnd() + "\n";
}

function buildLlmsTxt() {
  return `# Kinésica

${INTRO}

${section("Páginas principales", mainPagesEs.map(([t, l, s, n]) => link(t, l, s, n)))}
${section("Métodos y técnicas", techniqueLines("es"))}
${section("Patologías y dolencias", pathologyLines("es"))}
${section("English", mainLinesByLang.en)}
${section(METHOD_SECTION_TITLES.en, techniqueLines("en"))}
${section(PATHOLOGY_SECTION_TITLES.en, pathologyLines("en"))}
${section("Français", mainLinesByLang.fr)}
${section(METHOD_SECTION_TITLES.fr, techniqueLines("fr"))}
${section(PATHOLOGY_SECTION_TITLES.fr, pathologyLines("fr"))}
${section("Português", mainLinesByLang.pt)}
${section(METHOD_SECTION_TITLES.pt, techniqueLines("pt"))}
${section(PATHOLOGY_SECTION_TITLES.pt, pathologyLines("pt"))}
${section("Optional", optionalLines)}
`.trimEnd() + "\n";
}

function buildLlmsFullTxt() {
  return `# Kinésica (documentación extendida)

${INTRO}

Versión corta: [llms-small.txt](${SITE}/llms-small.txt)
Versión resumida: [llms.txt](${SITE}/llms.txt)

${section("Páginas principales", mainPagesEs.map(([t, l, s, n]) => link(t, l, s, n)))}
${section("Métodos y técnicas", techniqueLines("es", { expanded: true }))}
${section("Patologías y dolencias", pathologyLines("es", { expanded: true }))}
${section("English", mainLinesByLang.en)}
${section(METHOD_SECTION_TITLES.en, techniqueLines("en", { expanded: true }))}
${section("Patologías y condiciones (English)", pathologyLines("en", { expanded: true }))}
${section("Français", mainLinesByLang.fr)}
${section(METHOD_SECTION_TITLES.fr, techniqueLines("fr", { expanded: true }))}
${section("Pathologies (français)", pathologyLines("fr", { expanded: true }))}
${section("Português", mainLinesByLang.pt)}
${section(METHOD_SECTION_TITLES.pt, techniqueLines("pt", { expanded: true }))}
${section("Patologias (português)", pathologyLines("pt", { expanded: true }))}
${section("Optional", [`- [Sitemap](${SITE}/sitemap.xml): all public HTML URLs (es/en/fr/pt).`, `- [ai.txt](${SITE}/.well-known/ai.txt)`, `- [summary.json](${SITE}/ai/summary.json)`, `- [faq.json](${SITE}/ai/faq.json)`])}
`.trimEnd() + "\n";
}

const summary = {
  name: "Kinésica",
  url: `${SITE}/`,
  description: HOME.es.description,
  languages: LANG_CODES,
  inLanguage: "es-AR",
  address: {
    streetAddress: CONTACT.address.streetAddress,
    neighborhood: CONTACT.address.addressNeighborhood,
    locality: CONTACT.address.addressLocality,
    region: CONTACT.address.addressRegion,
    postalCode: CONTACT.address.postalCode,
    country: CONTACT.address.addressCountry,
  },
  telephone: CONTACT.phoneDisplay,
  email: CONTACT.email,
  whatsapp: waMeUrl(),
  openingHours: OPENING_HOURS.schemaShort,
  founder: FOUNDER.name,
  documents: {
    llmsSmallTxt: `${SITE}/llms-small.txt`,
    llmsTxt: `${SITE}/llms.txt`,
    llmsFullTxt: `${SITE}/llms-full.txt`,
    faq: `${SITE}/ai/faq.json`,
    sitemap: `${SITE}/sitemap.xml`,
  },
};

const faq = {
  url: `${SITE}/`,
  languages: Object.fromEntries(LANG_CODES.map((lang) => [lang, faqsForSchema(lang)])),
};

const aiTxt = `# Kinésica
# AI discovery file. Canonical content remains the public HTML pages.

User-agent: *
Allow: /

Name: Kinésica
Description: ${HOME.es.description}
Canonical: ${SITE}/
Languages: es-AR, en, fr, pt
Contact: ${CONTACT.phoneDisplay}
Email: ${CONTACT.email}
Address: ${CONTACT.address.streetAddress}, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressRegion}
Hours: ${OPENING_HOURS.llmsLine}
Llms-small: ${SITE}/llms-small.txt
Llms-txt: ${SITE}/llms.txt
Llms-full: ${SITE}/llms-full.txt
Summary: ${SITE}/ai/summary.json
Faq: ${SITE}/ai/faq.json
Sitemap: ${SITE}/sitemap.xml
`;

const aiDir = path.join(ROOT, "ai");
const wellKnownDir = path.join(ROOT, ".well-known");
fs.mkdirSync(aiDir, { recursive: true });
fs.mkdirSync(wellKnownDir, { recursive: true });

fs.writeFileSync(OUT_SMALL, buildLlmsSmallTxt());
fs.writeFileSync(OUT, buildLlmsTxt());
fs.writeFileSync(OUT_FULL, buildLlmsFullTxt());
fs.writeFileSync(path.join(aiDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(path.join(aiDir, "faq.json"), `${JSON.stringify(faq, null, 2)}\n`);
fs.writeFileSync(path.join(wellKnownDir, "ai.txt"), aiTxt);

console.log("Wrote", path.relative(ROOT, OUT_SMALL));
console.log("Wrote", path.relative(ROOT, OUT));
console.log("Wrote", path.relative(ROOT, OUT_FULL));
console.log("Wrote ai/summary.json");
console.log("Wrote ai/faq.json");
console.log("Wrote .well-known/ai.txt");
console.log(`  ${mainPagesEs.length} main · ${METHOD_STEMS.length} methods × 4 langs · ${PATHOLOGIES.length} pathologies`);
