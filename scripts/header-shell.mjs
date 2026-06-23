/**
 * Shared site header shell (partials + page builders).
 */
import { partialLang } from "./languages.mjs";
import { HEADER_SCHEDULE } from "./partials-strings.mjs";

export { HEADER_SCHEDULE };

/** Markup before <main>: header root + bundled shell scripts. */
export function headerShellMarkup(lang, prefix = "") {
  const l = partialLang(lang);
  return `  <div id="site-header-root" data-header-lang="${l}"></div>
  <script src="${prefix}js/shell-header-${l}.min.js" defer></script>
`;
}
