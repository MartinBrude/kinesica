#!/usr/bin/env node
/**
 * Generate /llms.txt (https://llmstxt.org/) for LLM crawlers.
 * Run: node scripts/generate-llms-txt.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SITE, absoluteUrl, repoPath } from "./i18n-urls.mjs";
import { PATHOLOGIES, TECHNIQUE_LABELS } from "./pathology-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "llms.txt");

const TECHNIQUE_STEMS = [
  "rpg",
  "osteopatia",
  "cadenas",
  "manipulaciones",
  "neurodinamia",
  "atm",
  "acupuntura",
  "posturologia-clinica",
];

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

const mainPages = [
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

const techniqueLines = TECHNIQUE_STEMS.map((stem) => {
  const label = TECHNIQUE_LABELS[stem]?.es ?? stem;
  const note = metaDescription("es", stem);
  return link(label, "es", stem, note);
});

const pathologyLines = PATHOLOGIES.map((p) => {
  const title = p.es?.title ?? p.stem;
  const note = p.es?.metaDescription ?? metaDescription("es", p.stem);
  return link(title, "es", p.stem, note);
});

const enLines = [
  link("Home (English)", "en", "index", metaDescription("en", "index")),
  link("Articles & conditions", "en", "articulos", metaDescription("en", "articulos")),
  link("CV — Norberto Silvio Brude", "en", "cv", "Physiotherapist and osteopath profile."),
];

const frLines = [
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

const body = `# Kinésica

> Centro de kinesiología, osteopatía y terapias manuales en Palermo, Buenos Aires (Argentina). Sitio informativo en español (principal), inglés y francés.

Información útil para asistentes y crawlers:

- **Idioma por defecto:** español (Argentina), URLs en la raíz (\`/\`).
- **Inglés:** \`/en/\` · **Francés:** \`/fr/\`
- **Turnos:** WhatsApp [+54 11 6156-4311](https://wa.me/5491161564311)
- **Horario:** lunes a viernes, 10:00–20:00
- **Ubicación:** Palermo, CABA (ver mapa en la home)
- **Profesional:** Norberto Silvio Brude — kinesiólogo y osteópata

${section(
  "Páginas principales",
  mainPages.map(([t, l, s, n]) => link(t, l, s, n)),
)}
${section("Métodos y técnicas", techniqueLines)}
${section("Patologías y dolencias", pathologyLines)}
${section("English", enLines)}
${section("Français", frLines)}
${section(
  "Optional",
  [
    `- [Sitemap](${SITE}/sitemap.xml): all public HTML URLs (es/en/fr).`,
    ...PATHOLOGIES.map((p) =>
      link(p.en?.title ?? p.stem, "en", p.stem, p.en?.metaDescription),
    ),
    ...PATHOLOGIES.map((p) =>
      link(p.fr?.title ?? p.stem, "fr", p.stem, p.fr?.metaDescription),
    ),
  ],
)}
`.trimEnd() + "\n";

fs.writeFileSync(OUT, body);
console.log("Wrote", path.relative(ROOT, OUT));
console.log(
  `  ${mainPages.length} main · ${techniqueLines.length} techniques · ${pathologyLines.length} pathologies · optional EN/FR mirrors`,
);
