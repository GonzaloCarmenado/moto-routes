# Decisiones Arquitectónicas (ADRs)

## ADR-013: Stack desktop con Tauri 2 (Rust + Vite + Web Components)
- **Fecha**: 2026-07-08
- **Estado**: Aceptada
- **Contexto**: Se necesita una app móvil/desktop multiplataforma con frontend web y backend nativo para una aplicación de tracking de rutas en moto.
- **Decisión**: Tauri 2 con Rust backend y Vite + TypeScript + Web Components frontend. Adaptado para target mobile (Android/iOS) además de desktop.
- **Alternativas consideradas**: Electron (descartado: bundle pesado, consume mucha RAM), React Native (descartado: requiere Dart/JS bridge complejo), Flutter (descartado: requiere Dart, no comparte lógica con web).
- **Consecuencias**: Bundle ligero (~5-10MB) gracias al WebView nativo del SO y Rust compilado. IPC tipado con invoke<T>(). CSP estricto obligatorio. Compatibilidad con Android/iOS usando el mismo código base.

## ADR-014: Seguridad en Tauri - CSP + permisos mínimos + path validation
- **Fecha**: 2026-07-08
- **Estado**: Aceptada
- **Contexto**: Tauri expone APIs del sistema operativo. Sin una configuración cuidadosa, se pueden introducir vulnerabilidades.
- **Decisión**: Aplicar defensa en profundidad: CSP sin unsafe-eval/unsafe-inline en producción, capabilities con permisos mínimos, validación de paths en Rust contra path traversal, wrappers tipados para invoke(), sin `window.__TAURI__` directo.
- **Alternativas consideradas**: Confiar en defaults de Tauri (descartado: permisos demasiado abiertos en algunas versiones).
- **Consecuencias**: Cada nuevo permiso (filesystem, shell, etc.) debe añadirse explícitamente en `capabilities/default.json`. Los comandos Rust deben validar inputs.

## ADR-015: Rust testing y linting con Clippy + cargo test
- **Fecha**: 2026-07-08
- **Estado**: Aceptada
- **Contexto**: El backend Rust necesita su propia suite de testing y linting, separada del frontend.
- **Decisión**: Usar `cargo test` para tests unitarios y de integración, `cargo clippy` con `-D warnings` para linting estricto, `rustfmt` para formateo, `cargo audit` para vulnerabilidades.
- **Alternativas consideradas**: Solo tests en frontend (descartado: no cubre la lógica de Rust).
- **Consecuencias**: El pre-commit hook ejecuta toda la suite: ESLint + Clippy + rustfmt + Vitest + cargo test + cargo audit.

## ADR-016: Filosofía visual "Telemetry & Freedom" - Modo oscuro técnico obligatorio
- **Fecha**: 2026-07-08
- **Estado**: Aceptada
- **Contexto**: La app se usa montada en el manillar de una motocicleta, con luz solar directa y vibraciones. Se necesita máxima legibilidad y mínimo deslumbramiento.
- **Decisión**: Modo oscuro técnico obligatorio sin variante clara. Paleta de colores basada en fondo #0b0c10, acentos neón (verde #00ff66, rojo #ff3131, azul #00d2ff). Hitboxes mínimas de 56×56px para guantes.
- **Alternativas consideradas**: Modo claro/oscuro toggle (descartado: riesgo de deslumbramiento nocturno, complejidad extra).
- **Consecuencias**: Todos los componentes deben usar los tokens CSS definidos en `src/shared/styles/tokens.css`. Prohibido hardcodear colores.
- **Superseded by**: [[ADR-019]] — la paleta neón "Telemetry & Freedom" fue reemplazada por "Asfalto Nocturno". El principio de fondo (modo oscuro obligatorio, hitbox 56×56px, tokens obligatorios) se mantiene; solo cambia la paleta/tipografía concreta.

## ADR-017: Adaptación a mobile (Android/iOS) con Tauri 2
- **Fecha**: 2026-07-08
- **Estado**: Aceptada
- **Contexto**: El proyecto se concibe como app móvil, aunque la plantilla original tauri-vanilla-ts está orientada a desktop.
- **Decisión**: Usar Tauri 2 con su soporte nativo para Android e iOS. Configuración de ventana adaptada a dimensiones móviles (400×800, min 360×640). Los iconos y bundle se generarán con `tauri icon` y `tauri build`.
- **Alternativas consideradas**: Usar Capacitor (descartado: no ofrece backend nativo Rust), mantener solo desktop (descartado: el usuario pide explícitamente mobile).
- **Consecuencias**: Para compilar para Android se necesita Android SDK + NDK. Para iOS se necesita Xcode + macOS. El comando `npm run tauri:android` inicia en dispositivo/emulador Android.

## ADR-018: Target Android como prioridad
- **Fecha**: 2026-07-08
- **Estado**: Aceptada
- **Contexto**: El usuario quiere compilar para Android de momento. iOS queda para más adelante.
- **Decisión**: Configurar `tauri.conf.json` con `bundle.android.minSdkVersion: 24`, `targetSdkVersion: 34`. Añadir permisos de ventana en `capabilities/default.json`. Generar script `scripts/setup-android.sh` para automatizar la configuración del entorno Android.
- **Alternativas consideradas**: Configurar ambos targets desde el inicio (descartado: añade complejidad innecesaria ahora).
- **Consecuencias**: Para build Android se requiere ANDROID_HOME, Android SDK 34+, NDK, Java 17+. El comando `npx tauri android init` genera la estructura nativa en `src-tauri/gen/android/`. Los scripts `npm run tauri:android` y `npm run tauri:android:build` están disponibles.

## ADR-019: Reemplazo de filosofía visual — "Asfalto Nocturno" sustituye a "Telemetry & Freedom"
- **Fecha**: 2026-07-11
- **Estado**: Aceptada
- **Contexto**: El usuario entregó un paquete de diseño completo (`moto-routes-design/`: screens de referencia, `DESIGN_PHILOSOPHY.md`, `STYLE_GUIDE.html`, `css/global.css`) que redefine la identidad visual de la app. La filosofía anterior ([[ADR-016]], "Telemetry & Freedom": dial circular, negro puro, acentos neón verde/rojo/azul, Segoe UI) queda sustituida por "Asfalto Nocturno": cuero oscuro cálido, ámbar como único acento vivo, óxido de apoyo, tipografía de señalética (Roboto Slab + Barlow + Barlow Semi Condensed tabular). El único componente construido en `src/` era el cockpit (grabación de ruta), correspondiente a `moto-routes-design/screens/grabacion-ruta.html`.
- **Decisión**: Renombrar `src/shared/styles/tokens.css` a la nomenclatura del paquete de diseño (`--bg-top`, `--panel`, `--amber`, `--ink`, `--font-display/ui/data`, etc.) en vez de mantener los nombres antiguos con valores nuevos — evita que un token como `--color-neon-go` pase a significar "ámbar", que sería confuso. Auto-alojar un subset `.woff2` de las 3 familias tipográficas en `src/assets/fonts/` (Roboto Slab 600, Barlow 400/500/600/700, Barlow Semi Condensed 700/800) en vez de depender de Google Fonts vía CDN, porque la app es Tauri offline con CSP `font-src 'self'`. Reescribir `src/cockpit/cockpit.element.ts`/`.css` con el nuevo lenguaje visual, preservando toda la lógica funcional existente (long-press de 1.5s para finalizar, pausa/reanudar, modo invisible, overlay de permiso GPS) que no tiene equivalente en los mockups estáticos. No se implementan las pantallas de listado/detalle de ruta ni la botonera inferior (`bottom-nav`) — no existe routing ni más pantallas montadas todavía; quedan documentadas en `specs/ui/design-system.md` como pendientes.
- **Alternativas consideradas**: Mantener "Telemetry & Freedom" y tratar la entrega de diseño como opcional/futura (descartada: el usuario pidió explícitamente sustituir el cockpit por el nuevo sistema). Mantener los nombres de token antiguos con los valores nuevos (descartada: desalinea nombre y significado, dificulta el mantenimiento — ver discusión en la sesión).
- **Consecuencias**: Todo trabajo de UI futuro (listado de rutas, detalle de ruta, garaje, etc.) debe partir de los tokens y componentes documentados en `specs/ui/design-system.md` v2, no de los tokens `--color-*`/`--glow-*` antiguos (eliminados). Cualquier regla de estilo pensada como "global" debe vivir en `tokens.css`, no en `src/index.css` — un Shadow DOM nunca hereda selectores de una hoja de estilos del documento ligero, solo lo que llega vía `@import` dentro del propio `*.element.css` del componente. Los componentes de UI (`.chip`, `.stat-tile`, `.control-btn`, etc.) permanecen en `cockpit.element.css` hasta que una segunda pantalla los reutilice, momento en el que se promueven a `src/shared/` (regla ya existente en `specs/ui/frontend-conventions.md`).

## ADR-020: Persistencia real de fotos de ruta en Android — plugin-fs real, lectura vía readFile (no convertFileSrc), ruta insertada como 'active' antes de grabar
- **Fecha**: 2026-07-20
- **Estado**: Aceptada
- **Contexto**: Las fotos de ruta (feature `fotos-ruta`, ver [[fotos-ruta]]) parecían subir sin error pero no se veían ni persistían de verdad en Android. Investigación en varias rondas reveló tres bugs independientes y acumulativos:
  1. `@tauri-apps/plugin-fs` nunca fue una dependencia real: `vite.config.ts` aliaba `@tauri-apps/plugin-fs` y `@tauri-apps/api/path` a stubs no-op de `src/__mocks__/` **incondicionalmente**, incluso en el build real de Android (`beforeBuildCommand` usa el mismo `vite.config.ts`). El plugin tampoco estaba registrado en `src-tauri/src/lib.rs`. Resultado: `writeFile()` "tenía éxito" sin escribir nada, sin lanzar excepción — de ahí "sube sin error pero no se guarda".
  2. Una vez arreglado (1), las fotos SÍ se escribían en `appDataDir` (confirmado con `adb run-as ... ls photos/`), pero se veían rotas al leerlas: `getPhotoUrl()` usaba `convertFileSrc()` + el protocolo `asset://`/`https://asset.localhost`. Pese a tener `assetProtocol.scope` y CSP correctos, el WebView de Android no servía el fichero de forma fiable.
  3. Las fotos capturadas **durante grabación activa** (antes de parar/guardar la ruta) violaban `FOREIGN KEY (route_id) REFERENCES routes(id)` de la tabla `photos`, porque la fila de `routes` no se inserta hasta `stopRecording()`.
- **Decisión**:
  1. Instalar `@tauri-apps/plugin-fs` como dependencia real (`pnpm add`), registrar `tauri_plugin_fs::init()` en `lib.rs`, añadir el feature `protocol-asset` a `tauri` en `Cargo.toml`, y permisos `fs:allow-*` escopados a `$APPDATA/photos/**` en `capabilities/default.json`. Quitar los alias de `vite.config.ts`/`tsconfig.json` — ya no hacen falta mocks para un paquete real.
  2. `getPhotoUrl()` (en `photo-storage.service.ts`) lee los bytes con `plugin-fs.readFile()` y construye un `blob:` URL en JS (`URL.createObjectURL(new Blob([...]))`) en vez de usar `convertFileSrc()`. Evita depender del protocolo de assets, que resultó frágil en este dispositivo Android pese a la configuración correcta.
  3. `CockpitState.routeId` se pre-genera al iniciar la grabación (no al guardar). `IRouteRepository.save()` es ahora un **upsert por id** (`route.id` opcional en `CreateRoute`; si ya existe, hace `UPDATE` en vez de `INSERT`, y los puntos/paradas se van añadiendo en sucesivas llamadas). `startRecordingAction()` inserta inmediatamente una fila `routes` con `status:'active'` y duración/distancia en 0; `stopRecordingAction()` la actualiza a `status:'completed'` con los datos finales. Así cualquier foto capturada en pleno directo siempre tiene una fila padre a la que referenciar.
- **Alternativas consideradas**: Quitar la `FOREIGN KEY` de la tabla `photos` (descartada: pierde el `ON DELETE CASCADE` al borrar una ruta, y además `CREATE TABLE IF NOT EXISTS` no migra instalaciones existentes — el dispositivo de pruebas ya tenía la tabla vieja creada). Guardar las fotos capturadas en pleno directo en un buffer aparte hasta que la ruta se guarde (descartada: más compleja, y arriesga perder fotos si la app se cierra antes de parar la grabación).
- **Consecuencias**: Cualquier flujo futuro que cree filas relacionadas con una ruta antes de que esta "termine" (fotos, y en el futuro quizá paradas en tiempo real) debe apoyarse en este patrón insertar-activa/actualizar-al-parar, no asumir que la ruta solo existe en BBDD al guardarse. Los rechazos de `invoke()` de Tauri no son instancias de `Error` de JS (suelen ser strings/objetos planos) — usar `toErrorMessage()` (`src/shared/utils/errors.ts`) en vez de `err instanceof Error ? err.message : fallback`, que se comió el mensaje real del primer intento de diagnóstico en esta misma sesión.

## ADR-021: Cierre de `fotos-ruta` — quality gates rotos sin detectar, gate de cobertura alineado a 80%, adopción de Claude Code en paralelo a Cline
- **Fecha**: 2026-07-22
- **Estado**: Aceptada
- **Contexto**: Al cerrar la ronda de trabajo de `fotos-ruta` (ver [[fotos-ruta]]) se pidió comprobar ESLint, tests y el gate de cobertura antes de abrir PR. Al ejecutar `pnpm lint` aparecieron ~24 "fatal parsing error" — `tsconfig.json` excluía `**/*.spec.ts`, y el `projectService` de `typescript-eslint` no puede tipar un fichero que no pertenece a ningún proyecto TS. Al arreglarlo y limpiar los warnings reales que salieron a la luz, se comprobó el lado Rust: `clippy.toml` tenía una clave `max_fn_params` que no existe en la versión de Clippy instalada (rompía la compilación antes de llegar a lintar nada), y además `cargo build`/`clippy`/`test` fallaban por separado porque `src-tauri/icons/icon.ico` (y el resto de iconos del bundle desktop) eran placeholders de 22-70 bytes que el compilador de recursos de Windows (RC.EXE) rechazaba. Ninguno de los tres bugs se había detectado antes porque el pre-commit hook (`.husky/pre-commit`) solo ejecutaba ESLint + Vitest, pese a que la documentación (ADR-015, `docs/06-seguridad.md`) siempre dijo que cubría también Rust.
- **Decisión**:
  1. `tsconfig.json`: se quita `**/*.spec.ts` de `exclude` (los specs SÍ se tipan ahora). No hay riesgo de contaminar `dist/` porque `vite build` sobrescribe por completo lo que `tsc` haya emitido antes.
  2. `eslint.config.js`: se ignoran `**/*.d.ts` (declaraciones ambient sin código ejecutable, rompían el `projectService` igual que los specs) y se añade un override para `**/*.spec.ts` desactivando `max-lines`, `max-lines-per-function` y `@typescript-eslint/unbound-method` — ruido esperado en tests (`describe` con muchos `it()`, `expect(obj.method)`), no señal de complejidad real.
  3. `clippy.toml`: se elimina la clave inválida `max_fn_params` (ya existía la equivalente correcta `too-many-arguments-threshold`).
  4. `src-tauri/icons/*`: regenerados con `pnpm tauri icon <fuente>` a partir de un icono Android real ya existente en el repo (`gen/android/.../mipmap-xxxhdpi/ic_launcher.png`). Se revirtieron explícitamente los iconos de `gen/android/` que ese mismo comando también sobreescribió — esos ya estaban verificados en dispositivo y no hacía falta (ni convenía, por posible pérdida de calidad) regenerarlos.
  5. `vitest.config.ts`: se excluyen del coverage los contratos puros sin código ejecutable (`route.types.ts`, `photo.types.ts`, `route.repository.ts`, `photo.repository.ts`, `shared/models/index.ts`, `**/*.d.ts`) — mismo criterio que ya existía para `cockpit.types.ts`. El umbral de cobertura sube de 70% (valor "provisional" de ADR previo, nunca vuelto a subir) a 80%, el que ya documentaba `memory/context.md` como objetivo. Cobertura real tras limpiar exclusiones y añadir tests a `toast.ts`/`route-detail-photo.service.ts`/`route-map-photos.ts` (antes 6-12% cada uno): 85.71%.
  6. `.husky/pre-commit`: se añaden `cargo fmt --check`, `cargo clippy -- -D warnings` y `cargo test`, alineando el hook real con lo que ADR-015 siempre dijo que hacía.
  7. Se crea `CLAUDE.md` (raíz) + `.claude/agents/*.md` + `.claude/commands/*.md` como equivalente nativo de Claude Code al setup de `.clinerules` + `agents/*.md` que ya existía para Cline+DeepSeek. Ambos coexisten: mismo SDD, misma `specs/`, misma `memory/` — solo cambia qué asistente los consume y cómo se invocan (subagentes/slash commands nativos en vez de `@agent:nombre` en el prompt).
- **Alternativas consideradas**: Usar `--no-verify` para saltarse el pre-commit roto en vez de arreglarlo (descartada: es exactamente el antipatrón que llevó a que estos tres bugs pasaran desapercibidos — el repo ya tenía el permiso `git commit --no-verify` usado en sesiones anteriores). Dejar el gate de cobertura en 70% para no arriesgar (descartada: la cobertura real ya superaba el 80% documentado una vez arregladas las exclusiones; mantenerlo en 70% habría dejado el número de `memory/context.md` desalineado del `vitest.config.ts` real, que es justo el tipo de deriva que este cierre pretendía evitar).
- **Consecuencias**: `pnpm lint`, `pnpm test:coverage`, `pnpm rust:lint`, `pnpm rust:format` y `pnpm rust:test` pasan limpios y ahora si alguno se rompe, el pre-commit lo va a atrapar de verdad. Cualquier fichero de test nuevo debe seguir dentro de `src/` (ya lo estaba) para quedar cubierto por `tsconfig.json`; cualquier tipo/interfaz puramente declarativo nuevo bajo `shared/models/` debe añadirse también a la lista de exclusión de `vitest.config.ts` si no tiene código ejecutable, o el coverage lo contará como "0%" y arrastrará la media hacia abajo de forma engañosa. Quedan 5 issues documentados en `specs/features/fotos-ruta.review.md` (popup de marcador, desagrupación de cluster al zoom, swipe en el visor, test de EXIF con GPS real, y la desviación de AC-007 centroide-vs-último-punto) para una iteración siguiente.
