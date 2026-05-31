#!/usr/bin/env node
/**
 * Regenera partials JS (fallback si el HTML no tiene JSON-LD inline).
 * Tras npm run seo:schema el HTML ya lleva el bloque inline; esto mantiene paridad.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HTML_LANG } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import {
  buildClinicOnly,
  buildFaqPage,
} from "./schema-local-business.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function schemasJson(buildFn) {
  return JSON.stringify(
    Object.fromEntries(LANG_CODES.map((lang) => [lang, buildFn(lang)])),
    null,
    2,
  );
}

/** Map html[lang] BCP-47 values → site lang codes (generated from languages.mjs). */
function langDetectExpr() {
  const map = Object.fromEntries(
    LANG_CODES.map((code) => [HTML_LANG[code], code]),
  );
  return `(${JSON.stringify(map)})[htmlLang]||"es"`;
}

const medicalPartial = `/**
 * AUTO-GENERATED — no editar. Fuente: scripts/schema-local-business.mjs
 * Regenerar: npm run schema:partials
 */
(function () {
  var htmlLang = document.documentElement.getAttribute("lang") || "es-AR";
  var lang = ${langDetectExpr()};
  var schemas = ${schemasJson(buildClinicOnly)};
  var schema = schemas[lang] || schemas.es;
  if (document.getElementById("kinesica-local-schema")) return;
  var script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "kinesica-local-schema";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
})();
`;

const faqPartial = `/**
 * AUTO-GENERATED — no editar. Fuente: scripts/schema-local-business.mjs
 */
(function () {
  if (!document.getElementById("faqAccordion")) return;
  var htmlLang = document.documentElement.getAttribute("lang") || "es-AR";
  var lang = ${langDetectExpr()};
  var schemas = ${schemasJson(buildFaqPage)};
  var schema = schemas[lang] || schemas.es;
  var script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
})();
`;

fs.writeFileSync(
  path.join(ROOT, "partials/medical-clinic-schema.js"),
  medicalPartial,
);
fs.writeFileSync(path.join(ROOT, "partials/faq-schema.js"), faqPartial);
console.log(
  `Wrote partials/medical-clinic-schema.js and partials/faq-schema.js (${LANG_CODES.join("/")})`,
);
