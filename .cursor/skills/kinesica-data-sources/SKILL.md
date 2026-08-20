---
name: kinesica-data-sources
description: >-
  Kinésica static site data sources and build pipelines. Use when changing
  contact/phone/WhatsApp/hours, adding or editing pathology articles
  (articulos, gonalgia, cervicalgia), method pages (RPG, osteopatia,
  kinesiologia), hunting duplicated data, or deciding which npm build to run.
---

# Kinésica — fuentes de verdad

## Antes de investigar

1. **Contacto** → [docs/data-sources.md](../../docs/data-sources.md)
2. **Artículos / patologías** → [docs/articles-and-methods.md](../../docs/articles-and-methods.md#artículos--patologías)
3. **Métodos** → [docs/articles-and-methods.md](../../docs/articles-and-methods.md#métodos-y-técnicas)
4. No greppear HTML masivo — editar `scripts/*-content.mjs` y regenerar.

## Artículos (patologías)

| Tarea | Editar | Regenerar |
|-------|--------|-----------|
| Copy de una patología | `pathology-content.mjs` (+ bump `updatedAt`) | `npm run build:pathologies` |
| Índice / categorías articulos | `articles-index-content.mjs`, `articles-categories.mjs` | `npm run build:articulos` |
| FAQ del home | `faq-content.mjs` | `npm run build:home` |
| **Nueva** patología | `PATHOLOGY_STEMS`, `PATHOLOGIES`, `PATHOLOGY_RELATED`, `articles-categories.mjs`, `article-thumbnail-icons.mjs` | `npm run build:pathologies` |

Fuente única: **`scripts/pathology-content.mjs`**. Stems → `i18n-urls.mjs` automático.

## Métodos

| Tarea | Editar | Regenerar |
|-------|--------|-----------|
| Copy de un método | `methods-content.mjs` | `npm run build:methods` |
| Schema MedicalTherapy | `schema-local-business.mjs` → `COPY[lang].services[stem]` | `npm run build:methods` |
| Nav «Métodos y Técnicas» | `partials-strings.mjs` → `TECHNIQUE_NAV_STEMS` | `build:methods` + `build:partials` |
| **Nuevo** método | + `METHOD_STEMS`, `METHODS`, `i18n-urls.mjs` → `STEMS`, schema services ×4 langs | `build:methods` (+ `build:partials` si nav) |

Fuente única: **`scripts/methods-content.mjs`**.

## Contacto

| Tarea | Editar | Regenerar |
|-------|--------|-----------|
| Teléfono / email / dirección | `site-contact.mjs` | `build:partials` → `inject-local-schema` → `schema:partials` → `seo:llms` → `assets:build` |
| Horario (header + schema + llms) | `site-contact.mjs` → `OPENING_HOURS` | `build:partials` → `inject-static-shell` → `inject-local-schema` → `schema:partials` → `seo:llms` → `assets:build` |
| Redes sociales | `site-contact.mjs` → `SOCIALS` | `build:partials` → `assets:build` |

## QA obligatorio

```bash
npm run seo:audit
npm run seo:dry            # DRY: contacto, FAQ, URLs, builders
npm run assets:build       # si tocó js/, partials/ o css/ fuente
```

Cierre completo: `npm run verify` (incluye dry + seo:audit; CI en cada push/PR).

## Árbol de decisión

```
¿Patología / artículo / articulos.html?
  → pathology-content.mjs (+ articles-* si índice)
  → npm run build:pathologies

¿Método (RPG, osteopatía, ATM, …)?
  → methods-content.mjs (+ schema-local-business si schema)
  → npm run build:methods

¿Contacto / Google / horarios schema?
  → site-contact.mjs / google-place.mjs

¿Header, footer, CTA, nav global?
  → partials-strings.mjs → build:partials

¿Home (hero, mapa, reseñas)?
  → home-content.mjs → build:home

¿FAQ del home (preguntas, indumentaria, ejemplos)?
  → faq-content.mjs → build:home

¿URL del sitio?
  → i18n-urls.mjs
```

Detalle: [docs/data-sources.md](../../docs/data-sources.md) · [docs/articles-and-methods.md](../../docs/articles-and-methods.md)
