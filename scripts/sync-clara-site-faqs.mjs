#!/usr/bin/env node
/**
 * Sync home FAQs → kinesica-bot Clara router.
 * Fuente: scripts/faq-content.mjs → ../kinesica-bot/workflow_nodes/site_home_faqs.js
 *
 * Uso: node scripts/sync-clara-site-faqs.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { faqsForClara } from "./faq-content.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "../kinesica-bot/workflow_nodes/site_home_faqs.js");

const faqs = faqsForClara();
if (!Array.isArray(faqs) || faqs.length !== 8) {
  console.error(`Expected 8 Clara FAQs, got ${faqs?.length ?? 0}`);
  process.exit(1);
}

const body = `// AUTO-GENERATED — no editar a mano.
// Fuente: kinesica/scripts/faq-content.mjs → node scripts/sync-clara-site-faqs.mjs
const SITE_HOME_FAQS = ${JSON.stringify(faqs, null, 2)};
`;

writeFileSync(OUT, body, "utf8");
console.log(`✓ Wrote ${OUT} (${faqs.length} FAQs)`);
