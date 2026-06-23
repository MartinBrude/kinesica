# JS loading refactor — plan & baseline

**Status:** Implemented (2026-06-23). Bundles built via `npm run assets:build` → `scripts/build-js-bundles.mjs`. Manifest: `scripts/js-bundles.mjs`.

**Goal:** Fewer HTTP requests for site JS without changing runtime behaviour, extra client processing, or UI/features.  
**Scope:** Public pages using the JS shell (`page-shell.mjs`, `header-shell.mjs`, builders, `inject-static-shell.mjs`).

---

## 1. Current architecture (baseline)

### 1.1 Pattern

Shell UI is **not** inlined in HTML. Each page ships empty placeholders (`#site-header-root`, `#site-footer-root`, …) and loads:

1. **Partial** (`partials/*-{lang}.js`) — sets `window.__KINESICA_*_SNIPPET_{LANG}` HTML strings.
2. **Include** (`js/*-include.js`) — reads snippet via `kinesicaLoadSnippet()` and injects DOM.

Shared helpers:

| File | Role |
|------|------|
| `js/lang-routes.min.js` | `KINESICA_LANG_ROUTES`, hreflang paths, `file://` fixes |
| `js/snippet-lang.min.js` | `kinesicaResolveLang`, `kinesicaLoadSnippet` |
| `js/lang-picker.min.js` | Lang switcher UI (called from `header-include`) |
| `js/site-config.min.js` | Site constants |
| `js/whatsapp-logic.min.js` | `kinesicaApplyWhatsAppContact` |

All production scripts use **`defer`** (except the tiny inline `document.documentElement.classList.add("js")` in `<head>`).

### 1.2 Script inventory per page type

| Page type | External `<script src>` count | Notes |
|-----------|------------------------------|-------|
| Pathology / method | **26** | + optional `gtm-events` injected at runtime |
| Home | **29** | + `google-reviews-data` + `google-reviews`; `faq-accordion`, `map-embed-facade` |
| CV / 404 | Similar shell subset | Check builders |

**Total minified JS (pathology, ES):** ~32 KB across those 26 files (see §1.3).

### 1.3 Size by functional group (ES pathology page)

| Group | Files | Size |
|-------|-------|------|
| head-lang | `lang-preference`, `redirect` | 2.3 KB |
| GTM | `gtm-head`, `gtm-body`, `gtm-body-include` | 0.8 KB |
| skip link | `skip-link`, `skip-link-include` | 0.9 KB |
| header shell | `lang-routes`, `snippet-lang`, `header-es`, `header-include`, `lang-picker`, `nav-es`, `nav-include` | 11.0 KB |
| CTA | `cta-strip-es`, `cta-strip-include` | 1.2 KB |
| footer shell | `site-config`, `footer-es`, `footer-include` | 4.2 KB |
| WhatsApp | `whatsapp-float-es`, `whatsapp-float-include`, `whatsapp-logic` | 1.6 KB |
| UI | `page-header-word`, `mobile-nav`, `ui-reveal`, `sticky-header` | 7.9 KB |
| Home only | `faq-accordion`, `map-embed-facade` | 1.9 KB |

### 1.4 Execution order constraints (must preserve)

`defer` runs scripts in **document order**. Dependencies:

```
lang-routes → snippet-lang → partial(header) → header-include → lang-picker
                                              → partial(nav) → nav-include → [kinesica:nav-ready]
mobile-nav listens for kinesica:nav-ready
cta-strip partial → cta-strip-include (may call kinesicaApplyWhatsAppContact)
footer partial → footer-include (file:// links, may inject gtm-events / page-header-word)
whatsapp partial → whatsapp-float-include → whatsapp-logic
ui-reveal, sticky-header, mobile-nav: DOMContentLoaded or events — order among them is loose
```

**Source of truth for markup emission:**

- `scripts/page-shell.mjs` — `bodyShellTop`, `ctaStripPlaceholder`, `bodyFooterAndUiScripts`, `headLangDeferScripts`
- `scripts/header-shell.mjs` — `headerShellMarkup`
- Page builders: `build-home-pages.mjs`, `build-pathology-pages.mjs`, `build-method-pages.mjs`, …
- Legacy HTML: `inject-static-shell.mjs`

### 1.5 Build pipeline today

```
js/*.js, partials/*.js  →  minify-assets.mjs (esbuild, bundle: false)  →  *.min.js
                        →  HTML refs synced + ?v= cache bust
```

`assets.config.cjs` discovers all non-`.min.js` sources; each file minified independently.

---

## 2. Findings & quick wins (no bundling)

### 2.1 Duplicate `page-header-word` load

On pathology/method pages **both**:

1. `bodyFooterAndUiScripts({ pageHeaderWord: true })` emits `<script src="…/page-header-word.min.js">`.
2. `js/footer-include.js` dynamically appends the same script when `.page-header` exists.

**Effect:** 2 HTTP requests + double execution (second run mostly no-ops).  
**Fix (Phase 0):** Pick one strategy:

- **A (recommended):** Remove explicit tag from `bodyFooterAndUiScripts`; keep lazy load in `footer-include` only when `.page-header` present.
- **B:** Remove dynamic injection from `footer-include`; keep explicit tag only when `pageHeaderWord: true`.

Saves **1 request** on ~40+ pages with zero behaviour change if chosen consistently.

### 2.2 Already lazy-loaded

- `gtm-events.min.js` — injected from `footer-include` (not counted in base 26).
- Home reviews — only on index pages.

### 2.3 What not to merge

| Asset | Reason to keep separate |
|-------|-------------------------|
| `partials/gtm-head.min.js` | Third-party / analytics boundary; may want different cache policy |
| Inline `js` class script | Must stay synchronous & tiny for lang-picker CSS |
| `js/site-secrets.js` | Local dev only (`JS_SKIP` in assets config) |

---

## 3. Refactor strategy: build-time concatenation

### 3.1 Why concat, not “smart” bundling

- All modules are **IIFEs + `window` globals** — no ES imports.
- `esbuild` with `bundle: false` today; **`bundle: true` is unnecessary** and risks reordering.
- **Concatenating already-minified files in a fixed order** = same runtime code, **one parse**, fewer round trips, **no extra client processing**.
- Prototype: 7-file header shell → 11.0 KB single file (identical bytes, already minified).

### 3.2 Proposed bundles

| Output file | Concatenates (in order) | Pages | Saves |
|-------------|-------------------------|-------|-------|
| `js/head-lang.min.js` | `lang-preference`, `redirect` | all | 2→1 |
| `js/shell-top.min.js` | `skip-link`, `skip-link-include`, `gtm-body`, `gtm-body-include` | all | 4→1 |
| `js/shell-header-{es,en,fr,pt}.min.js` | `lang-routes`, `snippet-lang`, `header-{l}`, `header-include`, `lang-picker`, `nav-{l}`, `nav-include` | per lang | 7→1 |
| `js/shell-cta-{l}.min.js` | `cta-strip-{l}`, `cta-strip-include` | per lang | 2→1 |
| `js/shell-footer-{l}.min.js` | `site-config`, `footer-{l}`, `footer-include` | per lang | 3→1 |
| `js/shell-whatsapp-{l}.min.js` | `whatsapp-float-{l}`, `whatsapp-float-include`, `whatsapp-logic` | per lang | 3→1 |
| `js/ui-core.min.js` | `mobile-nav`, `ui-reveal`, `sticky-header` | all | 3→1 |
| `js/ui-home.min.js` | `faq-accordion`, `map-embed-facade` | home only | 2→1 |
| `js/reviews.min.js` | `google-reviews-data`, `google-reviews` | home only | 2→1 |

**Keep as single script tags (unchanged):**

- `partials/gtm-head.min.js`
- `js/page-header-word.min.js` (after Phase 0 dedupe)
- Dynamic `gtm-events.min.js`

### 3.3 Request count after full refactor

| Page type | Before | After (measured) | Reduction |
|-----------|--------|------------------|-----------|
| Pathology / method | 26 | **8** | −69% |
| Home | 29 | **10** | −66% |
| Artículos index | ~26 | **8** | −69% |

DOM output after JS runs: **unchanged** (same injectors, same snippets).

### 3.4 Cache / versioning

Extend `minify-assets.mjs`:

1. Minify sources → `.min.js` (as today).
2. New step `build-js-bundles.mjs`: concat subsets → `js/shell-*.min.js`, include any source mtime in bundle version.
3. Reuse `shellCacheVersion()` pattern — bump `?v=` when any member changes.

Per-language bundles mean editing `nav-es.js` only invalidates `shell-header-es.min.js`, not EN/FR/PT.

---

## 4. HTML comparison (pathology page)

### 4.1 Before (`epicondilitis-medial.html` — excerpt)

```html
<body>
  <div id="site-skip-link-root"></div>
  <script src="js/skip-link.min.js?v=…" defer></script>
  <script src="js/skip-link-include.min.js?v=…" defer></script>
  <div id="site-gtm-body-root"></div>
  <script src="partials/gtm-body.min.js?v=…" defer></script>
  <script src="js/gtm-body-include.min.js?v=…" defer></script>

  <div id="site-header-root" data-header-lang="es"></div>
  <script src="js/lang-routes.min.js?v=…" defer></script>
  <script src="js/snippet-lang.min.js?v=…" defer></script>
  <script src="partials/header-es.min.js?v=…" defer></script>
  <script src="js/header-include.min.js?v=…" defer></script>
  <script src="js/lang-picker.min.js?v=…" defer></script>
  <script src="partials/nav-es.min.js?v=…" defer></script>
  <script src="js/nav-include.min.js?v=…" defer></script>

  <main>…</main>

  <div id="site-cta-strip-root" data-cta-lang="es"></div>
  <script src="partials/cta-strip-es.min.js?v=…" defer></script>
  <script src="js/cta-strip-include.min.js?v=…" defer></script>

  <div id="site-footer-root" data-footer-lang="es"></div>
  <script src="js/site-config.min.js?v=…" defer></script>
  <script src="partials/footer-es.min.js?v=…" defer></script>
  <script src="js/footer-include.min.js?v=…" defer></script>

  <div id="site-whatsapp-root" data-whatsapp-lang="es"></div>
  <script src="partials/whatsapp-float-es.min.js?v=…" defer></script>
  <script src="js/whatsapp-float-include.min.js?v=…" defer></script>
  <script src="js/whatsapp-logic.min.js?v=…" defer></script>

  <script src="js/page-header-word.min.js?v=…" defer></script>
  <script src="js/mobile-nav.min.js?v=…" defer></script>
  <script src="js/ui-reveal.min.js?v=…" defer></script>
  <script src="js/sticky-header.min.js?v=…" defer></script>
</body>
```

`<head>` also has: inline `js` class, `lang-preference`, `redirect`, `gtm-head` (4 script-related items).

### 4.2 After (target — same DOM, fewer tags)

```html
<head>
  …
  <script>document.documentElement.classList.add("js");</script>
  <script src="js/head-lang.min.js?v=…" defer></script>
  …
  <script src="partials/gtm-head.min.js?v=…" defer></script>
</head>
<body>
  <div id="site-skip-link-root"></div>
  <div id="site-gtm-body-root"></div>
  <script src="js/shell-top.min.js?v=…" defer></script>

  <div id="site-header-root" data-header-lang="es"></div>
  <script src="js/shell-header-es.min.js?v=…" defer></script>

  <main>…</main>

  <div id="site-cta-strip-root" data-cta-lang="es"></div>
  <script src="js/shell-cta-es.min.js?v=…" defer></script>

  <div id="site-footer-root" data-footer-lang="es"></div>
  <script src="js/shell-footer-es.min.js?v=…" defer></script>

  <div id="site-whatsapp-root" data-whatsapp-lang="es"></div>
  <script src="js/shell-whatsapp-es.min.js?v=…" defer></script>

  <!-- page-header-word: only if not lazy-loaded from footer-include (Phase 0) -->
  <script src="js/ui-core.min.js?v=…" defer></script>
</body>
```

**Unchanged:** all `id`/`data-*` placeholders, `<main>` content, JSON-LD, CSS, hreflang, canonical.

---

## 5. Implementation phases

### Phase 0 — Dedupe (low risk, ~1 day)

1. Resolve `page-header-word` double load (§2.1).
2. `npm run seo:audit` + manual smoke: header, nav, mobile menu, lang picker, WhatsApp, CTA.

### Phase 1 — Bundle builder (medium)

1. Add `scripts/build-js-bundles.mjs` + manifest (bundle name → ordered source paths).
2. Hook into `npm run assets:build` after `minify-assets.mjs`.
3. Keep individual `.min.js` files for debugging / `file://` local preview if needed.

### Phase 2 — Emit fewer tags (medium)

1. Update `page-shell.mjs`, `header-shell.mjs` to reference bundles.
2. Regenerate pages: `build:home`, `build:pathologies`, `build:methods`, `inject-static-shell` for legacy.
3. Update `apply-seo-performance.mjs` `DEFER_SCRIPTS` list.
4. Update `audit-site.mjs` `auditJsShellScripts` to accept bundle paths **or** member fragments.

### Phase 3 — QA & SEO verification

```bash
npm run assets:build
npm run seo:audit
# Lighthouse / WebPageTest: compare "Reduce unused JavaScript" & network waterfall
```

**Regression checklist:**

- [ ] Header + nav render; current page highlighted
- [ ] Lang picker: 4 languages, correct URLs
- [ ] Mobile nav + submenus
- [ ] Footer links, WhatsApp float + dynamic phone links
- [ ] CTA strip WhatsApp links
- [ ] `file://` local open (lang-routes file protocol)
- [ ] Home: reviews, FAQ accordion, map facade
- [ ] GTM / gtm-events still fire

---

## 6. Files to touch (next PR)

| File | Change |
|------|--------|
| `scripts/build-js-bundles.mjs` | **new** — concat manifest |
| `assets.config.cjs` | export `JS_BUNDLES` manifest |
| `scripts/minify-assets.mjs` | call bundle step; version bundles |
| `scripts/page-shell.mjs` | `bodyShellTop`, `bodyFooterAndUiScripts`, `headLangDeferScripts` |
| `scripts/header-shell.mjs` | single `shell-header-{l}` tag |
| `scripts/apply-seo-performance.mjs` | defer list |
| `scripts/audit-site.mjs` | bundle-aware shell audit |
| `js/footer-include.js` | Phase 0 dedupe |
| Page builders | rebuild HTML only (no logic change) |

**Do not** hand-edit hundreds of HTML files — always regenerate via builders + `inject-static-shell.mjs`.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Wrong concat order breaks shell | Manifest with explicit order; integration test parsing `shell-header-es` |
| Stale bundle cache | Bundle `?v=` = max mtime of members |
| Harder debugging | Keep atomic `.min.js`; bundles are build artifacts only |
| Audit false positives | Teach `audit-site` bundle names |
| Larger single file download | ~32 KB total unchanged; HTTP/2 single connection; fewer TLS/handshake overheads on HTTP/1.1 |

---

## 8. SEO impact expectation

- **Lighthouse / CrUX:** Fewer requests improves “Network dependency tree” and can help TBT slightly (one JS parse vs many).
- **Bytes:** Neutral (minus Phase 0 dedupe).
- **Crawling:** No change — content is still in HTML; shell is progressive enhancement.
- **Not a substitute for:** image LCP, CSS weight, or third-party GTM cost.

---

## 9. Verdict

| Question | Answer |
|----------|--------|
| Is refactor possible without losing functionality? | **Yes** — concat preserves IIFE execution order. |
| Extra client processing? | **No** — same code paths; potentially less parse overhead. |
| Worth doing? | **Yes** — ~65% fewer script requests on content pages; aligns with static-site simplicity (build step only). |
| Recommended first step? | **Phase 0** dedupe `page-header-word`, then Phase 1–2 bundles. |

---

## Appendix A — Full script list (pathology ES, current)

1. `js/lang-preference.min.js`
2. `js/redirect.min.js`
3. `partials/gtm-head.min.js`
4. `partials/skip-link.min.js`
5. `js/skip-link-include.min.js`
6. `partials/gtm-body.min.js`
7. `js/gtm-body-include.min.js`
8. `js/lang-routes.min.js`
9. `js/snippet-lang.min.js`
10. `partials/header-es.min.js`
11. `js/header-include.min.js`
12. `js/lang-picker.min.js`
13. `partials/nav-es.min.js`
14. `js/nav-include.min.js`
15. `partials/cta-strip-es.min.js`
16. `js/cta-strip-include.min.js`
17. `js/site-config.min.js`
18. `partials/footer-es.min.js`
19. `js/footer-include.min.js`
20. `partials/whatsapp-float-es.min.js`
21. `js/whatsapp-float-include.min.js`
22. `js/whatsapp-logic.min.js`
23. `js/page-header-word.min.js`
24. `js/mobile-nav.min.js`
25. `js/ui-reveal.min.js`
26. `js/sticky-header.min.js`

(+ runtime: `gtm-events.min.js` from footer-include)
