## Why

El APK que hoy se instala desde un Release de GitHub pesa ~170MB, un tamaño excesivo para una app que solo graba GPS, dibuja un mapa y sube fotos. La investigación previa a esta propuesta encontró la causa raíz real: el job `build-and-release` de `.github/workflows/ci.yml` compila con `pnpm tauri android build --target aarch64 --debug` (ver `openspec/specs/ci-cd/spec.md`, requirement "El build y release de Android solo se dispara con un tag de versión"). Es decir, **lo que se publica como "release" es en realidad un build debug**: `isMinifyEnabled=false`, sin proguard/R8, sin `isShrinkResources`, y el binario Rust se compila con el profile de desarrollo, ignorando por completo el `profile.release` ya bien afinado de `src-tauri/Cargo.toml` (`lto=true`, `strip=true`, `opt-level="s"`, `panic="abort"`). Un debug local equivalente (single-target, sin siquiera universal) mide ~305MB con el `.so` nativo sin stripear en 148MB.

Esto **contradice el efecto esperado, aunque no la decisión, de ADR-031**: la ADR aceptó deliberadamente publicar el debug de siempre para no gestionar un keystore de firma real ni secretos nuevos ("sin firma de release real... descartada por ahora"). Esta propuesta mantiene esa parte de la decisión intacta — no se introduce ningún keystore ni secreto nuevo — pero corrige el efecto no buscado: se puede compilar con el buildType `release` de Android (minify, shrink, strip, profile de Rust optimizado) reutilizando el mismo signingConfig de debug que ya se genera hoy en el runner efímero, sin tocar la superficie de secretos. Se confirmó este enfoque con el usuario explícitamente antes de escribir esta propuesta.

Además del build de Android, el build web de producción (`vite build`) genera sourcemaps sin condicionar a modo (`sourcemap: true` en `vite.config.ts`), y ese `dist/` se empaqueta tal cual dentro del APK vía Tauri: medido, ~3.1MB de los 4.7MB de `dist/` son `.map`, más del 65% del peso — expuestos también como código fuente legible sin necesidad, ya que el proyecto no tiene infraestructura de crash-reporting que los consuma.

## What Changes

- Build web: `sourcemap: false` en el build de producción de Vite (los sourcemaps dejan de generarse y de empaquetarse; no hay infraestructura de crash-reporting hoy que los necesite — decisión confirmada con el usuario).
- Build web: evaluar separar `maplibre-gl` en un chunk cargado de forma perezosa (solo cuando se monta una vista con mapa), en vez de ir en el único bundle actual.
- Build Android: el job `build-and-release` de CI pasa de `pnpm tauri android build --target aarch64 --debug` a un build `release` real (sin `--debug`).
- Build Android: el buildType `release` de `src-tauri/gen/android/app/build.gradle.kts` (o el mecanismo de Tauri 2 correcto para persistirlo sin que se pierda al regenerar el árbol `gen/android`) reutiliza el mismo `signingConfig` de debug ya generado hoy — **sin keystore ni secreto nuevo**.
- Build Android: `isShrinkResources = true` junto al `isMinifyEnabled = true` ya existente en el buildType `release`.
- Verificación real: generar un build `release` real (web + Android) y medir el tamaño del APK resultante antes/después como criterio de aceptación explícito — no basta con razonar sobre configuración.
- Quality gate nuevo: un presupuesto de tamaño de bundle documentado (APK release y/o `dist/` web), en la misma línea que los quality gates ya existentes del proyecto (cobertura 80%, AC coverage 100%), para detectar regresiones de tamaño en el futuro.
- Tooling de desarrollo: nuevo script `apps/mobile/scripts/install-android.sh` que detecta la ABI del dispositivo Android conectado (`adb shell getprop ro.product.cpu.abi`), la mapea al `--target` correcto de `tauri android build` y compila+instala en un solo paso — evita tener que recordar a mano qué target toca al probar en dispositivos o emuladores distintos durante desarrollo local. Es conveniencia de desarrollador, sin comportamiento observable de la app: no añade una capability propia ni requiere delta spec, se cubre solo en `tasks.md`.
- **Fuera de alcance explícito**: no se toca `JAVA_HOME`/versión de JDK local — es un tema de estabilidad del entorno de build (el JBR de Android Studio se autoactualizó a Java 25 rompiendo Gradle), no de rendimiento ni tamaño en producción, y CI ya fija `java-version: '17'`. No se introduce ABI splitting (`--split-per-abi`) porque CI ya compila un único target (`aarch64`), no un universal — no era el problema real. No se añade firma de release real ni keystore nuevo (ver Why).

## Capabilities

### New Capabilities
- `build-produccion-mobile`: define cómo se genera el build de producción de la app móvil (web + Android) para que sea pequeño y esté correctamente optimizado — sourcemaps fuera del bundle empaquetado, buildType `release` de Android real con minify/shrink/strip, y un presupuesto de tamaño verificado.

### Modified Capabilities
- `ci-cd`: el job `build-and-release` deja de compilar con `--debug` y pasa a compilar con el buildType `release` de Android (firmado con el signingConfig de debug reutilizado, sin secretos nuevos) — cambia el requirement "El build y release de Android solo se dispara con un tag de versión" (concretamente el escenario "El APK resultante se publica como asset del GitHub Release").

## Impact

- `apps/mobile/vite.config.ts`: `sourcemap: false` en modo producción; posible `manualChunks` para `maplibre-gl`.
- `apps/mobile/src-tauri/Cargo.toml`: sin cambios (el `profile.release` ya está bien afinado; solo deja de ignorarse).
- `apps/mobile/src-tauri/gen/android/app/build.gradle.kts` (autogenerado por Tauri — investigar en `apply`/`design` el mecanismo correcto de Tauri 2 para persistir `isShrinkResources` y el `signingConfig` del buildType `release` sin que se pierdan al regenerar el árbol `gen/android`).
- `.github/workflows/ci.yml`: paso de build del job `build-and-release` (quita `--debug`), y el paso existente de verificación del APK publicado (puede necesitar ajustes si algo que hoy asume un APK debug deja de cumplirse en un APK release).
- `openspec/specs/ci-cd/spec.md`: delta spec por el cambio de comando de build.
- `apps/mobile/scripts/install-android.sh` (nuevo): detección de ABI vía `adb` + build/install de un solo paso para desarrollo local.
- Sin cambios en `apps/api` ni en el backend.
