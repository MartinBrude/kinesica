#!/usr/bin/env node
/**
 * PurgeCSS audit / build for Kinésica static site.
 *
 *   npm run css:audit     — report size savings (does not overwrite css/)
 *   npm run css:build     — write purged CSS to css/dist/ for review
 *   npm run css:build:cv  — CV pages profile → css/dist-cv/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { PurgeCSS } from "purgecss";

const require = createRequire(import.meta.url);
const { buildOptions, profiles } = require("../purgecss.config.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_DIR = path.join(ROOT, "scripts", "reports");

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const profileArg = [...args].find((a) => a.startsWith("--profile="));
const profileName = profileArg
  ? profileArg.split("=")[1]
  : args.has("--profile")
    ? process.argv[process.argv.indexOf("--profile") + 1]
    : "site";

if (!profiles[profileName]) {
  console.error(`Unknown profile: ${profileName}`);
  process.exit(1);
}

function sizeOf(filePath) {
  return fs.statSync(filePath).size;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function purgeProfile(name) {
  const profile = profiles[name];
  const options = buildOptions(name);
  const originalPaths = profile.css.map((p) => path.join(ROOT, p));

  for (const p of originalPaths) {
    if (!fs.existsSync(p)) {
      throw new Error(`Missing CSS file: ${p}`);
    }
  }

  const result = await new PurgeCSS().purge({
    ...options,
    css: originalPaths,
    rejected: true,
  });

  const rows = [];
  let totalBefore = 0;
  let totalAfter = 0;
  const rejectedByFile = {};

  for (let i = 0; i < result.length; i++) {
    const file = result[i];
    const srcPath = originalPaths[i];
    const base = path.basename(srcPath);
    const before = sizeOf(srcPath);
    const after = Buffer.byteLength(file.css, "utf8");
    totalBefore += before;
    totalAfter += after;
    rows.push({
      file: base,
      before,
      after,
      saved: before - after,
      savedPct: before ? Math.round((1 - after / before) * 100) : 0,
      rejectedCount: file.rejected?.length ?? 0,
    });
    rejectedByFile[base] = (file.rejected ?? []).slice(0, 200);
  }

  const outDir = path.join(ROOT, profile.output.replace(/^\.\//, ""));
  if (write) {
    ensureDir(outDir);
    for (let i = 0; i < result.length; i++) {
      fs.writeFileSync(path.join(outDir, rows[i].file), result[i].css);
    }
  }

  return {
    profile: name,
    outputDir: write ? path.relative(ROOT, outDir) : null,
    rows,
    totalBefore,
    totalAfter,
    rejectedByFile,
  };
}

function printReport(report) {
  console.log(`\nPurgeCSS — profile: ${report.profile}`);
  console.log("─".repeat(60));
  for (const row of report.rows) {
    console.log(
      `${row.file.padEnd(28)} ${formatKb(row.before).padStart(9)} → ${formatKb(row.after).padStart(9)}  (−${row.savedPct}%, ${row.rejectedCount} selectors removed)`,
    );
  }
  const totalSaved = report.totalBefore - report.totalAfter;
  const totalPct = report.totalBefore
    ? Math.round((totalSaved / report.totalBefore) * 100)
    : 0;
  console.log("─".repeat(60));
  console.log(
    `${"TOTAL".padEnd(28)} ${formatKb(report.totalBefore).padStart(9)} → ${formatKb(report.totalAfter).padStart(9)}  (−${totalPct}%, ${formatKb(totalSaved)} saved)`,
  );
  if (report.outputDir) {
    console.log(`\nWritten to: ${report.outputDir}/`);
    console.log("Review in browser before swapping <link> hrefs in HTML.");
  } else {
    console.log("\nAudit only. Run `npm run css:build` to generate css/dist/ for review.");
  }
}

async function main() {
  process.chdir(ROOT);
  ensureDir(REPORT_DIR);

  const names = profileName === "all" ? Object.keys(profiles) : [profileName];
  const reports = [];

  for (const name of names) {
    reports.push(await purgeProfile(name));
  }

  for (const report of reports) {
    printReport(report);
  }

  const outPath = path.join(REPORT_DIR, "css-purge-audit.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: write ? "build" : "audit",
        reports: reports.map((r) => ({
          profile: r.profile,
          outputDir: r.outputDir,
          files: r.rows,
          totalBefore: r.totalBefore,
          totalAfter: r.totalAfter,
          rejectedSample: r.rejectedByFile,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nReport: ${path.relative(ROOT, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
