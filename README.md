# Kinésica

Sitio estático multilingüe del centro de kinesiología, osteopatía y terapias manuales en Palermo (Buenos Aires). Orientado a conversión (WhatsApp, turnos) y SEO local.

**Producción:** [kinesica.com.ar](https://www.kinesica.com.ar)

## Stack

- HTML estático + CSS + JavaScript vanilla (sin frameworks en el front)
- Generadores en Node (`scripts/*.mjs`) — sin bundler pesado
- Minificación de assets propios con esbuild (`npm run assets:build`)
- Despliegue en hosting estático (Hostinger); en el servidor no hace falta Node

## Idiomas y URLs

| Código | Carpeta   | URL de ejemplo                          |
|--------|-----------|-----------------------------------------|
| `es`   | `/`       | `https://www.kinesica.com.ar/gonalgia.html` |
| `en`   | `/en/`    | `https://www.kinesica.com.ar/en/gonalgia.html` |
| `fr`   | `/fr/`    | `https://www.kinesica.com.ar/fr/gonalgia.html` |
| `pt`   | `/pt/`    | `https://www.kinesica.com.ar/pt/gonalgia.html` |

Toda página pública existe en los cuatro idiomas. Los helpers de URL viven en `scripts/i18n-urls.mjs`; el registro de idiomas en `scripts/languages.mjs`.

## Estructura del repo

```
kinesica/
├── index.html, *.html          # Páginas ES (raíz)
├── en/, fr/, pt/               # Mismas páginas por idioma
├── css/                        # Estilos (editar fuentes, no .min)
├── js/                         # Scripts del sitio
├── partials/                   # Fragmentos HTML (header, nav, footer…)
├── images/                     # Imágenes y SVG de artículos
├── scripts/                    # Datos, builders y tooling SEO
│   ├── pathology-content.mjs   # Copy de patologías (ES/EN/FR)
│   ├── i18n-urls.mjs           # URLs, stems, paths por idioma
│   ├── page-shell.mjs          # Shell de página (head, header, SEO)
│   ├── html-utils.mjs          # Escape HTML, hreflang, meta, schema
│   └── build-*.mjs             # Generadores de HTML
├── sitemap.xml                 # Generado
├── llms.txt                    # Resumen para LLMs (generado)
└── package.json                # Scripts npm
```

## Arquitectura: datos → builders → HTML

```
Fuente de datos (.mjs)  →  Builder (scripts/)  →  HTML estático
                                    ↓
                         inject-static-shell.mjs
                         apply-seo-performance.mjs
                         minify-assets.mjs
```

**Principio DRY:** el contenido repetible va en módulos de datos; las páginas se generan, no se copian a mano entre idiomas. El shell compartido (head, header, footer, CTA) se inyecta vía partials y `page-shell.mjs`.

### Fuentes de verdad

| Módulo | Uso |
|--------|-----|
| `scripts/languages.mjs` | Idiomas publicados, `listHtmlFiles`, locale OG |
| `scripts/i18n-urls.mjs` | `absoluteUrl`, `sitePath`, `repoPath`, `stemFromFile`, stems |
| `scripts/page-shell.mjs` | CSS/JS del shell, `headSeoBlock`, `pageHeaderSection`, CTA |
| `scripts/html-utils.mjs` | `escHtml`, `hreflangLinks`, `patchPageMeta`, breadcrumb schema |
| `scripts/header-shell.mjs` | Header estático, lang picker |
| `scripts/pathology-content.mjs` | Copy de patologías ES/EN/FR |
| `scripts/articles-index-content.mjs` | Copy del índice `articulos.html` |
| `scripts/methods-content.mjs` | Meta y breadcrumb de métodos (RPG, osteopatía, etc.) |
| `scripts/cv-content.mjs` | Copy del CV |
| `scripts/partials-strings.mjs` | Textos de header/nav/footer por idioma |
| `scripts/schema-local-business.mjs` | JSON-LD clínica / FAQ |
| `scripts/site-contact.mjs` | Contacto, horarios schema, founder, redes |
| `scripts/google-place.mjs` | Google Place ID, Maps, reseñas |

## Primeros pasos

```bash
git clone <repo>
cd kinesica
npm install
```

Antes de cerrar un cambio:

```bash
npm run seo:audit          # obligatorio: links, hreflang, estructura
npm run assets:build       # si tocaste css/, js/ o partials/ fuente
```

## Tareas frecuentes

### Editar CSS o JS

Editar siempre fuentes **sin** `.min` (`css/style.css`, `js/*.js`, `partials/*.js`). Ver [ASSETS.md](ASSETS.md).

```bash
npm run assets:build
```

### Nueva patología

Ver checklist completo en [docs/articles-and-methods.md](docs/articles-and-methods.md#añadir-patología-nueva). Resumen:

1. `scripts/pathology-content.mjs` — stem, copy ES/EN/FR/PT, `PATHOLOGY_RELATED`.
2. `scripts/articles-categories.mjs` — categoría del índice.
3. `scripts/article-thumbnail-icons.mjs` — icono del stem.
4. `npm run build:pathologies`

### Actualizar índice de artículos

Editar `scripts/articles-index-content.mjs` y/o `scripts/articles-categories.mjs`, luego:

```bash
npm run build:articulos
```

### Métodos (RPG, osteopatía, ATM, …)

Copy en **`scripts/methods-content.mjs`** → `npm run build:methods`.  
Detalle y métodos nuevos: [docs/articles-and-methods.md](docs/articles-and-methods.md#métodos-y-técnicas).

### Actualizar CV

Editar `scripts/cv-content.mjs` (y `cv-content-pt.mjs` para portugués):

```bash
node scripts/build-cv-html.mjs
node scripts/inject-static-shell.mjs
npm run assets:build
```

### Cambiar teléfono, email, dirección u horarios

1. Datos estructurados: `scripts/site-contact.mjs` (y `scripts/google-place.mjs` si cambia Google).
2. Horario legible en header: `scripts/partials-strings.mjs` → `schedule`.
3. Regenerar según [docs/data-sources.md](docs/data-sources.md#qué-regenerar-según-el-cambio).
4. `npm run seo:audit`.

### Cambiar header, nav o footer

1. Textos en `scripts/partials-strings.mjs`.
2. Regenerar partials y shell:

```bash
npm run build:partials
node scripts/inject-static-shell.mjs
npm run assets:build
```

### SEO global (meta, schema, sitemap)

```bash
npm run seo:lang      # hreflang, content-language, og:locale
npm run seo:schema    # JSON-LD fisioterapia en todas las páginas
npm run seo:sitemap   # sitemap.xml
npm run seo:llms      # llms.txt
npm run seo:apply     # assets + apply-seo-performance (critical CSS, etc.)
npm run seo:audit     # auditoría final
```

## Scripts npm (referencia)

| Comando | Descripción |
|---------|-------------|
| `npm run assets:build` | Minifica CSS/JS propios y sincroniza refs `.min` en HTML |
| `npm run seo:audit` | Auditoría de links, hreflang, lang picker, estructura |
| `npm run build:pathologies` | Pipeline completo de patologías |
| `npm run build:articulos` | Índice artículos + nav + shell |
| `npm run patch:methods-seo` | Meta, breadcrumb y schema MedicalTherapy en páginas de métodos |
| `npm run build:partials` | Genera `partials/header-*`, `nav-*`, `footer-*`… |
| `npm run build:seo` | Schema + partials schema + llms + minify |
| `npm run build:pt` | Pipeline completo de contenido portugués |
| `npm run verify` | Verificaciones PT, schema e i18n |
| `npm run reviews:sync` | Cron/CI: fetch Google reviews y actualiza el home solo si cambió el contenido mostrado |
| `npm run reviews:fetch` | Reescribe `partials/google-reviews-data.js` (siempre) |
| `npm run reviews:refresh` | Fetch + `assets:build` completo |

Scripts `migrate:*` en `package.json` son utilidades puntuales de migración; no forman parte del flujo habitual.

## Despliegue

Subir al hosting:

- HTML actualizado
- Fuentes y `.min` de CSS/JS propios
- Imágenes nuevas o modificadas
- `sitemap.xml`, `robots.txt`, `.htaccess`

No hace falta ejecutar Node en el servidor. Tras cambios de estilo, asegurate de subir los `.min` regenerados.

## Convenciones para contribuir

- **Una sola `<h1>`** por página; jerarquía semántica (`main`, `section`, `nav`).
- **Canonical = og:url**; hreflang absolutos desde `absoluteUrl()`.
- **No hardcodear URLs** del sitio fuera de `i18n-urls.mjs`.
- **No editar `*.min.*`** ni decenas de HTML a mano si existe un builder.
- **Scripts con `defer`**; CSS crítico solo vía pipeline SEO.

Reglas detalladas para desarrollo con Cursor: `.cursorrules` y `.cursor/rules/`.

## Documentación relacionada

| Archivo | Contenido |
|---------|-----------|
| [docs/data-sources.md](docs/data-sources.md) | Contacto, fuentes de verdad, pipelines de regeneración |
| [docs/articles-and-methods.md](docs/articles-and-methods.md) | Patologías, índice articulos, métodos — dónde editar y qué build correr |
| [ASSETS.md](ASSETS.md) | Pipeline CSS/JS, caché, despliegue de assets |
| [.cursorrules](.cursorrules) | Resumen de principios y fuentes de verdad |
| `.cursor/rules/*.mdc` | Roles arquitecto, developer y QA |
| `llms.txt` | Resumen público del sitio (generado) |
