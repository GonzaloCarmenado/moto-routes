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
