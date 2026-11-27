# Reglas del Proyecto (Kinésica Web & Admin)

## Límite de Tamaño de Archivos JavaScript / TypeScript
- **Regla estricta:** Ningún archivo de JavaScript (`.js`, `.mjs`, `.cjs`) o TypeScript (`.ts`) debe superar las **250 líneas de código**.
- **Modularización obligatoria:** Separar componentes, vistas, helpers y clientes API en submódulos independientes en `booking/`, `admin/modules/`, o `partials/` según corresponda.
- **Prohibición de archivos monolíticos:** Si una funcionalidad nueva requiere lógica adicional, crear un nuevo módulo específico en lugar de agrandar módulos existentes cercanos al límite.
