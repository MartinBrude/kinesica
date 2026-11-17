#!/usr/bin/env node
/**
 * Anti-drift: SITE_HOME_FAQS en kinesica-bot ≡ faqsForClara() desde faq-content.mjs.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { faqsForClara } from "./faq-content.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOT_FAQS = resolve(ROOT, "../kinesica-bot/workflow_nodes/site_home_faqs.js");

function fail(msg) {
  console.error(`verify-clara-site-faqs: ${msg}`);
  process.exit(1);
}

if (!existsSync(BOT_FAQS)) {
  fail(`missing ${BOT_FAQS} — run: node scripts/sync-clara-site-faqs.mjs`);
}

const src = readFileSync(BOT_FAQS, "utf8");
const match = src.match(/const SITE_HOME_FAQS\s*=\s*(\[[\s\S]*?\]);/);
if (!match) fail("could not parse SITE_HOME_FAQS from site_home_faqs.js");

let synced;
try {
  synced = JSON.parse(match[1]);
} catch (e) {
  fail(`invalid JSON in site_home_faqs.js: ${e.message}`);
}

const expected = faqsForClara();
const a = JSON.stringify(expected);
const b = JSON.stringify(synced);
if (a !== b) {
  fail(
    "SITE_HOME_FAQS drifted from faqsForClara(). Run: node scripts/sync-clara-site-faqs.mjs"
  );
}

console.log(`✓ Clara site FAQs in sync (${expected.length} items)`);
