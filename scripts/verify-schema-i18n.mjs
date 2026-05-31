#!/usr/bin/env node
/**
 * Fail if home JSON-LD or schema partials leak wrong-language FAQ copy.
 * Run: node scripts/verify-schema-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LANG_CODES } from "./languages.mjs";
import { repoPath } from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HOME_CHECKS = {
  es: { bad: /\b(What is the duration|How long|Book via WhatsApp)\b/i },
  en: { bad: /\b(Qual é a duração|Cuánto tiempo|Prendre rendez-vous)\b/i },
  fr: { bad: /\b(What is the duration|Qual é a duração|Cuánto tiempo)\b/i },
  pt: { bad: /\b(What is the duration|How long|Cuánto tiempo dura)\b/i },
};

let errors = 0;

for (const lang of LANG_CODES) {
  const file = path.join(ROOT, repoPath(lang, "index"));
  const html = fs.readFileSync(file, "utf8");
  const block =
    html.match(
      /<script type="application\/ld\+json" id="kinesica-local-schema">[\s\S]*?<\/script>/,
    )?.[0] || "";
  if (!block.includes('"@graph"') && !block.includes('"FAQPage"')) {
    console.error(`[${lang}/index.html] missing @graph or FAQ in local schema`);
    errors++;
    continue;
  }
  const bad = HOME_CHECKS[lang]?.bad;
  if (bad?.test(block)) {
    console.error(`[${lang}/index.html] foreign-language FAQ in JSON-LD`);
    errors++;
  }
  if (lang === "pt" && !/Fisioterapeuta e osteopata/.test(block)) {
    console.error(`[${lang}/index.html] missing PT jobTitle in schema`);
    errors++;
  }
}

const medicalPartial = fs.readFileSync(
  path.join(ROOT, "partials/medical-clinic-schema.js"),
  "utf8",
);
for (const lang of LANG_CODES) {
  if (!new RegExp(`"${lang}":\\s*\\{`).test(medicalPartial)) {
    console.error(`[medical-clinic-schema.js] missing schema block for ${lang}`);
    errors++;
  }
}
if (!/"pt"\s*:\s*\{/.test(medicalPartial)) {
  console.error("[medical-clinic-schema.js] missing pt schema block");
  errors++;
}
if (!/\{"es-AR":"es","en":"en","fr":"fr","pt":"pt"\}/.test(medicalPartial)) {
  console.error("[medical-clinic-schema.js] missing lang map for pt");
  errors++;
}

if (errors) {
  console.error(`\nverify-schema-i18n FAILED (${errors} issue(s))`);
  process.exit(1);
}
console.log("verify-schema-i18n OK");
