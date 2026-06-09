#!/usr/bin/env node
/**
 * Run all site verification scripts (i18n, PT copy, schema, SEO audit).
 * Run: npm run verify
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const steps = [
  ["node", ["scripts/verify-i18n.mjs"]],
  ["node", ["scripts/verify-pt-copy.mjs"]],
  ["node", ["scripts/verify-schema-i18n.mjs"]],
  ["node", ["scripts/verify-pathology-pages.mjs"]],
  ["node", ["scripts/verify-home-pages.mjs"]],
  ["node", ["scripts/audit-site.mjs"]],
];

for (const [cmd, args] of steps) {
  const label = path.basename(args[0], ".mjs");
  console.log(`\n— ${label} —`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

console.log("\nverify-all OK");
