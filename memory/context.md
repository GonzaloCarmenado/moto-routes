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
- **Sesión 2026-07-27 — fix: GPS no grababa en segundo plano (Modo Invisible era cosmético)**: usuario reportó una ruta guardada como línea recta (solo 2 puntos GPS, 5.3s de diferencia) pese a haber bloqueado el móvil durante el trayecto. Investigación (ver [[grabacion-rutas-review]], sección "Cierre AC-012/AC-013"): `RecordingService.kt` (foreground service Android) y `MainActivity.startRecordingService()/stopRecordingService()` ya existían y funcionaban a nivel nativo, pero nada los invocaba de verdad — los comandos Tauri `start_foreground_service`/`stop_foreground_service` eran stubs (`log::info!` + `Ok(())`) sin ningún JNI real, y `setInvisibleMode()` en `cockpit.service.ts` solo cambiaba un booleano de UI. Fix en rama `feature/fix-gps-background` (no mergeada aún, pendiente de revisión del usuario): puente Rust↔Kotlin real vía el mecanismo oficial de mobile plugins de Tauri 2 (ver sección "Tauri Mobile Plugins" más abajo), nuevo `ForegroundServiceProvider` inyectable en `cockpit.service.ts` (mismo patrón que `GpsProvider`), wiring en `cockpit.element.ts`. De paso se detectaron y arreglaron 3 tests obsoletos en `route-map.element.spec.ts` que testeaban un popup de foto ya eliminado en el commit `36afc4f` (spec drift puro, sin tocar producción) — bloqueaban el reporte de cobertura porque Vitest no lo genera si hay tests en rojo (`reportOnFailure: false` por defecto). Verificado: 352/352 tests (94.45% cobertura), `cargo fmt`/`clippy`/`build` limpios, y build Android real (`pnpm tauri android build`) compiló y enlazó el plugin Kotlin+JNI sin errores, instalado en dispositivo real. **Pendiente**: verificación E2E completa (bloquear pantalla en pleno grabado y confirmar que sigue llegando GPS) requiere que el usuario la haga a mano — el móvil tiene bloqueo biométrico (huella) que no se puede ni se debe saltar por ADB.
- **Fase**: APK Android compilado y funcional, con persistencia de rutas y fotos verificada en dispositivo real. `mejoras-tecnicas` (PR #44), `mejoras-usabilidad` (PR #45) y `mejoras-fotos-mapa` (PR #46) mergeadas a `master`, ramas borradas. `mejoras-fotos-mapa` terminada (32/32 AC, review APPROVED WITH MINOR ISSUES) e integrada. Queda pendiente ISSUE-001 del review (verificación visual en Android real + confirmar migración ALTER TABLE en dispositivo).
- **Feature activo**: Ninguno en desarrollo activo. `mejoras-fotos-mapa` mergeada a `master` (PR #46). Fotos de ruta (`specs/features/fotos-ruta.md`) está en 33/33 AC; ver [[fotos-ruta-review]]. Pendiente ISSUE-001 del review de `mejoras-fotos-mapa` (verificación visual en Android real + migración ALTER TABLE).
- **Sesión 2026-07-26 — cierre de pendientes + bugs de fotos encontrados en dispositivo real**: se verificó ISSUE-001 de `mejoras-usabilidad.review.md` en Android real (cascade de borrado OK, 0 filas huérfanas — ver detalle en el propio review) y se cerraron AC-015 (popup con miniatura al pulsar marcador de foto) y AC-018 (desagrupación de clusters al hacer zoom, vía `photoClusterRadiusForZoom()` — radio de clustering que escala exponencialmente con el zoom respecto a un zoom de referencia) en `fotos-ruta.md`. De paso se corrigió un bug latente: los marcadores de foto nunca se pintaban en la carga inicial del mapa (el setter de `photos` solo actuaba si el mapa ya estaba listo). Durante la prueba en dispositivo, el usuario reportó 3 bugs nuevos, también corregidos: (1) `photo-viewer` mostraba las fotos casi negras por un problema de orden de pintado CSS (`.overlay` con `position:absolute` pinta por encima de `.img` sin `position`, aunque `.img` vaya después en el DOM — fix: `position:relative;z-index:1` en `.img`); (2) en cockpit no se podían borrar fotos desde el visor (`openPhotoViewer` no recibía `onDelete`); (3) el carrusel de fotos en cockpit se veía cortado sin scroll (`.cockpit-screen` heredaba `overflow:hidden` del host sin su propio `overflow-y:auto` + `min-height:0`). Se extrajo `deletePhotoWithConfirmation` a `shared/services/photo-delete.service.ts` para reusarla entre route-detail y cockpit sin duplicar lógica. Después se corrigió otro bug reportado tras probar en el móvil: al seleccionar varias fotos de la galería (tanto en cockpit/grabar como en route-detail/previsualizar) solo se guardaba una. Causa: `pickFromGallery()` no ponía `multiple` en el `<input type="file">` y solo leía `input.files[0]`. Ahora `pickFromGallery()` devuelve `File[]` (con `multiple`), y ambos flujos procesan todos los archivos en un bucle (`processMultiplePhotos()` en `cockpit-photo.service.ts` para cockpit; bucle con `persistSinglePhoto()` en `route-detail.element.ts`). `captureFromCamera()` no cambia (sigue devolviendo un único `File | null`, la cámara no tiene selección múltiple). Verificado en dispositivo real por el usuario: scroll y selección múltiple funcionan correctamente.
- **Hito anterior** (2026-07-22): `mejoras-usabilidad` (`specs/features/mejoras-usabilidad.md`, ver [[mejoras-usabilidad-review]], veredicto APPROVED, 15/15 AC, 284 tests, cobertura 90.46%). Módulo de feedback compartido (`toast` 3 variantes + `<confirm-dialog>` con focus trap), el long-press de parar ruta ahora pregunta guardar/descartar (con borrado real de la ruta+fotos al descartar), `<route-list>` y la galería ganan confirmación de borrado, estados de carga en listado/detalle, y `<photo-gallery>`/`<photo-viewer>` compartidos usados tanto en detalle de ruta como en grabación (antes solo en detalle). De paso se corrigió un bug de integridad preexistente: `PRAGMA foreign_keys` nunca se activaba en SQLite, así que el `ON DELETE CASCADE` del esquema era inerte — el borrado de rutas nunca se había ejercitado desde la UI hasta esta spec.
- **Hito anterior** (2026-07-22): `mejoras-tecnicas` (ver [[mejoras-tecnicas-review]], veredicto APPROVED) — refactor sin cambio de comportamiento: los 9 custom elements unificados en `BaseElement`, eventos de navegación centralizados (`app-events.ts`), pipeline de foto deduplicado (`photo-persist.service.ts`), CSS inline eliminado. Y antes, cierre de `fotos-ruta` — ver [[ADR-021]]: se arreglaron tres quality gates rotos (ESLint fatal parsing error en specs, Clippy con config inválida, build roto por icon.ico corrupto), gate de cobertura subido de 70% a 80%, y se creó `CLAUDE.md` + `.claude/agents/` + `.claude/commands/` como equivalente Claude Code del setup de Cline+DeepSeek.
- **`fotos-ruta` cerrada al 33/33 AC (2026-07-26)**: los 6 pendientes restantes resultaron ser 5 cierres reales + 1 caso de spec drift puro:
  - **AC-020 (swipe en el visor)**: spec drift — ya estaba implementado y testeado desde `mejoras-usabilidad` (`onTouchStart`/`onTouchEnd` + `SWIPE_THRESHOLD_PX`). Solo se corrigió el spec, sin código nuevo.
  - **AC-005/AC-006 (GPS por EXIF)**: la función pura `extractPhotoLocation` ya tenía test con `exifr.parse` mockeado devolviendo GPS real, pero el pipeline completo (`persistCapturedPhoto`) no lo verificaba end-to-end — se añadió ese test en `photo-persist.service.spec.ts`.
  - **AC-007 (fallback de ubicación sin EXIF ni ruta activa)**: se confirma el centroide de la ruta como decisión definitiva (ya implementada, ya coincidía con AC-013) y se registra [[ADR-024]] — se reescribe el texto de la AC en vez de tocar código.
  - Ver `specs/features/fotos-ruta.review.md` para el detalle de cierre de cada ISSUE-001 a ISSUE-005.
- **PR #45 (`mejoras-usabilidad`) mergeado a `master`** en esta misma sesión 2026-07-26 (merge commit, igual que #43/#44); rama `feature/mejoras-usabilidad` borrada en local y remoto. Pendiente conocido de esa spec, sin acción por ahora: homogeneizar más los estados de carga si surge un tercer caso de uso (ISSUE-002, severidad baja, no bloqueante).
- **`mejoras-fotos-mapa` — mergeada a `master` (PR #46, squash)**: spec completada (32/32 AC), review APPROVED WITH MINOR ISSUES, 346/346 tests, cobertura 94.44%. Queda ISSUE-001 del review (verificación visual en Android real + migración ALTER TABLE) como pendiente activo. Rama `feature/mejoras-fotos-mapa` borrada local y remotamente tras el merge.

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

## Tauri Mobile Plugins (Android) — cómo llamar código Kotlin real desde Rust

Necesario cuando un comando Tauri tiene que invocar algo nativo de Android
(p.ej. un foreground service) y no basta con la Geolocation API del WebView.
El código fuente real del core de Tauri (con ejemplos como `AppPlugin.kt`)
está disponible localmente en
`~/.cargo/registry/src/index.crates.io-*/tauri-2.*/mobile/android/src/main/java/app/tauri/`
— consultarlo ahí antes de adivinar la API, cambia entre versiones.

Patrón (usado en `src-tauri/src/recording_service.rs` +
`src-tauri/gen/android/app/src/main/java/com/motoroutes/app/RecordingServicePlugin.kt`,
ver [[grabacion-rutas-review]] sección "Cierre AC-012/AC-013"):

1. **Kotlin**: una clase `@TauriPlugin class Foo(private val activity: Activity) : Plugin(activity)` con métodos `@Command fun bar(invoke: Invoke) { ...; invoke.resolve() }`. Vive directamente en `gen/android/app/src/main/java/<paquete>/` (el módulo de la app, no un crate de plugin separado) — Gradle ya la compila sin registro adicional en `tauri.conf.json`.
2. **Rust**: solo se puede obtener un `PluginApi` (necesario para `register_android_plugin`) dentro del `setup()` de un plugin Tauri creado con `tauri::plugin::Builder::new("nombre").setup(|app, api| {...}).build()`, registrado con `.plugin(...)` en `lib.rs` — no hay otra forma de acceder a esa API desde el `AppHandle` normal.
3. Dentro de ese `setup()`, `#[cfg(target_os = "android")]`: `api.register_android_plugin("com.motoroutes.app", "RecordingServicePlugin")` devuelve un `PluginHandle`; se guarda con `app.manage(...)` para recuperarlo luego vía `app_handle.try_state::<T>()` desde cualquier comando Tauri normal.
4. Para invocar: `handle.run_mobile_plugin::<()>("bar", ())` — bloqueante, hace JNI internamente. `invoke.resolve()` sin argumentos en Kotlin serializa `"null"`, que deserializa a `()` sin problema.
5. Todo el bloque específico de Android va tras `#[cfg(target_os = "android")]`; en desktop el estado gestionado simplemente no existe y el comando es no-op (usar `try_state`, nunca `state()`, para no paniquear).
6. **Verificación real**: `pnpm tauri android build --target aarch64 --debug` compila Gradle+Kotlin+Rust cross-compilado de verdad — si el nombre de clase/paquete o la firma de comandos está mal, falla ahí. Es la comprobación más fuerte disponible sin desbloquear el móvil físicamente.

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
