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

1. Añadir entrada en `scripts/pathology-content.mjs` (objeto por idioma: `es`, `en`, `fr`; PT si aplica en `pathology-content-pt.mjs`).
2. El stem queda registrado vía `PATHOLOGY_STEMS` en el mismo módulo.
3. Regenerar:

```bash
npm run build:pathologies
```

Eso genera las 104 páginas (26 stems × 4 idiomas), thumbnails, índice de artículos, schema, shell y minifica assets.

### Actualizar índice de artículos

Editar `scripts/articles-index-content.mjs` y/o thumbnails en `scripts/article-thumbnail-icons.mjs`, luego:

```bash
npm run build:articulos
```

### Actualizar CV

Editar `scripts/cv-content.mjs` (y `cv-content-pt.mjs` para portugués):

```bash
node scripts/build-cv-html.mjs
node scripts/inject-static-shell.mjs
npm run assets:build
```

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
| [ASSETS.md](ASSETS.md) | Pipeline CSS/JS, caché, despliegue de assets |
| [.cursorrules](.cursorrules) | Resumen de principios y fuentes de verdad |
| `.cursor/rules/*.mdc` | Roles arquitecto, developer y QA |
| `llms.txt` | Resumen público del sitio (generado) |
