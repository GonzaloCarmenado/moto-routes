## Context

Ver `proposal.md` (Why) para la motivación. Este design cubre solo los puntos donde hacía falta una decisión técnica real, no los puramente mecánicos (mover un fichero, sustituir un valor por un token) que van directos a `tasks.md`.

## Goals / Non-Goals

**Goals:**
- Resolver con una decisión explícita cada ambigüedad real encontrada durante la auditoría (NDK API level, futuro de `memory/sessions/`, supuesto solape de capabilities), no dejarlas como limpieza superficial.
- Que cada cambio de fichero sea reversible y verificable por separado (tests existentes en verde, sin cambio de comportamiento).

**Non-Goals:**
- No se añade ninguna capability nueva ni se modifica ninguna existente (`skip_specs: true`).
- No se toca `apps/api` en ningún punto de este cambio.
- No se resuelve aquí el resto de deuda técnica ya conocida y fuera de alcance explícito (ABI splitting, firma de release real, `maplibre-gl` lazy-load) — quedan donde ya están documentados (ADR-047, `memory/context.md`).

## Decisions

### D1: NDK API level — unificar a 24, un solo fichero en `apps/mobile/src-tauri/.cargo/config.toml`
Investigado durante `propose`: `tauri.conf.json` declara `minSdkVersion: 24`; el fichero de la raíz define los 4 targets a API 24; el de `src-tauri` sobreescribe solo `aarch64` a API 34, sin justificación documentada. Confirmado con el usuario: 34 no es intencional, se unifica todo a 24.
**Decisión final**: un único `.cargo/config.toml` con los 4 targets (`aarch64`, `armv7`, `i686`, `x86_64`) a `android24-clang.cmd`, en `apps/mobile/src-tauri/.cargo/config.toml` (más cercano al directorio real de compilación — Cargo resuelve config subiendo desde el CWD, y este es el que ya está documentado en `openspec/specs/ci-cd/spec.md` como "el que sigue haciendo falta tal cual en local"). Se borra `.cargo/config.toml` de la raíz.
**Riesgo real que motivó investigar en vez de solo "quedarse con uno"**: si el 34 hubiera sido intencional (p.ej. alguna API de Android 34 usada en el puente Kotlin/JNI), borrarlo a ciegas habría introducido una regresión real de compatibilidad. Confirmado que no es el caso.

### D2: `memory/sessions/` — legacy, no se borra, se documenta como tal
Un único fichero (`2026-07-26-mejoras-fotos-mapa.md`) frente a 19 cambios ya archivados en `openspec/changes/archive/` desde entonces — el mecanismo quedó reemplazado en la práctica por el resumen de sesión inline en `memory/context.md` § "Estado Actual del Proyecto", sin que nadie lo decidiera explícitamente. Se documenta este estado en `memory/context.md` (una línea, junto a la mención ya existente de `memory/sessions/`) en vez de borrar el fichero histórico — no aporta nada eliminarlo, y sirve como referencia de cómo se hacía antes.
**Alternativa descartada**: seguir usando `memory/sessions/` para sesiones "especialmente largas" — descartada, no hay ningún criterio objetivo para decidir cuándo una sesión califica, y `context.md` ya demuestra que puede llevar sesiones largas (ver las entradas de `optimizar-bundle-produccion` o `rutas-en-la-nube`) sin necesitar un fichero aparte.

### D3: Solape de capabilities en `openspec/specs/` — cerrado, sin acción
Investigado durante `propose`, leyendo el `## Purpose` de las 4 specs:
- `api-security` (postura de seguridad de `apps/api`, backend: secretos, dependencias) vs `security-audit` (postura de seguridad de `apps/mobile`/Tauri, frontend: CSP, permisos, inputs de comandos Rust) — dominios distintos (backend vs frontend), sin solape.
- `stop-types-catalog` (el catálogo de datos en sí, servido por `apps/api` y cacheado local) vs `route-stop-types-display` (cómo se visualiza el tipo de una parada ya asignada en el detalle de una ruta) — capas distintas (datos vs presentación), sin solape.
No se propone ninguna consolidación ni renombrado. Sin tarea asociada más allá de dejar esta decisión documentada aquí (cierra la duda para cualquier sesión futura que se lo vuelva a preguntar).

### D4: Sustitución de valores hardcodeados por tokens — sin cambio visual, verificación manual mínima
Los 11 ficheros de espaciado y los 2 valores sueltos (sombra OKLCH, `font-family: monospace`) se sustituyen por el token existente que ya representa ese mismo valor (o el más cercano, documentando en el commit si hay una diferencia perceptible). Dado que Cypress no hace comparación visual pixel a pixel, la verificación es: (a) los tests E2E existentes siguen en verde (confirman que el elemento sigue ahí y es interactuable, no su aspecto exacto), y (b) una revisión visual rápida de las pantallas tocadas (`cockpit`, `nav-bar`, `route-detail`, `route-list`, `profile`) antes de cerrar la tarea — no hace falta dispositivo real para esto, sirve `pnpm dev` en el navegador.

### D5: Patrón de extracción a `.ts` suelto — se documenta como excepción explícita, no se renombra nada retroactivamente
En vez de renombrar los ~9 ficheros ya extraídos (`auth-section.ts`, `profile-header.ts`, etc.) a un sufijo nuevo — lo que tocaría todos sus imports y specs sin aportar nada funcional — se añade una frase corta a `CLAUDE.md` (regla de edición existente sobre separación de ficheros) documentando la excepción ya real: cuando un `.element.ts` supera el límite de líneas, la lógica extraída puede vivir en un `.ts` sin sufijo `.element`/`.transform`, siempre con JSDoc explicando el porqué (patrón que estos ficheros ya siguen). **Requiere avisar al usuario antes de editar `CLAUDE.md`** (regla de autorización explícita del propio proyecto) — se hace como primer paso de la tarea correspondiente en `apply`, no aquí.
**Alternativa descartada**: crear un sufijo nuevo (p.ej. `.extracted.ts`) y renombrar todo — descartada, coste de refactor (imports, specs, git blame) sin beneficio real sobre simplemente documentar lo que ya existe.

## Risks / Trade-offs

- [Riesgo] Cambiar el NDK API level de vuelta a 24 para `aarch64` podría revelar un problema real si el 34 SÍ tapaba algo (poco probable tras confirmar con el usuario, pero no descartable al 100%) → Mitigación: la tarea de `apply` incluye compilar un build real (`pnpm tauri android build --target aarch64`) y confirmar que sigue funcionando, no solo cambiar el fichero y asumir.
- [Riesgo] Mover `nav-bar` a `shared/` puede romper imports no detectados por búsqueda de texto si algún fichero lo importa con una ruta relativa distinta a la esperada → Mitigación: `tsc --noEmit` falla en rojo inmediatamente si queda un import roto, es la propia red de seguridad.
- [Riesgo] Sustituir valores hardcodeados por tokens puede introducir una diferencia visual sutil si el token más cercano no es un valor idéntico → Mitigación: revisión visual manual descrita en D4 antes de cerrar la tarea.
- [Riesgo] Añadir tests nuevos a servicios ya existentes puede revelar un bug real no detectado hasta ahora (mismo patrón que ya pasó en `sistema-iconos-svg`/`subida-fotos-mobile`) → Mitigación: si aparece, se corrige como parte de esta misma tarea (TDD real: rojo con el bug, verde tras corregirlo), documentado en `tasks.md` igual que los hallazgos reales de cambios anteriores.

## Migration Plan

Cambio de mantenimiento sin migración de datos ni despliegue — se aplica directamente sobre el árbol de trabajo, se verifica con la suite de tests existente, y se cierra con PR a `master` como cualquier otro cambio. Sin rollback especial: revertir el PR basta si algo falla.
