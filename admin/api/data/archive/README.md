# Archivo de snapshots JSON (etapa 10)

Tras el cutover relacional, MariaDB es la fuente de verdad de:

- settings operativos → tabla `configuraciones`
- gastos → tabla `gastos`
- encuestas → tabla `encuestas`

Los seeds en `admin/api/*.json` y el runtime en `admin/api/data/*.json` quedan como:

1. **Fallback** si la tabla está vacía (pre-migrate / restore parcial)
2. **Exportación** regenerable en cada save (dual-write)

## Uso

Copiá aquí snapshots con timestamp antes de un deploy sensible:

```bash
mkdir -p admin/api/data/archive
ts=$(date -u +%Y%m%dT%H%M%SZ)
cp -n admin/api/data/settings.json "admin/api/data/archive/settings-$ts.json" 2>/dev/null || true
cp -n admin/api/data/gastos.json "admin/api/data/archive/gastos-$ts.json" 2>/dev/null || true
cp -n admin/api/data/encuestas.json "admin/api/data/archive/encuestas-$ts.json" 2>/dev/null || true
```

O CLI: `php admin/api/export_json_snapshots.php --token=TOKEN`

**No** borres los seeds del repo (`admin/api/settings.json`, etc.): sirven para entornos nuevos.
`errores.json` permanece en JSON (diferido del plan).
