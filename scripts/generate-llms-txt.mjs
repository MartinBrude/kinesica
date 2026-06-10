#!/usr/bin/env node
/**
 * Generate /llms.txt and /llms-full.txt (https://llmstxt.org/) for LLM crawlers.
 * Run: node scripts/generate-llms-txt.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SITE, absoluteUrl, repoPath } from "./i18n-urls.mjs";
import { PATHOLOGIES } from "./pathology-content.mjs";
import { METHOD_STEMS, METHODS } from "./methods-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "llms.txt");
const OUT_FULL = path.join(ROOT, "llms-full.txt");

const INTRO = `> Centro de kinesiología, osteopatía y terapias manuales en Palermo, Buenos Aires (Argentina). Sitio informativo en español (principal), inglés, francés y portugués.

Información útil para asistentes y crawlers:

- **Idioma por defecto:** español (Argentina), URLs en la raíz (\`/\`).
- **Inglés:** \`/en/\` · **Francés:** \`/fr/\` · **Português:** \`/pt/\`
- **Turnos:** WhatsApp [+54 11 6156-4311](https://wa.me/5491161564311)
- **Horario:** lunes a viernes, 10:00–20:00
- **Ubicación:** Palermo, CABA (ver mapa en la home)
- **Profesional:** Norberto Silvio Brude — kinesiólogo y osteópata`;

const METHOD_SECTION_TITLES = {
  es: "Métodos y técnicas",
  en: "Methods & techniques (English)",
  fr: "Méthodes et techniques",
  pt: "Métodos e técnicas",
};

function metaDescription(lang, stem) {
  const rel = repoPath(lang, stem);
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    return null;
  }
  const html = fs.readFileSync(full, "utf8");
  const m = html.match(
    /<meta name="description"\s+content="([^"]+)"\s*\/?>/,
  );
  return m?.[1] ?? null;
}

function link(title, lang, stem, note) {
  const url = absoluteUrl(lang, stem);
  return note ? `- [${title}](${url}): ${note}` : `- [${title}](${url})`;
}

function section(name, lines) {
  const body = lines.filter(Boolean).join("\n");
  return body ? `## ${name}\n\n${body}\n` : "";
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function truncate(text, maxChars = 480) {
  const clean = normalizeText(text);
  if (!clean || clean.length <= maxChars) {
    return clean;
  }
  return `${clean.slice(0, maxChars - 1).replace(/\s+\S*$/, "")}…`;
}

function mergeTexts(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left) return right;
  if (!right) return left;
  if (left.includes(right)) return left;
  if (right.includes(left)) return right;
  const maxOverlap = Math.min(left.length, right.length, 140);
  for (let len = maxOverlap; len > 24; len--) {
    if (left.slice(-len) === right.slice(0, len)) {
      return left + right.slice(len);
    }
  }
  return `${left} ${right}`;
}

function methodLangData(stem, lang) {
  return METHODS[stem]?.[lang] ?? null;
}

function methodTitle(stem, lang) {
  const data = methodLangData(stem, lang);
  return data?.h1 ?? data?.breadcrumb ?? stem;
}

function expandedFromMethod(data) {
  if (!data) return "";
  let text = data.lead ?? "";
  for (const block of data.blocks ?? []) {
    if (block.type === "p" && block.text) {
      text = mergeTexts(text, block.text);
      break;
    }
  }
  return truncate(text);
}

function expandedFromPathology(data) {
  if (!data) return "";
  return truncate(mergeTexts(data.lead, data.paragraphs?.[0]));
}

function techniqueLines(lang, { expanded = false } = {}) {
  return METHOD_STEMS.map((stem) => {
    const data = methodLangData(stem, lang);
    const title = methodTitle(stem, lang);
    const note = expanded
      ? expandedFromMethod(data) || data?.metaDescription
      : data?.metaDescription ?? metaDescription(lang, stem);
    return link(title, lang, stem, note);
  });
}

function pathologyLines(lang, { expanded = false } = {}) {
  return PATHOLOGIES.map((p) => {
    const data = p[lang];
    const title = data?.title ?? p.stem;
    const note = expanded
      ? expandedFromPathology(data) || data?.metaDescription
      : data?.metaDescription ?? metaDescription(lang, p.stem);
    return link(title, lang, p.stem, note);
  });
}

const mainPagesEs = [
  ["Inicio (español, Argentina)", "es", "index", metaDescription("es", "index")],
  [
    "Artículos y patologías",
    "es",
    "articulos",
    metaDescription("es", "articulos"),
  ],
  [
    "CV — Norberto Silvio Brude",
    "es",
    "cv",
    "Kinesiólogo y osteópata; formación y experiencia profesional.",
  ],
];

const enMainLines = [
  link("Home (English)", "en", "index", metaDescription("en", "index")),
  link("Articles & conditions", "en", "articulos", metaDescription("en", "articulos")),
  link("CV — Norberto Silvio Brude", "en", "cv", "Physiotherapist and osteopath profile."),
];

const frMainLines = [
  link("Accueil (français)", "fr", "index", metaDescription("fr", "index")),
  link(
    "Articles et pathologies",
    "fr",
    "articulos",
    metaDescription("fr", "articulos"),
  ),
  link(
    "CV — Norberto Silvio Brude",
    "fr",
    "cv",
    "Profil du kinésithérapeute et ostéopathe.",
  ),
];

const ptMainLines = [
  link("Início (português)", "pt", "index", metaDescription("pt", "index")),
  link(
    "Artigos e condições",
    "pt",
    "articulos",
    metaDescription("pt", "articulos"),
  ),
  link(
    "Currículo — Norberto Silvio Brude",
    "pt",
    "cv",
    "Perfil do fisioterapeuta e osteopata.",
  ),
];

const optionalLines = [
  `- [Documentación extendida](${SITE}/llms-full.txt): resúmenes con párrafos clave de métodos y patologías (es/en/fr/pt).`,
  `- [Sitemap](${SITE}/sitemap.xml): all public HTML URLs (es/en/fr/pt).`,
  ...pathologyLines("en"),
  ...pathologyLines("fr"),
  ...pathologyLines("pt"),
];

function buildLlmsTxt() {
  return `# Kinésica

${INTRO}

${section(
  "Páginas principales",
  mainPagesEs.map(([t, l, s, n]) => link(t, l, s, n)),
)}
${section("Métodos y técnicas", techniqueLines("es"))}
${section("Patologías y dolencias", pathologyLines("es"))}
${section("English", enMainLines)}
${section(METHOD_SECTION_TITLES.en, techniqueLines("en"))}
${section("Français", frMainLines)}
${section(METHOD_SECTION_TITLES.fr, techniqueLines("fr"))}
${section("Português", ptMainLines)}
${section(METHOD_SECTION_TITLES.pt, techniqueLines("pt"))}
${section("Optional", optionalLines)}
`.trimEnd() + "\n";
}

function buildLlmsFullTxt() {
  return `# Kinésica (documentación extendida)

${INTRO}

Versión resumida: [llms.txt](${SITE}/llms.txt)

${section(
  "Páginas principales",
  mainPagesEs.map(([t, l, s, n]) => link(t, l, s, n)),
)}
${section("Métodos y técnicas", techniqueLines("es", { expanded: true }))}
${section("Patologías y dolencias", pathologyLines("es", { expanded: true }))}
${section("English", enMainLines)}
${section(METHOD_SECTION_TITLES.en, techniqueLines("en", { expanded: true }))}
${section("Patologías y condiciones (English)", pathologyLines("en", { expanded: true }))}
${section("Français", frMainLines)}
${section(METHOD_SECTION_TITLES.fr, techniqueLines("fr", { expanded: true }))}
${section("Pathologies (français)", pathologyLines("fr", { expanded: true }))}
${section("Português", ptMainLines)}
${section(METHOD_SECTION_TITLES.pt, techniqueLines("pt", { expanded: true }))}
${section("Patologias (português)", pathologyLines("pt", { expanded: true }))}
${section("Optional", [`- [Sitemap](${SITE}/sitemap.xml): all public HTML URLs (es/en/fr/pt).`])}
`.trimEnd() + "\n";
}

const llmsTxt = buildLlmsTxt();
const llmsFullTxt = buildLlmsFullTxt();

fs.writeFileSync(OUT, llmsTxt);
fs.writeFileSync(OUT_FULL, llmsFullTxt);

console.log("Wrote", path.relative(ROOT, OUT));
console.log("Wrote", path.relative(ROOT, OUT_FULL));
console.log(
  `  ${mainPagesEs.length} main · ${METHOD_STEMS.length} methods × 4 langs · ${PATHOLOGIES.length} pathologies`,
);
