#!/usr/bin/env node
/**
 * Phase 1 HTML patches: hreflang fr, 3-flag switcher, lang scripts, footer partials.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.kinesica.com.ar";

const STEMS = [
  "index",
  "articulos",
  "atm",
  "cadenas",
  "cervicalgia",
  "lumbalgia",
  "manipulaciones",
  "neurodinamia",
  "osteopatia",
  "rpg",
];

function stemFromFile(file) {
  if (file === "index.html" || file === "index_en.html" || file === "index_fr.html") {
    return "index";
  }
  const m = file.match(/^(.+)_(en|fr)\.html$/);
  if (m) return m[1];
  return file.replace(/\.html$/, "");
}

function urls(stem) {
  const es = stem === "index" ? `${SITE}/` : `${SITE}/${stem}.html`;
  const en = `${SITE}/${stem === "index" ? "index_en.html" : stem + "_en.html"}`;
  const fr = `${SITE}/${stem === "index" ? "index_fr.html" : stem + "_fr.html"}`;
  const esFile = stem === "index" ? "index.html" : `${stem}.html`;
  const enFile = stem === "index" ? "index_en.html" : `${stem}_en.html`;
  const frFile = stem === "index" ? "index_fr.html" : `${stem}_fr.html`;
  return { es, en, fr, esFile, enFile, frFile };
}

function frFlagLi(stem) {
  const { frFile } = urls(stem);
  return `              <li>
                <a href="${frFile}"><img src="images/fr.svg" alt="bandera francesa" width="24" height="16" /></a>
              </li>`;
}

function patchHreflang(html, stem) {
  const { es, en, fr } = urls(stem);
  if (html.includes('hreflang="fr"')) {
    return html;
  }
  if (stem === "index") {
    if (html.includes('hreflang="en" href="https://www.kinesica.com.ar/index_en.html"')) {
      return html.replace(
        /(<link rel="alternate" hreflang="en" href="https:\/\/www\.kinesica\.com\.ar\/index_en\.html" \/>)\n(\s*<link rel="alternate" hreflang="x-default")/,
        `$1\n  <link rel="alternate" hreflang="fr" href="${fr}" />\n$2`
      );
    }
  }
  return html.replace(
    /(<link rel="alternate" hreflang="en" href="[^"]+" \/>)\n(\s*<link rel="alternate" hreflang="x-default")/,
    `$1\n  <link rel="alternate" hreflang="fr" href="${fr}" />\n$2`
  ).replace(
    /(<link rel="alternate" hreflang="es" href="[^"]+" \/>)\n(\s*<link rel="alternate" hreflang="en")/,
    (full, p1, p2) => {
      if (full.includes('hreflang="fr"')) return full;
      return `${p1}\n  <link rel="alternate" hreflang="fr" href="${fr}" />\n${p2}`;
    }
  );
}

function patchOgLocaleAlternate(html) {
  if (html.includes('content="fr_FR"') && html.includes("og:locale:alternate")) {
    return html;
  }
  if (!html.includes('property="og:locale:alternate" content="en_US"')) {
    return html;
  }
  if (html.includes('og:locale:alternate" content="fr_FR"')) {
    return html;
  }
  return html.replace(
    /<meta property="og:locale:alternate" content="en_US" \/>/,
    '<meta property="og:locale:alternate" content="en_US" />\n  <meta property="og:locale:alternate" content="fr_FR" />'
  );
}

function patchLangSwitcher(html, stem) {
  if (html.includes("images/fr.svg")) {
    return html;
  }
  const frLi = frFlagLi(stem);
  return html.replace(
    /(<a href="[^"]*_en\.html"[^>]*>[\s\S]*?<\/a>\s*<\/li>)(\s*<\/ul>)/,
    `$1\n${frLi}\n            $2`
  );
}

function patchRedirectHead(html) {
  let out = html;
  if (!out.includes("js/lang-routes.js")) {
    out = out.replace(
      /<script src="js\/redirect\.js"><\/script>/,
      '<script src="js/lang-routes.js"></script>\n  <script src="js/lang-preference.js"></script>\n  <script src="js/redirect.js"></script>'
    );
  }
  return out;
}

function patchFooterScripts(html, lang) {
  const partial = `partials/footer-${lang}.js`;
  if (html.includes(partial)) {
    return html;
  }
  return html.replace(
    /<script src="js\/footer-include\.js"><\/script>/,
    `<script src="${partial}"></script>\n  <script src="js/footer-include.js"></script>`
  );
}

function patchLangPreferenceBody(html) {
  if (html.includes("js/lang-preference.js")) {
    return html;
  }
  return html.replace("</body>", '  <script src="js/lang-preference.js"></script>\n</body>');
}

function patchFile(filePath) {
  const file = path.basename(filePath);
  if (file.startsWith("404")) {
    return patch404(filePath, file);
  }
  if (!file.endsWith(".html")) return;

  const isFr = file.endsWith("_fr.html");
  const isEn = file.endsWith("_en.html");
  const isEs = !isFr && !isEn;

  if (isFr) {
    let html = fs.readFileSync(filePath, "utf8");
    html = patchFooterScripts(html, "fr");
    html = patchLangPreferenceBody(html);
    fs.writeFileSync(filePath, html);
    console.log("Patched (fr scripts):", file);
    return;
  }

  const stem = stemFromFile(file);
  let html = fs.readFileSync(filePath, "utf8");

  if (isEs || isEn) {
    html = patchHreflang(html, stem);
    html = patchLangSwitcher(html, stem);
    if (isEs) {
      html = patchOgLocaleAlternate(html);
      html = patchRedirectHead(html);
    }
    html = patchFooterScripts(html, isEn ? "en" : "es");
  }

  html = patchLangPreferenceBody(html);
  fs.writeFileSync(filePath, html);
  console.log("Patched:", file);
}

function patch404(filePath, file) {
  let html = fs.readFileSync(filePath, "utf8");
  if (file === "404.html") {
    if (!html.includes("error-lang-links")) {
      const block = `
    .error-lang-links { margin-top: 24px; font-size: 16px; }
    .error-lang-links a { margin: 0 12px; }`;
      html = html.replace(".btn-home {", block + "\n\n    .btn-home {");
      html = html.replace(
        '<a href="index.html" class="btn btn-primary btn-home"',
        `<a href="index.html" class="btn btn-primary btn-home"`
      );
      html = html.replace(
        /(<a href="index\.html" class="btn btn-primary btn-home"[^>]*>Volver al inicio<\/a>)/,
        `$1
    <p class="error-lang-links">
      <a href="404.html">Español</a>
      <a href="404_en.html">English</a>
      <a href="404_fr.html">Français</a>
    </p>`
      );
      html = html.replace(
        '</div>\n    </motion.div>\n  </motion.div>\n\n  <div class="header">',
        `</div>\n        <div class="col-lg-8 col-md-8 col-sm-8 col-xs-12">
          <div class="top-text">
            <ul class="lang-switcher">
              <li><a href="404.html"><img src="images/es.svg" alt="bandera española" width="24" height="16" /></a></li>
              <li><a href="404_en.html"><img src="images/gb.svg" alt="bandera inglesa" width="24" height="16" /></a></li>
              <li><a href="404_fr.html"><img src="images/fr.svg" alt="bandera francesa" width="24" height="16" /></a></li>
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  </motion.div>

  <div class="header">`
      );
      // fix motion.div if any
      html = html.replaceAll("motion.div", "div");
      const headerTop = html.indexOf('<motion.div class="header-top">');
      if (headerTop === -1) {
        html = html.replace(
          '<div class="header-top">',
          `<div class="header-top">
    <div class="container">
      <div class="row">
        <motion.div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
          <span class="text-block time-block">
            <span class="time-text">Lunes a viernes: <strong>10 a 20 h</strong></span>
          </span>
        </motion.div>
        <div class="col-lg-8 col-md-8 col-sm-8 col-xs-12">
          <div class="top-text">
            <ul class="lang-switcher">
              <li><a href="404.html"><img src="images/es.svg" alt="bandera española" width="24" height="16" /></a></li>
              <li><a href="404_en.html"><img src="images/gb.svg" alt="bandera inglesa" width="24" height="16" /></a></li>
              <li><a href="404_fr.html"><img src="images/fr.svg" alt="bandera francesa" width="24" height="16" /></a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>`
        );
        html = html.replaceAll("motion.div", "motion.div");
      }
    }
    html = patchLangPreferenceBody(html);
    fs.writeFileSync(filePath, html.replaceAll("motion.div", "div"));
    console.log("Patched:", file);
    return;
  }
  html = patchLangPreferenceBody(html);
  fs.writeFileSync(filePath, html);
}

// Simpler 404.html patch - read and rewrite cleanly
function patch404Simple() {
  const p = path.join(ROOT, "404.html");
  let html = fs.readFileSync(p, "utf8");
  if (html.includes("404_fr.html")) {
    return;
  }
  html = html.replace(
    ".btn-home {\n      margin-top: 30px;",
    `.error-lang-links { margin-top: 24px; font-size: 16px; }
    .error-lang-links a { margin: 0 12px; }

    .btn-home {
      margin-top: 30px;`
  );
  html = html.replace(
    `<motion.div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
          <span class="text-block time-block">
            <span class="time-text">Lunes a viernes: <strong>10 a 20 h</strong></span>
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  </motion.div>`,
    `<div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
          <span class="text-block time-block">
            <span class="time-text">Lunes a viernes: <strong>10 a 20 h</strong></span>
          </span>
        </div>
        <div class="col-lg-8 col-md-8 col-sm-8 col-xs-12">
          <div class="top-text">
            <ul class="lang-switcher">
              <li><a href="404.html"><img src="images/es.svg" alt="bandera española" width="24" height="16" /></a></li>
              <li><a href="404_en.html"><img src="images/gb.svg" alt="bandera inglesa" width="24" height="16" /></a></li>
              <li><a href="404_fr.html"><img src="images/fr.svg" alt="bandera francesa" width="24" height="16" /></a></li>
            </ul>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>`
  );
  // fallback for standard 404 structure
  if (!html.includes("lang-switcher")) {
    html = html.replace(
      `<motion.div class="header-top">
    <motion.div class="container">
      <motion.div class="row">
        <motion.div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
          <span class="text-block time-block">
            <span class="time-text">Lunes a viernes: <strong>10 a 20 h</strong></span>
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  </motion.div>`,
      ""
    );
    html = html.replace(
      `<div class="header-top">
    <div class="container">
      <div class="row">
        <motion.div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
          <span class="text-block time-block">
            <span class="time-text">Lunes a viernes: <strong>10 a 20 h</strong></span>
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  </motion.div>`,
      `<div class="header-top">
    <div class="container">
      <div class="row">
        <div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
          <span class="text-block time-block">
            <span class="time-text">Lunes a viernes: <strong>10 a 20 h</strong></span>
          </span>
        </div>
        <div class="col-lg-8 col-md-8 col-sm-8 col-xs-12">
          <div class="top-text">
            <ul class="lang-switcher">
              <li><a href="404.html"><img src="images/es.svg" alt="bandera española" width="24" height="16" /></a></li>
              <li><a href="404_en.html"><img src="images/gb.svg" alt="bandera inglesa" width="24" height="16" /></a></li>
              <li><a href="404_fr.html"><img src="images/fr.svg" alt="bandera francesa" width="24" height="16" /></a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>`
    );
  }
  html = html.replaceAll("motion.div", "div");
  html = html.replace(
    '<a href="index.html" class="btn btn-primary btn-home" rel="noopener">Volver al inicio</a>',
    `<a href="index.html" class="btn btn-primary btn-home" rel="noopener">Volver al inicio</a>
    <p class="error-lang-links">
      <a href="404.html">Español</a>
      <a href="404_en.html">English</a>
      <a href="404_fr.html">Français</a>
    </p>`
  );
  if (!html.includes("lang-preference")) {
    html = html.replace("</body>", '  <script src="js/lang-preference.js"></script>\n</body>');
  }
  fs.writeFileSync(p, html);
  console.log("Patched: 404.html");
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
for (const f of files) {
  patchFile(path.join(ROOT, f));
}
patch404Simple();
