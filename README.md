# Especificaciones Técnicas - Constancia (PWA Offline)

Aplicación PWA offline con las especificaciones técnicas del proyecto Constancia.
Funciona sin conexión una vez cargada la primera vez.

## Estructura
- `index.html` — Estructura principal
- `app.js` — Lógica de UI
- `app-core.js` — Procesamiento de datos (puerto de Code.gs)
- `data.js` — Datos embebidos (extraídos de Poblardatos.gs)
- `sw.js` — Service Worker (offline)
- `manifest.json` — Configuración PWA

## Actualizar datos
1. Corre `poblarTodo()` en Apps Script
2. Copia los arrays `DATA_*` actualizados a `data.js`
3. Cambia `CACHE_VERSION` en `sw.js` (ej: `v1.0.1`)
4. Commit y push
