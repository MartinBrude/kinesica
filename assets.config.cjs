/**
 * Kinésica — fuentes editables vs assets de producción (.min).
 *
 * Editá siempre los archivos SIN .min (p. ej. css/style.css, js/nav-include.js).
 * Después de cambiar algo: npm run assets:build
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

/** CSS propios del sitio (no vendor). */
const CSS_SOURCES = [
  "css/critical.css",
  "css/style.css",
  "css/whatsapp.css",
  "css/cv.css",
];

/** JS de terceros o ya minificados — no regenerar. */
const JS_SKIP = new Set([
  "jquery.min.js",
  "bootstrap.min.js",
  "menumaker.js",
]);

function discoverJsSources() {
  const files = [];
  for (const dir of ["js", "partials"]) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (!name.endsWith(".js")) continue;
      if (name.endsWith(".min.js") || JS_SKIP.has(name)) continue;
      files.push(`${dir}/${name}`);
    }
  }
  return files.sort();
}

/** css/foo.css → css/foo.min.css | js/bar.js → js/bar.min.js */
function toMinPath(rel) {
  if (rel.endsWith(".min.css") || rel.endsWith(".min.js")) return rel;
  if (rel.endsWith(".css")) return rel.replace(/\.css$/, ".min.css");
  if (rel.endsWith(".js")) return rel.replace(/\.js$/, ".min.js");
  return rel;
}

function getSourceManifest() {
  const js = discoverJsSources();
  return { css: [...CSS_SOURCES], js };
}

function getAllSources() {
  const { css, js } = getSourceManifest();
  return [...css, ...js];
}

module.exports = {
  ROOT,
  CSS_SOURCES,
  JS_SKIP,
  discoverJsSources,
  toMinPath,
  getSourceManifest,
  getAllSources,
};
