# Auditoría y purge de CSS (PurgeCSS)

Herramienta para detectar y eliminar reglas no usadas del template original (Bootstrap, Font Awesome, `style.css`).

## Requisitos

- Node.js 18+

## Comandos

Desde `kinesica/`:

```bash
npm install
npm run css:audit      # informe en consola + scripts/reports/css-purge-audit.json
npm run css:build      # genera css/dist/ (no modifica css/ de producción)
npm run css:build:cv   # perfil CV → css/dist-cv/
```

## Flujo recomendado (PR aparte)

1. Ejecutar `npm run css:audit` y revisar el porcentaje por archivo.
2. Generar `npm run css:build` y probar el sitio apuntando temporalmente a `css/dist/*.css` en local.
3. Si todo se ve bien, sustituir los originales o cambiar los `<link>` en HTML.
4. No commitear `node_modules/` ni `css/dist/` (están en `.gitignore`).

## Safelist

Clases añadidas por JS (`mobile-nav.js`, `sticky-header.js`, `ui-reveal.js`, FAQ, etc.) y prefijos de grid Bootstrap (`col-*`, `panel-*`, `fa-*`) están en `purgecss.config.cjs`.

Si falta estilo tras el purge, añadir la clase a `dynamicSafelist` o a `greedy` y volver a ejecutar.

## Archivos

| Archivo | Rol |
|---------|-----|
| `purgecss.config.cjs` | Contenido escaneado, CSS de entrada, safelist |
| `scripts/purge-css.mjs` | CLI audit / build |
| `scripts/reports/css-purge-audit.json` | Resultado machine-readable |
