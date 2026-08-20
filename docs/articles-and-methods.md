# Artículos (patologías) y métodos — Kinésica

Guía directa: **dónde editar** y **qué regenerar**. No editar HTML de `gonalgia.html`, `rpg.html`, etc. a mano.

---

## Artículos / patologías

Un «artículo» = página de patología (`/{stem}.html`, `/en/{stem}.html`, …) + tarjeta en `articulos.html`.

### Mapa

```
scripts/pathology-content.mjs   ← copy de cada patología (ES/EN/FR/PT)
scripts/articles-index-content.mjs ← copy del índice articulos.html (títulos intro, meta)
scripts/articles-categories.mjs  ← categorías del índice (qué stems van en cada panel)
scripts/article-thumbnail-icons.mjs ← icono SVG por stem (THUMBNAIL_BY_STEM)
         ↓
build-pathology-pages.mjs  → 26 stems × 4 idiomas = 104 páginas
build-articulos-pages.mjs  → articulos.html × 4 (page-shell completo)
generate-article-thumbnails.mjs → images/articles/{stem}.svg
generate-article-thumbnails.mjs → images/articles/{stem}.svg
         ↓
inject-local-schema.mjs, inject-static-shell.mjs, sitemap, llms (vía npm run build:pathologies)
```

`PATHOLOGY_STEMS` en `pathology-content.mjs` alimenta automáticamente `STEMS` en `i18n-urls.mjs` — **no hace falta** registrar el stem ahí si es patología.

### Modificar copy de una patología existente

1. **`scripts/pathology-content.mjs`** — objeto en `PATHOLOGIES` con `stem: "…"`.
   - Por idioma: `title`, `metaDescription`, `h1`, `lead`, `paragraphs` (exactamente **5**), `complications` (**4–6**), `techniquesNote`.
   - Global: `techniques` (array de stems: `rpg`, `osteopatia`, `atm`, …).
2. **Bump `updatedAt`** en ese objeto (schema `dateModified`).
3. Regenerar:

```bash
npm run build:pathologies
```

Pipeline completo: páginas + thumbnails + índice artículos + nav + schema + shell + assets + sitemap.

**Solo texto de una patología** (sin tocar índice/categorías):

```bash
node scripts/build-pathology-pages.mjs
node scripts/inject-local-schema.mjs
node scripts/inject-static-shell.mjs
npm run assets:build
npm run seo:audit
```

### Modificar solo el índice `articulos.html`

| Qué | Archivo |
|-----|---------|
| Intro, meta del índice, citas | `scripts/articles-index-content.mjs` |
| Categorías y qué artículos listar | `scripts/articles-categories.mjs` |

```bash
npm run build:articulos
# o sync nav si hace falta:
npm run sync:nav-articles
```

### Añadir patología nueva

Checklist en orden:

1. **`pathology-content.mjs`**
   - Añadir slug a `PATHOLOGY_STEMS`.
   - Nuevo objeto en `PATHOLOGIES` (copy **es / en / fr / pt**).
   - Entrada en `PATHOLOGY_RELATED` (3–5 stems relacionados).
2. **`articles-categories.mjs`** — incluir el stem en al menos una categoría.
3. **`article-thumbnail-icons.mjs`** — `THUMBNAIL_BY_STEM[stem]` (tipo de icono).
4. Regenerar todo:

```bash
npm run build:pathologies
npm run seo:audit
```

5. Verificar que `sitemap.xml` y `llms.txt` incluyen la URL (el pipeline de `build:pathologies` corre sitemap; llms si no: `npm run seo:llms`).

### Convenciones patología

- `paragraphs.length === 5` (comentario en cabecera del módulo).
- `complications`: 4–6 ítems.
- `techniques` usa labels de `TECHNIQUE_LABELS` en la página generada.
- Autor schema: `FOUNDER` vía `build-pathology-pages.mjs` (no hardcodear).

---

## Métodos y técnicas

Páginas: `kinesiologia.html`, `rpg.html`, `osteopatia.html`, … (×4 idiomas).

### Mapa

```
scripts/methods-content.mjs     ← METHOD_STEMS + METHODS (copy por idioma)
scripts/schema-local-business.mjs ← COPY[lang].services[stem] (schema MedicalTherapy + catálogo clínica)
scripts/partials-strings.mjs    ← TECHNIQUE_NAV_STEMS (nav/footer «Métodos y Técnicas»)
scripts/i18n-urls.mjs           ← STEMS (métodos listados explícitamente, no vía PATHOLOGY_STEMS)
         ↓
build-method-pages.mjs → METHOD_STEMS × 4 idiomas
         ↓
inject-local-schema.mjs, inject-static-shell.mjs (vía npm run build:methods)
```

Nav/footer solo incluye un subconjunto (`TECHNIQUE_NAV_STEMS`: rpg, osteopatia, cadenas, manipulaciones, neurodinamia, atm). Métodos como `kinesiologia` o `acupuntura` tienen página pero **no** están en ese submenú.

### Modificar copy de un método existente

1. **`scripts/methods-content.mjs`** — entrada en `METHODS[stem]`:
   - `image` (hero, ej. `hero-img.jpg` en `images/`).
   - Por idioma: `metaTitle`, `metaDescription`, `breadcrumb`, `h1`, `lead`, `blocks` (`{ type: "p"|"h2", text }`).
2. Si cambia **nombre/descripción SEO schema**: **`schema-local-business.mjs`** → `COPY[lang].services[stem]`.
3. Regenerar:

```bash
npm run build:methods
npm run seo:audit
```

`build:methods` incluye: páginas + schema local + shell + verify + assets + apply-seo-performance.

### Añadir método nuevo

1. **`methods-content.mjs`** — añadir a `METHOD_STEMS` + objeto completo en `METHODS`.
2. **`i18n-urls.mjs`** — añadir stem a `STEMS` (lista explícita de métodos).
3. **`schema-local-business.mjs`** — `services[stem]` en **es, en, fr, pt** (`name`, `description`).
4. **Opcional nav/footer:** `partials-strings.mjs` → `TECHNIQUE_NAV_STEMS` + labels en `techniques`.
5. Regenerar:

```bash
npm run build:methods
npm run build:partials          # solo si tocaste TECHNIQUE_NAV_STEMS
node scripts/inject-static-shell.mjs
npm run seo:sitemap
npm run seo:llms
npm run seo:audit
```

### Extraer body desde HTML existente (migración puntual)

Si el contenido aún vive en HTML y hay que volcarlo al módulo:

```bash
node scripts/extract-methods-body.mjs   # → methods-content.mjs
npm run build:methods
```

---

## Comparación rápida

| | Patologías / artículos | Métodos |
|--|------------------------|---------|
| **Fuente principal** | `pathology-content.mjs` | `methods-content.mjs` |
| **Índice listado** | `articulos.html` ← `articles-categories.mjs` | — |
| **Stem en i18n** | Auto (`PATHOLOGY_STEMS`) | Manual en `i18n-urls.mjs` → `STEMS` |
| **Schema página** | `Article` (build-pathology-pages) | `MedicalTherapy` (build-method-pages + schema-local-business) |
| **Comando build** | `npm run build:pathologies` | `npm run build:methods` |
| **Verificación** | `verify-pathology-pages.mjs` (en pipeline) | `verify-method-pages.mjs` (en pipeline) |

---

## QA

```bash
npm run seo:audit
node scripts/verify-pathology-pages.mjs   # tras cambios patologías
node scripts/verify-method-pages.mjs      # tras cambios métodos
```

## Anti-patrones

- Editar `cefalea.html` / `rpg.html` a mano en raíz o `/en/`.
- Olvidar **pt** al añadir patología o método.
- Nueva patología sin categoría en `articles-categories.mjs` (no aparece en índice).
- Nuevo método sin entrada en `schema-local-business.mjs` (schema MedicalTherapy incompleto).
- Usar `patch:methods-seo` — **deprecated**; usar `build:methods`.

## Ver también

- [data-sources.md](data-sources.md) — contacto, URLs, pipelines globales
- [README.md](../README.md) — scripts npm y primeros pasos
