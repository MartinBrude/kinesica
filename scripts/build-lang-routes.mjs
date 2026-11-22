#!/usr/bin/env node
/**
 * Generate js/lang-routes.js from languages.mjs + i18n-urls.mjs.
 * Run: npm run build:lang-routes
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_LANG,
  LANG_CODES,
  LANGUAGES,
  SUBDIR_LANGS,
} from "./languages.mjs";
import { STEMS } from "./i18n-urls.mjs";
import { renderLangRoutesSource } from "./lang-routes-template.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "js/lang-routes.js");

const publishedLangs = LANGUAGES.filter((l) => l.published);
const source = renderLangRoutesSource({
  defaultLangJson: JSON.stringify(DEFAULT_LANG),
  subdirsJson: JSON.stringify(SUBDIR_LANGS),
  langCodesJson: JSON.stringify(LANG_CODES),
  langsJson: JSON.stringify(
    publishedLangs.map((l) => ({
      code: l.code,
      nativeName: l.nativeName,
      hreflang: l.hreflang,
      urlPrefix: l.urlPrefix,
      isDefault: l.isDefault,
    })),
  ),
  stemsJson: JSON.stringify(STEMS),
});

fs.writeFileSync(OUT, source);
console.log("Wrote", path.relative(ROOT, OUT));
