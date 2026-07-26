# Contexto del Proyecto: Moto Routes

## Identidad
- **Nombre**: Moto Routes (Ride Tracker)
- **Propósito**: Aplicación móvil para motociclistas que combina navegación GPS, grabación de rutas y bitácora multimedia.
- **Repositorio**: d:\Git\Otros\moto-routes

## Stack Tecnológico
- **Lenguaje Frontend**: TypeScript 5.7 (strict mode)
- **Lenguaje Backend**: Rust (stable, edition 2021)
- **Bundler**: Vite 6
- **Desktop/Mobile Framework**: Tauri 2
- **UI**: Web Components nativos (Custom Elements v1)
- **Testing Frontend**: Vitest 3 (jsdom, coverage v8) → 80% threshold
- **Testing Backend**: cargo test (unit + integration)
- **Linting TS**: ESLint 9 (strictTypeChecked + stylistic)
- **Linting Rust**: Clippy (deny warnings)
- **Formatting TS**: Prettier 3
- **Formatting Rust**: rustfmt
- **Git Hooks**: Husky 9 (pre-commit: ESLint + Clippy + rustfmt + tests + cargo audit)
- **Package Manager**: pnpm + Cargo
- **Security**: CSP estricto, permisos mínimos, sin eval, path validation
- **BBDD Local**: SQLite vía `@tauri-apps/plugin-sql` (archivo: `moto-routes.db`)

## Herramientas de Desarrollo
- **GitHub CLI**: `gh` (oficial, ya instalado) → issues, PRs, releases
- **rtk**: Proxy de comandos (https://github.com/rtk-ai/rtk) → reduce tokens 60-90% en comandos repetitivos
- **Cline**: Extensión VSCode con DeepSeek como modelo

## Estructura del Proyecto
```
src/                          # Frontend (TypeScript + Vite)
├── app/
│   └── app.element.ts        # Componente raíz <app-root>, monta <cockpit-view>
├── cockpit/                  # Dominio "cockpit" (grabación de ruta)
│   ├── cockpit.element.ts    # Web Component <cockpit-view>
│   ├── cockpit.element.css   # Estilos del cockpit
│   ├── cockpit.service.ts    # Estado de grabación (GPS, pausas, invisible)
│   └── cockpit.transform.ts  # Formateo/cálculos (distancia, velocidad, duración)
├── assets/
│   └── fonts/                 # Subset .woff2 auto-alojado (Roboto Slab, Barlow, Barlow Semi Condensed)
├── components/
│   └── counter/
│       ├── counter.element.ts    # Ejemplo: <app-counter>
│       ├── counter.element.css   # Estilos del counter
│       └── counter.element.spec.ts
├── shared/
│   ├── styles/
│   │   └── tokens.css        # Design tokens globales
│   ├── utils/
│   │   └── dom.ts            # Utilidades DOM
│   ├── repositories/
│   │   ├── sqlite-route.repository.ts  # Repositorio SQLite para rutas
│   │   ├── sqlite-route.factory.ts     # Factory para crear la conexión
│   │   └── sqlite-route.repository.spec.ts
│   ├── models/
│   │   └── route.repository.spec.ts    # Suite de tests compartida
│   └── tauri/
│       └── commands.ts       # Wrappers tipados para invoke()
├── index.css                 # Estilos base globales
├── main.ts                   # Entry point
└── vite-env.d.ts             # Type declarations

src-tauri/                    # Backend (Rust)
├── src/
│   ├── main.rs               # Entry point de Tauri
│   ├── lib.rs                # Librería con comandos
│   └── commands/
│       └── mod.rs            # Comandos Tauri
├── capabilities/
│   └── default.json          # Permisos explícitos (mínimo privilegio)
├── icons/                    # Iconos de la app (generados por tauri icon)
├── Cargo.toml
├── tauri.conf.json
├── build.rs
├── .gitignore
└── .cargo/
    └── config.toml           # Cross-compiler NDK para Android

tests/
└── setup.ts                  # Test setup global

specs/features/               # Especificaciones funcionales por feature
specs/api/                    # Contratos de API
specs/data/                   # Modelos de datos, schemas
specs/ui/
├── design-system.md          # Filosofía visual + design tokens (actualizado)
└── frontend-conventions.md   # Reglas de frontend
agents/                       # Skills de agentes SDD
docs/                         # Documentación SDD
memory/                       # Sistema de memoria persistente
```

## Filosofía Visual: "Asfalto Nocturno"
- **Concepto**: Cuero oscuro, negro asfalto y ámbar cálido. Cuaderno de bitácora, no HUD de competición. **Prohibido**: neón, glassmorphism, azules fríos, diales circulares.
- **Source of truth**: `specs/ui/design-system.md` y `src/shared/styles/tokens.css`.
- **Tokens activos** (`--bg-top`, `--panel`, `--amber`, `--ink`, `--font-display/ui/data`). **No usar** `--color-*`, `--glow-*`, `--neon-*` (eliminados).
- **Modo oscuro obligatorio**: Por seguridad vial, sin modo claro.
- **Hitbox mínima**: 56×56px para uso con guantes de moto.
- **Paleta**: Asfalto/cuero oscuro (`--bg-top`/`--bg-bottom`), ámbar único acento (`--amber`), óxido de apoyo (`--rust-line`).
- **Tipografía**: Roboto Slab (titulares) + Barlow (interfaz) + Barlow Semi Condensed tabular (cifras). Self-hosted en `src/assets/fonts/`.
- **Shadow DOM**: Los estilos globales reales viven en `tokens.css` (importado en cada `*.element.css`). `index.css` solo alcanza DOM ligero.
- **Historial**: Sustituye a "Telemetry & Freedom" (ADR-019). Archivos legacy eliminados (`estilos_base.scss`, `filosofia de diseño.md`).

## Quality Gates
- **Test pass rate**: 100% (frontend + backend)
- **Code coverage (TS)**: 80% (lines, functions, branches, statements)
- **AC coverage**: 100% (cada criterio de aceptación debe tener al menos un test)
- **ESLint**: 0 warnings, 0 errors
- **Clippy**: 0 warnings (deny)
- **rustfmt**: Código formateado
- **cargo audit**: Sin vulnerabilidades conocidas
- **Build**: tsc sin errores + cargo build exitoso + vite build exitoso + tauri build exitoso

## Estado Actual del Proyecto
- **Fase**: APK Android compilado y funcional, con persistencia de rutas y fotos verificada en dispositivo real. `mejoras-tecnicas` mergeada (PR #44); `mejoras-usabilidad` implementada y aprobada pero **PR #45 aún abierto** (no mergeado a master).
- **Feature activo**: Ninguno en desarrollo — el código de `mejoras-usabilidad` está terminado y con review APPROVED, solo falta mergear el PR #45. Fotos de ruta (`specs/features/fotos-ruta.md`) sigue con 29/33 AC; ver [[fotos-ruta-review]].
- **Sesión 2026-07-26 — cierre de pendientes + bugs de fotos encontrados en dispositivo real**: se verificó ISSUE-001 de `mejoras-usabilidad.review.md` en Android real (cascade de borrado OK, 0 filas huérfanas — ver detalle en el propio review) y se cerraron AC-015 (popup con miniatura al pulsar marcador de foto) y AC-018 (desagrupación de clusters al hacer zoom, vía `photoClusterRadiusForZoom()` — radio de clustering que escala exponencialmente con el zoom respecto a un zoom de referencia) en `fotos-ruta.md`. De paso se corrigió un bug latente: los marcadores de foto nunca se pintaban en la carga inicial del mapa (el setter de `photos` solo actuaba si el mapa ya estaba listo). Durante la prueba en dispositivo, el usuario reportó 3 bugs nuevos, también corregidos: (1) `photo-viewer` mostraba las fotos casi negras por un problema de orden de pintado CSS (`.overlay` con `position:absolute` pinta por encima de `.img` sin `position`, aunque `.img` vaya después en el DOM — fix: `position:relative;z-index:1` en `.img`); (2) en cockpit no se podían borrar fotos desde el visor (`openPhotoViewer` no recibía `onDelete`); (3) el carrusel de fotos en cockpit se veía cortado sin scroll (`.cockpit-screen` heredaba `overflow:hidden` del host sin su propio `overflow-y:auto` + `min-height:0`). Se extrajo `deletePhotoWithConfirmation` a `shared/services/photo-delete.service.ts` para reusarla entre route-detail y cockpit sin duplicar lógica. Después se corrigió otro bug reportado tras probar en el móvil: al seleccionar varias fotos de la galería (tanto en cockpit/grabar como en route-detail/previsualizar) solo se guardaba una. Causa: `pickFromGallery()` no ponía `multiple` en el `<input type="file">` y solo leía `input.files[0]`. Ahora `pickFromGallery()` devuelve `File[]` (con `multiple`), y ambos flujos procesan todos los archivos en un bucle (`processMultiplePhotos()` en `cockpit-photo.service.ts` para cockpit; bucle con `persistSinglePhoto()` en `route-detail.element.ts`). `captureFromCamera()` no cambia (sigue devolviendo un único `File | null`, la cámara no tiene selección múltiple). Verificado en dispositivo real por el usuario: scroll y selección múltiple funcionan correctamente.
- **Hito anterior** (2026-07-22): `mejoras-usabilidad` (`specs/features/mejoras-usabilidad.md`, ver [[mejoras-usabilidad-review]], veredicto APPROVED, 15/15 AC, 284 tests, cobertura 90.46%). Módulo de feedback compartido (`toast` 3 variantes + `<confirm-dialog>` con focus trap), el long-press de parar ruta ahora pregunta guardar/descartar (con borrado real de la ruta+fotos al descartar), `<route-list>` y la galería ganan confirmación de borrado, estados de carga en listado/detalle, y `<photo-gallery>`/`<photo-viewer>` compartidos usados tanto en detalle de ruta como en grabación (antes solo en detalle). De paso se corrigió un bug de integridad preexistente: `PRAGMA foreign_keys` nunca se activaba en SQLite, así que el `ON DELETE CASCADE` del esquema era inerte — el borrado de rutas nunca se había ejercitado desde la UI hasta esta spec.
- **Hito anterior** (2026-07-22): `mejoras-tecnicas` (ver [[mejoras-tecnicas-review]], veredicto APPROVED) — refactor sin cambio de comportamiento: los 9 custom elements unificados en `BaseElement`, eventos de navegación centralizados (`app-events.ts`), pipeline de foto deduplicado (`photo-persist.service.ts`), CSS inline eliminado. Y antes, cierre de `fotos-ruta` — ver [[ADR-021]]: se arreglaron tres quality gates rotos (ESLint fatal parsing error en specs, Clippy con config inválida, build roto por icon.ico corrupto), gate de cobertura subido de 70% a 80%, y se creó `CLAUDE.md` + `.claude/agents/` + `.claude/commands/` como equivalente Claude Code del setup de Cline+DeepSeek.
- **AC-020 cerrada (2026-07-26, spec drift, sin código nuevo)**: el checklist de `fotos-ruta.md` decía que faltaba swipe en `<photo-viewer>`, pero ya estaba implementado y testeado desde el trabajo de `mejoras-usabilidad` (`onTouchStart`/`onTouchEnd` + `SWIPE_THRESHOLD_PX`, test "navigates on a horizontal swipe gesture"). Solo se corrigió el spec para reflejar la realidad — la regla de oro del ciclo (spec y código no quedan desalineados) aplicada sin escribir código.
- **Próximo hito**: Sin spec activa. `fotos-ruta` queda en 31/33 AC — solo faltan AC-005/AC-006 (falta test que mockee `exifr.parse` devolviendo GPS real; el camino con EXIF no está verificado, solo el fallback sin EXIF — esto es un test unitario con mock, no requiere dispositivo real) y AC-007 (deviation documentada: implementación usa centroide de la ruta en vez de "última ubicación conocida" — requiere decidir si se ajusta el código o se reescribe la AC). En `mejoras-usabilidad` — homogeneizar más los estados de carga si surge un tercer caso de uso (ISSUE-002). Los cambios de la sesión 2026-07-26 están pusheados sobre `feature/mejoras-usabilidad` (PR #45, aún abierto, sin mergear).

## Desarrollo Web (Vite)
Para lanzar el proyecto en modo web (sin Tauri), usar:

```bash
pnpm run dev
```

El script `pnpm run dev` ejecuta automáticamente `pnpm dev:kill` antes de arrancar Vite, el cual libera el puerto 1420 si está ocupado por una sesión anterior mal cerrada.

**Puerto fijo**: `1420` (configurado en `vite.config.ts` con `strictPort: true`). Es fijo porque Tauri lo necesita en `tauri.conf.json` → `build.devUrl`. Si se cambia, hay que actualizar ambos archivos.

**Problema conocido**: Si una sesión de Vite se cierra abruptamente, el proceso hijo puede quedar zombie ocupando el puerto. `scripts/kill-port.mjs` lo mata antes de arrancar (usando `Get-NetTCPConnection` de Windows + `Stop-Process`).

**Comando manual alternativo** si el script no funciona:
```bash
pnpm run dev:kill && pnpm run dev
```

## Build Android (Windows workaround) - IMPORTANTE: HISTORIAL DE FALLOS EVITADOS

### ⚠️ LECCIÓN APRENDIDA: Usar siempre `pnpm tauri android build`

No usar scripts manuales que copien assets o salten tareas de Gradle. El APK correcto lo genera Tauri CLI en:
- `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

El APK en `arm64/debug/app-arm64-debug.apk` NO sirve (no tiene los assets correctos).

### Proceso correcto (único que funciona):

```powershell
# 1. Compilar frontend + Rust + APK (todo en uno)
pnpm tauri android build --target aarch64 --debug

# 2. Instalar en móvil
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk

# 3. (Opcional) Ver BBDD SQLite
adb exec-out run-as com.motoroutes.app cat databases/moto-routes.db | sqlite3
```

### Errores ya resueltos y por qué no repetirlos:
1. **No usar `build-apk.ps1` manual** → instalaba el APK `arm64/` equivocado
2. **No saltar tareas Rust de Gradle** → `-x :app:rustBuild*` impide que Tauri genere los assets correctamente
3. **No forzar `versionCode` manual** → El `pnpm tauri android build` ya lo maneja
4. **No copiar `dist/` manualmente a assets de Android** → Tauri CLI lo hace solo

### Requisitos previos (ya configurados, no modificar):
- `src-tauri/.cargo/config.toml` → apunta al NDK r29 para cross-compilación
- Variables de entorno CC/AR se configuran automáticamente en el build de Tauri

## Convenciones
- **Estilo de código**: TypeScript strict mode + ESLint strict + Prettier
- **Commits**: Conventional Commits
- **Ramas**: feature/<nombre> desde main
- **Nombrado**: Carpetas en kebab-case, clases/componentes en PascalCase, funciones en camelCase
- **Idioma**: Docs y specs en español, código en inglés

## Visualizar datos de la BBDD Android (SQLite)

### Script
Usar `scripts/pull-db.ps1` que:
1. Busca el archivo `moto-routes.db` en las posibles ubicaciones del sandbox
2. Lo extrae al PC como `moto-routes-export.db`
3. Verifica que sea una BBDD SQLite válida
4. Muestra resumen de rutas, puntos y paradas
5. Exporta schema + datos completos en SQL

```powershell
.\scripts\pull-db.ps1
```

### Requisitos
- `adb` (Android SDK platform-tools)
- `sqlite3` opcional (si no está, guarda el .db para abrirlo con DB Browser)

### Nota
La BBDD se crea bajo demanda (lazy initialization). Si no hay datos guardados, el script informa que la BBDD no existe aún.

## Reglas para Cline/DeepSeek
- Siempre cargar este archivo al iniciar sesión
- No escribir código sin una spec en specs/features/
- Seguir el workflow SDD: SPEC → PLAN → TASKS → IMPL → REVIEW → TEST
- Usar TDD: tests antes que implementación
- Mantener este archivo actualizado con el estado del proyecto
- Ser eficiente con tokens: solo cargar archivos necesarios
- **Para build Android: usar siempre `pnpm tauri android build --target aarch64 --debug`**, nunca scripts manuales
