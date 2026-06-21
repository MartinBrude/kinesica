/** @type {import('purgecss').UserDefinedOptions[]} */
const siteContent = [
  "./*.html",
  "./en/**/*.html",
  "./fr/**/*.html",
  "./pt/**/*.html",
  "./js/**/*.js",
  "./partials/**/*.js",
  "./scripts/**/*.mjs",
];

/** Classes toggled in JS or injected after load — keep during purge. */
const dynamicSafelist = [
  "open",
  "in",
  "active",
  "collapse",
  "collapsed",
  "collapsing",
  "menu-opened",
  "submenu-opened",
  "submenu-button",
  "small-screen",
  "has-sub",
  "dropdown",
  "select-list",
  "is-scrolled",
  "is-sticky",
  "ui-reveal",
  "is-visible",
  "page-header-word",
  "page-header-word--long",
  "align-center",
  "align-right",
  "dynamic-whatsapp-url",
  "dynamic-whatsapp-link",
  "dynamic-tel-link",
  "whatsapp-icon",
  "sticky-wrapper",
  "lang-picker",
  "is-open",
  "google-reviews-grid--loading",
  "google-review-star--on",
  "faq-accordion",
  "js",
  "map-embed-facade",
  "map-embed-frame--loaded",
];

const profiles = {
  site: {
    content: siteContent,
    css: ["./css/style.css", "./css/whatsapp.css"],
    output: "./css/dist",
  },
  bootstrap: {
    content: siteContent,
    css: ["./css/bootstrap.full.min.css"],
    output: "./css",
    rename: { "bootstrap.full.min.css": "bootstrap.css" },
  },
  siteFull: {
    content: siteContent,
    css: [
      "./css/bootstrap.full.min.css",
      "./css/font-awesome.min.css",
      "./css/style.css",
      "./css/whatsapp.css",
    ],
    output: "./css/dist-full",
    rename: { "bootstrap.full.min.css": "bootstrap.css" },
  },
  cv: {
    content: [
      "./cv.html",
      "./en/cv.html",
      "./fr/cv.html",
      "./pt/cv.html",
      "./js/**/*.js",
      "./partials/**/*.js",
    ],
    css: ["./css/style.css", "./css/cv.css", "./css/whatsapp.css"],
    output: "./css/dist-cv",
  },
};

function buildOptions(profileName) {
  const profile = profiles[profileName];
  return {
    content: profile.content,
    css: profile.css,
    safelist: {
      standard: dynamicSafelist,
      greedy: [
        /^col-/,
        /^panel-/,
        /^navbar-/,
        /^fa-/,
        /^btn-/,
        /^text-/,
        /^bg-/,
        /^visible-/,
        /^hidden-/,
        /^sr-only/,
        /^map-/,
        /^google-/,
        /^hero-/,
        /^page-/,
        /^pathology-/,
        /^section-/,
        /^space-/,
      ],
    },
    fontFace: true,
    keyframes: true,
    variables: true,
  };
}

module.exports = { profiles, buildOptions };
