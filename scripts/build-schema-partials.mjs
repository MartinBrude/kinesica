#!/usr/bin/env node
/**
 * Regenera partials JS (fallback si el HTML no tiene JSON-LD inline).
 * Tras npm run seo:schema el HTML ya lleva el bloque inline; esto mantiene paridad.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildClinicOnly,
  buildFaqPage,
} from "./schema-local-business.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const medicalPartial = `/**
 * AUTO-GENERATED — no editar. Fuente: scripts/schema-local-business.mjs
 * Regenerar: npm run schema:partials
 */
(function () {
  var htmlLang = document.documentElement.getAttribute("lang") || "es";
  var lang = htmlLang === "en" ? "en" : htmlLang === "fr" ? "fr" : "es";
  var schemas = ${JSON.stringify(
    {
      es: buildClinicOnly("es"),
      en: buildClinicOnly("en"),
      fr: buildClinicOnly("fr"),
    },
    null,
    2,
  )};
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
  var htmlLang = document.documentElement.getAttribute("lang") || "es";
  var lang = htmlLang === "en" ? "en" : htmlLang === "fr" ? "fr" : "es";
  var schemas = ${JSON.stringify(
    {
      es: buildFaqPage("es"),
      en: buildFaqPage("en"),
      fr: buildFaqPage("fr"),
    },
    null,
    2,
  )};
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
console.log("Wrote partials/medical-clinic-schema.js and partials/faq-schema.js");
