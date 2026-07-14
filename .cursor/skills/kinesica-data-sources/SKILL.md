---
name: kinesica-data-sources
description: >-
  Kinésica static site data sources, contact unification, and generator
  pipelines. Use when changing phone, WhatsApp, email, address, hours, social
  links, founder name, Google Maps/Place ID, hunting duplicated contact data,
  or deciding which npm build to run after editing scripts/*.mjs.
---

# Kinésica — fuentes de verdad y contacto

## Antes de investigar

1. Leer [docs/data-sources.md](../../docs/data-sources.md) (mapa completo).
2. Asumir que contacto vive en **`scripts/site-contact.mjs`** + **`scripts/google-place.mjs`**.
3. No greppear 170 HTML — buscar en `scripts/` y regenerar.

## Cambios frecuentes

| Tarea | Editar | Regenerar |
|-------|--------|-----------|
| Teléfono / email / dirección | `site-contact.mjs` | `build:partials` → `seo:schema` → `schema:partials` → `seo:llms` → `assets:build` |
| Horario header (texto UI) | `partials-strings.mjs` → `schedule` | `build:partials` → `inject-static-shell` → `assets:build` |
| Horario schema / llms | `site-contact.mjs` → `OPENING_HOURS` | + `seo:schema`, `seo:llms` |
| Redes sociales | `site-contact.mjs` → `SOCIALS` + `handles` | `build:partials` → `assets:build` |
| Founder / autor artículos | `site-contact.mjs` → `FOUNDER` | `build:cv`, `build:pathologies`, `seo:schema`, `seo:llms` |
| Google Place / Maps | `google-place.mjs` | `assets:build`, `seo:schema`, `reviews:fetch` si aplica |
| Botón WhatsApp home | `home-content.mjs` (usar `waMeUrl()`) | `build:home` |

## Imports en generadores

```js
import { CONTACT, FOUNDER, OPENING_HOURS, SOCIALS, waMeUrl } from "./site-contact.mjs";
import { GOOGLE_PLACE_ID, GOOGLE_MAPS_URL } from "./google-place.mjs";
```

Schema helpers: `postalAddressSchema()`, `openingHoursSpecification()`, `geoCoordinatesSchema()`.

## QA obligatorio

```bash
npm run seo:audit   # incluye check anti-hardcode en scripts/
npm run assets:build  # si tocó js/, partials/ o css/ fuente
```

## Anti-patrones

- Hardcodear contacto en `scripts/*.mjs` → importar desde `site-contact.mjs`.
- Editar `js/site-config.js`, `*.min.js` o HTML masivo a mano.
- Duplicar horarios: UI en `partials-strings.mjs`, estructura en `OPENING_HOURS`.
- Usar `seo:og` para schema (solo limpia OG; schema = `seo:schema`).

## Árbol de decisión

```
¿Es dato de contacto/clínica/Google?
  → site-contact.mjs / google-place.mjs

¿Es copy visible por idioma (header, CTA, nav)?
  → partials-strings.mjs (+ build:partials)

¿Es contenido de página (patología, método, CV, home)?
  → *-content.mjs correspondiente + build:* del README

¿Es URL del sitio?
  → i18n-urls.mjs (STEMS, absoluteUrl)
```

Detalle de módulos y matrices: [docs/data-sources.md](../../docs/data-sources.md).
