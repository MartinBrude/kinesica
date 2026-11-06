# AGENTS.md

Reglas de desarrollo detalladas en `.cursorrules` y `.cursor/rules/*.mdc`. Contexto del stack, arquitectura y pipelines en `README.md`, `ASSETS.md` y `docs/`.

## Cursor Cloud specific instructions

Sitio **estático** multilingüe (ES raíz, `/en/`, `/fr/`, `/pt/`). No hay backend ni dev server propio: el "correr la app" es servir los HTML generados con cualquier servidor estático.

- Lint/tests/auditoría: `npm run verify` (es lo que corre CI en `.github/workflows/verify.yml`). Cubre i18n, copy PT, schema, páginas de patologías/home y `audit-site`. Debe terminar con `verify-all OK` y `ERRORS (0)`.
- Build de assets: `npm run assets:build` minifica CSS/JS y **reescribe los `?v=` (cache-busting) en los 169 HTML**. Ese diff masivo de solo timestamps es esperado; revertilo (`git checkout -- .`) si solo estabas verificando y no querés ensuciar el árbol.
- Servir localmente para inspección visual: `python3 -m http.server 8000` desde la raíz del repo, luego `http://localhost:8000/index.html` (EN/FR/PT en `/en/`, `/fr/`, `/pt/`). El routing "bonito" real depende de `.htaccess` (Apache en prod); con `http.server` usá las rutas `.html` explícitas.
- Google Reviews (`npm run reviews:*`) requiere `GOOGLE_PLACES_SERVER_KEY` (y la browser key en `js/site-secrets.js`); no es necesario para verificar/servir el sitio.
