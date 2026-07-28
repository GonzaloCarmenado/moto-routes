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
├── routes/                    # Dominio "routes" (listado, detalle, timeline)
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
- **Sesión 2026-07-28 (4) — fix: "Galería" no hacía nada al añadir foto**: bug reportado por el usuario (trabajando en paralelo con Cline) — el botón "Galería" de `<photo-capture>` no seleccionaba ninguna foto ni daba error visible. Causa raíz encontrada en el working tree: Cline había dejado a medias (sin commitear) un puente nativo Android nuevo (`src-tauri/src/photo_plugin.rs` + `PhotoPlugin.kt`, sin trackear; cambios en `lib.rs`/`Cargo.toml`/`AndroidManifest.xml`) que hacía que `pickFromGallery()` (`photo-capture-adapter.service.ts`) bifurcara por `isTauri()` hacia `@tauri-apps/plugin-dialog` → `invoke('copy_photo')` → `readFile`. Ese plugin nunca se instaló (no está en `package.json`), nunca se registró en Rust ni tiene permiso en `capabilities/default.json` — y además `vite.config.ts` (de una sesión mucho más antigua) ya redirigía ese import a un stub local que siempre devuelve `null`, así que la selección fallaba en silencio en vez de dar el error de permisos genérico de Tauri que cabría esperar. La spec `fotos-ruta.md` (AC-022) ya documentaba la decisión correcta desde antes: cámara y galería deben usar `<input type="file">` sin distinción de plataforma, porque el WebView de Android abre igual los selectores nativos — el código de Cline divergía de esa decisión ya tomada. **Fix aplicado**: revertidos los cambios de Cline (`git checkout` sobre `lib.rs`/`Cargo.toml`/`Cargo.lock`/`AndroidManifest.xml`, borrados los ficheros sin trackear), `pickFromGallery()` simplificado para usar `captureFromInput()` sin bifurcar por `isTauri()` (igual que `captureFromCamera()`, que nunca tuvo este problema), eliminado el alias muerto de `@tauri-apps/plugin-dialog` en `vite.config.ts` y su stub (`src/shared/tauri-plugins/plugin-dialog.ts`). Añadido test de regresión explícito (`pickFromGallery (Tauri Android)`) que confirma que con `__TAURI_INTERNALS__` presente se sigue usando `<input type="file" multiple>`. **484/484 tests TS pasan** (1 nuevo), `tsc`/ESLint sin errores, `cargo build`/`clippy -D warnings`/`fmt --check` sin issues. No se ha tocado `specs/features/fotos-ruta.md` porque el código ahora vuelve a cumplir AC-022 tal cual estaba documentado — no hubo cambio de decisión, solo corrección de una regresión no commiteada. **Verificado en dispositivo Android real** (build `aarch64 --debug` + `adb install -r`): "Galería" vuelve a funcionar, confirmado por el usuario. Al hacer `git push` apareció un commit de Cline en remoto (`3ac137e`, pusheado mientras se investigaba) que añadía `READ_MEDIA_IMAGES`/`READ_EXTERNAL_STORAGE` al manifest y `@tauri-apps/plugin-dialog` a `package.json` como intento paralelo — con nota de que "la galería sigue sin funcionar" (diagnóstico previo a este fix). Rebaseado sin conflictos y, con el fix ya confirmado funcionando sin esos permisos/dependencia, se limpiaron en un commit aparte (`chore(fotos)`, principio de permisos mínimos). **Commiteado y pusheado a `origin/master`**: `dc92db6` (fix) + `55f8c14` (limpieza). Feature cerrado.
- **Sesión 2026-07-28 (3) — cierre de `deuda-tecnica-auditoria`**: retomada la sesión anterior. Verificado visualmente en el navegador (`pnpm run dev`, modo web) el resplandor `--amber-glow` (AC-007) — se ve correctamente en el botón "Grabar" del cockpit. AC-003 (formato de fecha) no se pudo verificar contra datos reales en modo web (la BBDD vive en el dispositivo Android, sin rutas guardadas en este entorno) — dado por bueno por criterio del usuario (cambio mecánico de `toLocaleDateString` ya cubierto por tests). Se invocó `review-agent`: veredicto **APPROVED WITH MINOR ISSUES** (ISSUE-001, severidad baja: AC-005 — spinner de `photo-capture` respetando `prefers-reduced-motion` — sin verificación manual documentada; mecanismo en sí correcto). Resuelto en la misma sesión añadiendo 2 tests nuevos a `photo-capture.element.css.spec.ts` que confirman deterministamente que el override global `@media (prefers-reduced-motion: reduce)` de `tokens.css` (con `animation-duration: 0.01ms !important`) llega al CSS resuelto del componente, en vez de una verificación manual en DevTools (frágil de automatizar). **483/483 tests TS pasan** (2 nuevos). Veredicto final: **APPROVED**. Feature `deuda-tecnica-auditoria` cerrado — los 10 AC cumplidos y verificados.
- **Sesión 2026-07-28 (2) — feature `deuda-tecnica-auditoria` (10/10 AC, 9/9 pasos del plan)**: saneamiento técnico puro por SDD/TDD, sin funcionalidad nueva (salvo dos cambios visuales acotados y aprobados de antemano en la spec). **Pasos 1-3 (imports cruzados/ubicación de código compartido, "blast radius" alto — 15+ archivos tocados)**: `formatDuration`/`calculateAvgSpeed` → `shared/utils/format.ts`, `calculateDistance` → `shared/utils/geo.ts` (ambos antes en `cockpit.transform.ts`, importados directamente por `routes/`); `photo-capture.*` movido de `src/photos/` (carpeta eliminada) a `shared/photo-capture/` (mismo patrón que `photo-gallery`/`photo-viewer`); `formatRouteDate`/`buildRouteDisplayName` (nuevo) y `buildDefaultRouteName` (movida) → `shared/utils/date.ts`/`shared/utils/route-naming.ts`, deduplicando el formateo de fecha divergente entre `route-list` (mes corto) y `route-detail` (mes largo, y sin año en el título) — ahora ambos usan `month: 'short'` con año siempre. `detectStop` es la única excepción documentada de import cruzado `routes → cockpit` (depende de `StopDetectionState`), con comentario explícito en ambos extremos del import. **Pasos 4-6 (CSS/tokens)**: `shared/photo-capture/photo-capture.element.css` importa `tokens.css` sin fallbacks hardcodeados; `counter.element.css`/`confirm-dialog.element.css` importan `tokens.css` (antes no lo hacían pese a usar `var(--token)`); nuevo token `--amber-glow: oklch(60% 0.17 45 / 0.45)` sustituye los 6 literales `oklch(...)` hardcodeados en `cockpit.element.css`/`nav-bar.element.css` (ADR-026, referencia ADR-019 — no contradice la prohibición de "neón/glow" al quedar acotado a un token semántico único). **Ajuste no previsto por el plan**: los tests de `*.element.css.spec.ts` requirieron añadir `test: { css: true }` a `vitest.config.ts` (Vitest devuelve `''` para imports CSS por defecto) y comprobar contenido *resuelto* de `tokens.css` (p. ej. `--amber:`) en vez del texto literal `@import`, que Vite reemplaza en línea al procesar `?inline`. **Pasos 7-8 (Rust)**: `src-tauri/src/commands/mod.rs` gana su primer módulo `#[cfg(test)]` (5 tests: `save_file` rechaza absolutas/`..`/contenido vacío, acepta relativas válidas; `greet` rechaza nombre vacío) — `cargo test` pasa de "0 passed" a 5/5; `recording_service.rs` documenta como limitación conocida (comentario en código) que no tiene lógica pura testeable fuera de `#[cfg(target_os = "android")]`. **Paso 9 (cobertura wrappers Tauri)**: `sqlite-photo.factory.ts` 0%→100%, `sqlite-route.factory.ts` 73%→100% (nuevos specs mockeando `Database.load` de `@tauri-apps/plugin-sql`), `photo-storage.service.ts` 74%→98.8% (ramas de éxito/catch de `createPhotoRepository` en Tauri, `buildPhotoMetadata`, mime type `.png`). **481/481 tests TS pasan** (24 tests nuevos netos), cobertura global 95.9%/90.31%/94.48%/95.9% (stmts/branch/funcs/lines). `cargo test`/`cargo clippy -- -D warnings`/`cargo fmt --check` en verde. `tsc --noEmit` y `vite build` sin errores (hubo que ampliar `buildRouteDisplayName` para aceptar `string | null | undefined` en el nombre, ya que `Route.name` es `string | null`). Verificado: no queda ningún import cruzado `routes ↔ cockpit` fuera de la excepción documentada de `detectStop`, ni ninguna referencia residual a `src/photos`. **Pendiente**: verificación visual manual del usuario (antes/después) del resplandor `--amber-glow` (AC-007) y del nuevo formato de fecha en `route-detail` (AC-003) — ambos cambios visuales menores ya aprobados de antemano en la spec, pero sin captura confirmada todavía. AC-001 a AC-010 marcados `[x]` en la spec (a diferencia de `grabacion-rutas` Fase 2, aquí sí son verificables por completo con tests automatizados + compilación). Recomendado invocar `review-agent`.
- **Sesión 2026-07-28 — feature `grabacion-rutas` Fase 2 (AC-011 corregido, AC-020 a AC-023 IMPLEMENTADOS, pendiente de verificación manual — Pasos 12-18/19 del plan)**: se descubrió con datos reales de BBDD que el fix de PR #47 (foreground service) solo mostraba la notificación persistente, pero la captura de puntos GPS seguía dependiendo de `navigator.geolocation.watchPosition()` en el WebView (una ruta real de 64s guardó 1 solo punto). Esta sesión mueve la captura de ubicación a código nativo Android: `RecordingService.kt` ahora usa `FusedLocationProviderClient` (intervalo 1s) con fallback a `LocationManager` si Google Play Services no está disponible (AC-023), maneja `ACTION_PAUSE`/`ACTION_RESUME` sin detener el servicio/notificación, y reenvía cada punto vía `tauri::ipc::Channel` (`RecordingServicePlugin.kt` → `recording_service.rs` → evento Tauri `recording-service://location` → `cockpit-native-gps.service.ts`, nuevo `GpsProvider` que sustituye a `watchPosition()` como única fuente de puntos en Android/Tauri, con `selectGpsProvider()`/`isAndroidTauri()` para no romper web/desktop). De paso se corrigió un bug de duplicación de puntos en pausa/reanudación (`pauseRecordingAction` no llamaba a `loop.stopWatch()`, dejando un watch huérfano). Archivos nuevos: `cockpit-native-gps.service.ts`+spec, `cockpit-foreground.service.spec.ts`, `shared/tauri/commands.spec.ts`. Modificados: `cockpit.service.ts`, `cockpit-foreground.service.ts`, `cockpit.element.ts`, `shared/tauri/commands.ts` (+specs), y en Rust `recording_service.rs`/`commands/mod.rs`/`lib.rs` (nuevo `Channel`, comandos `pause_recording_location`/`resume_recording_location`), y en Kotlin `RecordingService.kt`/`RecordingServicePlugin.kt`/`MainActivity.kt`/`build.gradle.kts` (+ dependencia `play-services-location:21.3.0`). 49 tests TS nuevos, **457/457 tests pasan**, cobertura 94.81%/89.53%/93.7% (líneas/ramas/funciones). `cargo build`/`clippy -D warnings`/`fmt --check`/`test` sin errores en `src-tauri/`. `pnpm tauri android build --target aarch64 --debug` compiló sin errores a la primera e instalado con `adb install -r` en dispositivo real. **IMPORTANTE — esto NO está verificado como funcionando todavía**: falta el Paso 19 del plan (prueba manual de un trayecto real de varios minutos con la pantalla bloqueada, comprobando `route_points` en la BBDD del dispositivo) antes de dar el bug por resuelto — exactamente la misma prueba corta que ya se dio erróneamente por buena una vez con este mismo bug (sesión 2026-07-27) no debe repetirse. No marcar AC-011/AC-020 a AC-024 como `[x]` en la spec hasta completar esa verificación.
- **Sesión 2026-07-27 (3) — feature `timeline-ruta` (21/21 AC, 8/8 pasos del plan)**: implementada por SDD con TDD. Nueva pestaña "Timeline" en `<route-detail>` como 4ª pestaña del `<tab-bar>`, que muestra en orden cronológico Salida, paradas detectadas al vuelo (reutilizando `detectStop()` de `cockpit.transform.ts` con el mismo criterio conservador de 30 puntos ≤3 km/h), fotos intercaladas y Llegada, con velocidad media de cada tramo. Cinco archivos creados: `route-timeline.types.ts` (tipos puros), `route-timeline.transform.ts` (lógica pura: `detectStopsFromPoints`, `formatTimelineTime`/`Coords`/`Speed`, `buildTimelineSegments`, `buildTimelineData`), `route-detail-timeline.ts` (constructor DOM), y sus specs. Tres archivos modificados: `route-detail.element.ts` (4ª pestaña, guarda `_routePoints` completos con timestamp/speed, `refreshAllPanels` al cambiar fotos), `route-detail.element.css` (~100 líneas de estilos con tokens Asfalto Nocturno). 21/21 AC cubiertos con 27 tests nuevos. **419/419 tests pasan**, cobertura >80%. Sin cambios en Rust, SQLite ni dependencias. Build Android compilado (`pnpm tauri android build`), instalado en dispositivo real y **verificado visualmente por el usuario** — pestaña Timeline funcional con datos de rutas ya guardadas. Mergeado a `master` (PR #49).
- **Sesión 2026-07-27 (2) — feature `mejoras-guardado-rutas` (18/18 AC, 11/11 pasos del plan)**: nombre de ruta al guardar, notas editables, fix nav-bar. Mergeado a `master` (PR #48).
- **Sesión 2026-07-27 — fix: GPS no grababa en segundo plano**: foreground service real vía JNI. Mergeado a `master` (PR #47).
- **Fase**: APK Android compilado y funcional, con persistencia de rutas y fotos verificada en dispositivo real. Todas las features mergeadas a `master`.
- **Feature activo**: Ninguno. `grabacion-rutas` Fase 2 cerrado (AC-024 verificado en dispositivo real). `deuda-tecnica-auditoria` commiteado, mergeado y pusheado a `origin/master`. Pendiente ISSUE-001 del review de `mejoras-fotos-mapa` (verificación visual en Android real + migración ALTER TABLE).
- **Último push (2026-07-28)**: `c93f385` (fix GPS nativo Fase 2) + commit `deuda-tecnica-auditoria` (10/10 AC, review APPROVED) pusheados a `origin/master`.

## Desarrollo Web (Vite)
Para lanzar el proyecto en modo web (sin Tauri), usar:
```bash
pnpm run dev
```

**Puerto fijo**: `1420` (configurado en `vite.config.ts` con `strictPort: true`).

## Build Android
```powershell
pnpm tauri android build --target aarch64 --debug
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

## Convenciones
- **Estilo de código**: TypeScript strict mode + ESLint strict + Prettier
- **Commits**: Conventional Commits
- **Ramas**: feature/<nombre> desde main
- **Nombrado**: Carpetas en kebab-case, clases/componentes en PascalCase, funciones en camelCase
- **Idioma**: Docs y specs en español, código en inglés