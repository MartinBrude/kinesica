#!/usr/bin/env node
/**
 * Inyecta JSON-LD de fisioterapia (SEO local) en todas las páginas públicas.
 * Home: @graph (clínica + FAQ). Resto: clínica Physiotherapy.
 *
 *   npm run seo:schema
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildClinicOnly,
  buildHomeGraph,
  langFromHtmlFile,
  ldJsonScript,
} from "./schema-local-business.mjs";
import { LANG_CODES, langByCode } from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCHEMA_BLOCK_RE =
  /\s*<script type="application\/ld\+json" id="kinesica-local-schema">[\s\S]*?<\/script>/;

const LEGACY_SCHEMA_SCRIPTS_RE =
  /\s*<script src="(?:\.\.\/)*(?:partials\/medical-clinic-schema|partials\/faq-schema)(?:\.min)?\.js"[^>]*><\/script>/g;

function listHtmlFiles() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html") && !f.startsWith("cv-"));
  for (const code of LANG_CODES) {
    const entry = langByCode(code);
    if (!entry || entry.isDefault) continue;
    const dir = path.join(ROOT, entry.urlPrefix);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${entry.urlPrefix}/${f}`);
    }
  }
  return files;
}

function isPublicPage(file) {
  return !/(^|\/)(404|404-router)\.html$/.test(file);
}

function isHomePage(file) {
  return file === "index.html" || /^(en|fr|pt)\/index\.html$/.test(file);
}

function inject(html, file) {
  const lang = langFromHtmlFile(file);
  const schema = isHomePage(file)
    ? buildHomeGraph(lang)
    : buildClinicOnly(lang);
  const block = ldJsonScript(schema);

  let out = html.replace(SCHEMA_BLOCK_RE, "");
  out = out.replace(LEGACY_SCHEMA_SCRIPTS_RE, "");
  out = out.replace(/\n{3,}/g, "\n\n");

  if (out.includes("</head>")) {
    out = out.replace("</head>", `${block}\n</head>`);
  } else {
    throw new Error(`No </head> in ${file}`);
  }
  return out;
}

let changed = 0;
for (const file of listHtmlFiles()) {
  if (!isPublicPage(file)) continue;
  const full = path.join(ROOT, file);
  const original = fs.readFileSync(full, "utf8");
  const next = inject(original, file);
  if (next !== original) {
    fs.writeFileSync(full, next);
    changed++;
    console.log("schema:", file);
  }
}

console.log(`Done. ${changed} page(s) with local Physiotherapy schema.`);
