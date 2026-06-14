/**
 * Shared site header shell (partials + page builders).
 */
import { partialLang } from "./languages.mjs";
import { HEADER_SCHEDULE } from "./partials-strings.mjs";

export { HEADER_SCHEDULE };

/** Markup before <main>: header root + header/nav scripts (nav early avoids stale footer cache). */
export function headerShellMarkup(lang, prefix = "") {
  const l = partialLang(lang);
  return `  <div id="site-header-root" data-header-lang="${l}"></div>
  <script src="${prefix}js/lang-routes.min.js" defer></script>
  <script src="${prefix}js/snippet-lang.min.js" defer></script>
  <script src="${prefix}partials/header-${l}.min.js" defer></script>
  <script src="${prefix}js/header-include.min.js" defer></script>
  <script src="${prefix}js/lang-picker.min.js" defer></script>
  <script src="${prefix}partials/nav-${l}.min.js" defer></script>
  <script src="${prefix}js/nav-include.min.js" defer></script>
`;
}
