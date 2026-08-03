# Fuentes de verdad — Kinésica

Guía para cambiar datos del sitio sin duplicar ni romper generadores. Leer esto **antes** de buscar teléfonos, horarios o URLs en HTML.

**Artículos (patologías) y métodos:** guía dedicada → [articles-and-methods.md](articles-and-methods.md).

## Mapa rápido

```
scripts/site-contact.mjs     ← teléfono, email, dirección, geo, horarios (schema), founder, redes
scripts/google-place.mjs     ← Place ID, link Maps, URLs de reseñas Google
scripts/i18n-urls.mjs        ← dominio SITE, URLs absolutas, stems, paths por idioma
scripts/partials-strings.mjs ← copy CTA/footer/nav (×4 idiomas); horario UI derivado de site-contact
scripts/schema-local-business.mjs ← JSON-LD clínica/FAQ (importa site-contact; no hardcodear contacto)
         ↓ generadores
HTML / partials / js/site-config.js (AUTO-GENERADOS — no editar a mano)
```

## Contacto y clínica

### `scripts/site-contact.mjs`

| Campo | Uso |
|-------|-----|
| `CONTACT.whatsappDigits` | WhatsApp (`wa.me`), `tel:`, runtime (`KINESICA_SITE`) |
| `CONTACT.phoneDisplay` | UI: footer, CV, textos visibles |
| `CONTACT.phoneSchema` | JSON-LD (`telephone` en schema.org) |
| `CONTACT.email` | mailto, schema, CV |
| `CONTACT.address` | Footer, schema (`streetAddress`, `shortLine`, …) |
| `CONTACT.geo` | Schema `GeoCoordinates` |
| `CONTACT.mapsUrl` | Enlace Maps (reexporta `google-place.mjs`) |
| `FOUNDER.name` / `shortName` | Schema, artículos, CV, llms.txt |
| `OPENING_HOURS` | Fuente única de horario (`opens`/`closes`) → schema, `llms.txt`, header UI |
| `SOCIALS` + `SOCIALS.handles` | URLs e handles en footer |
| `waMeUrl()`, `telUrl()`, `mailtoUrl()` | Helpers para generadores |
| `postalAddressSchema()`, `openingHoursSpecification()`, `geoCoordinatesSchema()` | Bloques schema reutilizables |

### `scripts/google-place.mjs`

| Campo | Uso |
|-------|-----|
| `GOOGLE_PLACE_ID` | Reseñas API, `js/site-config.js` |
| `GOOGLE_MAPS_URL` | Footer, schema `hasMap`, `sameAs` |
| `googleReviewWriteUrl()` / `googleReviewsListUrl()` | Home, reviews |

### `scripts/google-reviews-overrides.mjs`

Curación manual cuando Places API no trae reseñas nuevas de Maps: `EXCLUDE_AUTHORS` + `SUPPLEMENT_REVIEWS`. Luego `npm run reviews:refresh`.

### Reseñas en el home (cron diario)

Las cards del index leen `partials/google-reviews-data.js` (bundle `js/reviews.min.js`).

| Comando | Uso |
|---------|-----|
| `npm run reviews:fetch` | Siempre reescribe el partial |
| `npm run reviews:sync` | Chequea count → fetch → actualiza partial + bundle **solo si** cambió rating/count/reseñas mostradas |
| `npm run reviews:refresh` | Fetch forzoso + `assets:build` completo |

CI: `.github/workflows/reviews-daily.yml` corre `reviews:sync` **dos veces al día** (`0 12 * * *` y `0 21 * * *` UTC) + `workflow_dispatch`. Si hay cambios: commit en `main`, bump de `?v=` en las 4 homes, y deploy FTP a Hostinger (si hay secrets).

Secrets de repo:

| Secret | Uso |
|--------|-----|
| `GOOGLE_PLACES_SERVER_KEY` | Places API (recomendado; si falta, cae al key de `site-config.js`) |
| `HOSTINGER_FTP_HOST` | Host FTP (sin `ftp://`) |
| `HOSTINGER_FTP_USER` | Usuario FTP |
| `HOSTINGER_FTP_PASSWORD` | Contraseña FTP |
| `HOSTINGER_FTP_REMOTE_DIR` | Opcional. Raíz del sitio en el servidor (p. ej. `public_html`). Default: `.` |
| `HOSTINGER_FTP_SECURE` | Opcional. `true` para FTPS explícito |

Sin los secrets FTP, el Action igual commitea en GitHub y deja un notice: el sitio público no se actualiza hasta el próximo deploy manual.

**Excepción:** el iframe del mapa en home usa `MAP_EMBED_BASE` en `scripts/home-content.mjs` (encuadre distinto al pin de schema).

## Copy de UI vs datos estructurados

| Qué cambiar | Dónde editar |
|-------------|--------------|
| Horario (header, schema, llms) | Solo `scripts/site-contact.mjs` → `OPENING_HOURS.opens` / `.closes` |
| Texto CTA strip («Contáctanos y reserva…») | `scripts/partials-strings.mjs` → `ctaTitle`, `ctaText`, `ctaButton` |
| Teléfono / email / dirección | Solo `site-contact.mjs` |

## Qué regenerar según el cambio

| Cambiaste | Comandos (en orden) |
|-----------|---------------------|
| Teléfono, email, dirección, founder, horario, redes | `npm run build:partials` → `node scripts/inject-static-shell.mjs` → `node scripts/inject-local-schema.mjs` → `npm run schema:partials` → `npm run seo:llms` → `npm run assets:build` |
| Home (hero, mapa, botones WA) | Editar `scripts/home-content.mjs` → `npm run build:home` |
| CV | Editar `scripts/cv-content.mjs` → `npm run build:cv` |
| Patologías (autor = founder) | `npm run build:pathologies` (rebuild incluye schema) |
| Google Place ID / Maps link | `google-place.mjs` → `npm run assets:build` → `node scripts/inject-local-schema.mjs` → `npm run reviews:fetch` (si aplica) |

**Siempre al cerrar:**

```bash
npm run seo:audit
```

## Consumidores (importan `site-contact`)

| Generador | Qué toma |
|-----------|----------|
| `build-partials.mjs` | Footer, CTA, WhatsApp float |
| `schema-local-business.mjs` | JSON-LD clínica |
| `build-site-config-js.mjs` | `js/site-config.js` (browser) |
| `build-cv-html.mjs` | Email, teléfono, founder |
| `build-pathology-pages.mjs` | Autor artículos |
| `home-content.mjs` | `waMeUrl()` en botones hero |
| `generate-llms-txt.mjs` | Contacto en intro |
| `inject-local-schema.mjs` | Inyecta schema en ~170 HTML |

## Runtime en el browser

| Archivo | Rol |
|---------|-----|
| `js/site-config.js` | AUTO-GENERADO desde `site-contact` + `google-place`. No editar. |
| `js/whatsapp-logic.js` | Lee `KINESICA_SITE.contact`; enlaces `.dynamic-whatsapp-url` |
| `partials/footer-*.js` | Generados; teléfono con clase `dynamic-whatsapp-text` |

Los bundles shell (`js/shell-footer-*.min.js`) incluyen `site-config` + footer.

## Anti-patrones

- **No** hardcodear `5491161564311`, `Charcas 3889` ni `norberto1712@gmail.com` en `scripts/*.mjs` (salvo `site-contact.mjs`). `npm run seo:audit` lo detecta.
- **No** editar HTML de contacto a mano en decenas de páginas — usar generadores.
- **No** editar `js/site-config.js` ni `partials/*.min.js` — regenerar con `assets:build` / `build:partials`.
- **No** usar `npm run seo:og` para schema — solo limpia OG; schema = `node scripts/inject-local-schema.mjs`.

## Investigar duplicación

```bash
# Teléfono / email / dirección fuera de fuente autorizada
rg '5491161564311|Charcas 3889|norberto1712' scripts/ --glob '*.mjs'

# Consumidores de site-contact
rg 'site-contact' scripts/ --glob '*.mjs'
```

## Otras fuentes de verdad (contenido)

| Tema | Guía |
|------|------|
| Patologías / artículos | [articles-and-methods.md](articles-and-methods.md#artículos--patologías) |
| Métodos (RPG, osteopatía, …) | [articles-and-methods.md](articles-and-methods.md#métodos-y-técnicas) |
| Contacto, horarios, teléfono | Este doc + `site-contact.mjs` |

Ver también [README.md](../README.md#fuentes-de-verdad): `pathology-content.mjs`, `methods-content.mjs`, `cv-content.mjs`, `partials-strings.mjs`, `i18n-urls.mjs`, `page-shell.mjs`.
