# CSS y JS — fuentes y producción

## Qué editar

Siempre los archivos **sin** `.min`:

| Tipo | Ejemplos |
|------|----------|
| CSS propio | `css/style.css`, `css/whatsapp.css`, `css/cv.css` |
| JS propio | `js/*.js`, `partials/*.js` |

No edites `*.min.css` ni `*.min.js`: se regeneran con el build.

Los vendor (`bootstrap.min.css`, `jquery.min.js`, `font-awesome.min.css`) no entran en el pipeline.

## Build

```bash
cd kinesica
npm install          # una vez
npm run assets:build # después de cada cambio en CSS/JS fuente
```

El script:

1. Minifica fuentes → `css/style.min.css`, `js/nav-include.min.js`, etc.
2. Actualiza el HTML para cargar las versiones `.min`.

## Despliegue (Hostinger)

Subí fuentes **y** `.min` **y** el HTML actualizado. En el servidor no hace falta Node.

## Otros scripts

- `npm run seo:schema` — JSON-LD fisioterapia / SEO local en HTML.
- `npm run seo:lang` — meta `content-language`, hreflang y `og:locale` por idioma.
- `npm run build:seo` — schema + partials + minify.
- `npm run seo:apply` — meta/performance en HTML (no minifica).
- `node scripts/build-cv-html.mjs` — regenera CV; ya apunta a `.min`.
- Datos schema: `scripts/schema-local-business.mjs`
- Lista de assets: `assets.config.cjs`
