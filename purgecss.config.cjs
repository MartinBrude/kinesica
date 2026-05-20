/** @type {import('purgecss').UserDefinedOptions[]} */
const siteContent = [
  "./*.html",
  "./en/**/*.html",
  "./fr/**/*.html",
  "./js/**/*.js",
  "./partials/**/*.js",
];

/** Classes toggled in JS or injected after load — keep during purge. */
const dynamicSafelist = [
  "open",
  "in",
  "active",
  "collapse",
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
];

const profiles = {
  site: {
    content: siteContent,
    css: [
      "./css/bootstrap.min.css",
      "./css/font-awesome.min.css",
      "./css/style.css",
      "./css/whatsapp.css",
    ],
    output: "./css/dist",
  },
  cv: {
    content: [
      "./cv.html",
      "./en/cv.html",
      "./fr/cv.html",
      "./js/**/*.js",
      "./partials/**/*.js",
    ],
    css: [
      "./css/bootstrap.min.css",
      "./css/font-awesome.min.css",
      "./css/style.css",
      "./css/cv.css",
      "./css/whatsapp.css",
    ],
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
      ],
    },
    fontFace: true,
    keyframes: true,
    variables: true,
  };
}

module.exports = { profiles, buildOptions };
