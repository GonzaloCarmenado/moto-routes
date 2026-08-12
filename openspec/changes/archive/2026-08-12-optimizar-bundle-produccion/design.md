## Context

Ver `proposal.md` (Why) para la motivación. Contexto técnico relevante para el "cómo":

- `apps/mobile/src-tauri/gen/android/app/build.gradle.kts` **está trackeado en git** (no en `.gitignore`, confirmado con `git check-ignore`/`git ls-files`) y el job `build-and-release` de CI nunca ejecuta `tauri android init` — solo hace checkout del repo (que ya incluye este fichero) y corre `tauri android build` directamente. Esto resuelve la duda abierta en `proposal.md`: no hace falta ningún mecanismo especial de Tauri para persistir cambios en este fichero, se edita y se commitea como cualquier otro fichero de código — de hecho ya está hand-tuned hoy (`packaging { jniLibs.keepDebugSymbols... }` en el buildType `debug`).
- El buildType `release` de ese fichero ya tiene `isMinifyEnabled = true` y `proguardFiles(...)` (incluye `src-tauri/gen/android/app/*.pro`, también trackeado), pero **nunca se ha usado en producción** porque CI siempre compila con `--debug`. No hay evidencia de que el minify/R8 se haya verificado nunca sobre un build real.
- El profile `release` de `Cargo.toml` (lto, strip, opt-level="s", panic="abort") tampoco se ha usado nunca en producción por el mismo motivo — compilar sin `--debug` ya lo activa sin tocar `Cargo.toml`.
- `vite.config.ts` tiene `sourcemap: true` sin condicionar; solo se usa en `build.rollupOptions`/`build.sourcemap`, que únicamente aplican a `vite build` (no a `vite dev`), así que desactivarlo no afecta al flujo de desarrollo local.
- El job `build-and-release` firma hoy con un keystore de debug efímero generado por AGP en cada runner (comportamiento por defecto cuando el buildType `debug` no declara `signingConfig` propio) — documentado ya en el cuerpo del Release publicado y en ADR-031.

## Goals / Non-Goals

**Goals:**
- Que el APK publicado en un Release use el buildType `release` de Android real (minify + shrinkResources + profile Rust optimizado), sin introducir ningún keystore ni secreto de firma nuevo.
- Que el build web de producción no genere ni empaquete sourcemaps.
- Que una regresión de tamaño del APK release quede bloqueada automáticamente en CI, no descubierta a mano.

**Non-Goals:**
- ABI splitting de producción (`--split-per-abi`) — CI ya compila un único target (`aarch64`), no es la causa del tamaño actual. El script de detección de ABI (D6) es solo conveniencia de desarrollo local, no cambia qué se publica en un Release.
- Actualizar/pinnar el JDK local — problema de estabilidad del entorno, no de tamaño/rendimiento en producción (ver proposal.md, fuera de alcance explícito).
- Firma de release con keystore real gestionado — descartado explícitamente con el usuario; solo tendría sentido de cara a Play Store, no a la distribución actual por sideload.
- Separar `maplibre-gl` en un chunk lazy — quedó como "evaluar" en la propuesta, no se escribió como requirement en la spec. Se difiere como candidata a spec futura si, tras quitar los sourcemaps, el bundle web sigue necesitando reducirse más.
- Infraestructura de crash-reporting / subida de sourcemaps a un servicio externo — no existe hoy, no se introduce aquí (coherente con la decisión ya tomada con el usuario de simplemente no generarlos).

## Decisions

### D1: El buildType `release` reutiliza el signingConfig de `debug`, no uno nuevo
En `build.gradle.kts` se añade `signingConfigs { getByName("debug") { ... } }` (o se referencia el ya implícito de AGP) y `buildTypes.release.signingConfig = signingConfigs.getByName("debug")`. Sin secreto ni keystore nuevo — mismo criterio de firma que existe hoy, solo aplicado también al buildType `release`.
**Alternativa descartada**: keystore de release real vía GitHub Secret — reabre ADR-031 ("sin firma de release real... descartada por ahora") sin beneficio de tamaño adicional; solo aportaría valor si se publicara en Play Store, fuera del alcance actual. Confirmado con el usuario antes de escribir esta propuesta.

### D2: `isShrinkResources = true` se añade junto al `isMinifyEnabled` ya existente
Cambio de una línea en el buildType `release` del mismo fichero ya trackeado. No requiere investigación adicional de mecanismo (ver Context).

### D3: El comando de build de CI pierde el flag `--debug`, y el resto del pipeline se ajusta a las rutas de `release`
`pnpm tauri android build --target aarch64` (sin `--debug`). El paso de force-sync de assets pasa de `./gradlew assembleUniversalDebug -x :app:rustBuild*Debug` a `assembleUniversalRelease -x :app:rustBuild*Release`; la ruta del APK verificado/renombrado/publicado pasa de `.../apk/universal/debug/app-universal-debug.apk` a `.../apk/universal/release/app-universal-release.apk`. El texto del cuerpo del Release publicado se actualiza para dejar de decir "APK de depuración (sin firma de release)" (ya no es un buildType debug), manteniendo la nota de que la firma sigue siendo un keystore efímero por runner (el caveat de desinstalar antes de actualizar sigue aplicando igual que hoy).

### D4: El presupuesto de tamaño se implementa como un paso bash adicional en `build-and-release`, no como una dependencia npm nueva
Un paso nuevo mide el tamaño del `.apk` final (`stat`/`du`) y compara contra un umbral fijado como variable de entorno del workflow, fallando el job si se supera — mismo patrón ya usado en el paso "Verify the APK bundles..." (bash simple, sin herramienta externa). Coherente con la política de dependencias mínimas del proyecto: no se añade `bundlesize`/`size-limit` ni ningún paquete nuevo para un chequeo de 3 líneas.
**Alternativa descartada**: acción de terceros de GitHub Marketplace para size-check — descartada, dependencia externa innecesaria para una comparación numérica trivial.

### D5: `sourcemap: false` sin condicionar en `vite.config.ts`
Se cambia el valor fijo, sin lógica condicional por modo — el campo `build.sourcemap` solo afecta a `vite build` (producción), nunca a `vite dev`, así que no hace falta distinguir modos explícitamente.

### D6: Script local `install-android.sh` detecta la ABI del dispositivo vía `adb`, no hardcodea `aarch64`
`adb shell getprop ro.product.cpu.abi` (tras confirmar exactamente un dispositivo con `adb devices`) devuelve la ABI primaria del dispositivo/emulador conectado (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`), que mapea 1:1 a los valores de `--target` de `tauri android build` (`aarch64`, `armv7`, `i686`, `x86_64`). El script falla con un mensaje claro si hay 0 o más de 1 dispositivo conectado (mismo criterio que exigir `-s <serial>` explícito en ese caso), en vez de asumir uno. Es puramente conveniencia de desarrollo local — no toca `ci.yml` ni el `--target aarch64` fijo de producción (D3).
**Alternativa descartada**: dejar `--target aarch64` hardcodeado también en local — descartada porque ya ha causado confusión real en el pasado (builds universales accidentales al omitir `--target`, como se vio durante la investigación de este mismo cambio).
**Corrección real encontrada durante `apply`**: el primer build release local generado con `pnpm tauri android build` empaquetó 8 ficheros `.map` huérfanos de builds anteriores a este cambio — el copiado de assets del CLI de Tauri no borra ficheros que ya no existen en el `dist/` actual, mismo gotcha ya documentado en `memory/context.md` para el que existe el paso "Force-sync" en `ci.yml`. `install-android.sh` reproduce ese mismo force-sync (borrar+copiar `dist/assets` en `gen/android/app/src/main/assets` y reempaquetar solo con Gradle) antes de instalar, para no heredar el bug en cada iteración local.

## Risks / Trade-offs

- [Riesgo] R8/minify puede romper en runtime código que nunca se ha ejecutado minificado (reflection, puentes Kotlin↔Rust, callbacks de Play Services Location), sin que Vitest/Cypress lo detecten porque no corren sobre el APK real → Mitigación: el escenario de verificación manual en dispositivo real (ya en la spec) es obligatorio antes de cerrar el cambio; si aparecen fallos, ampliar `src-tauri/gen/android/app/*.pro` con reglas `-keep` concretas.
- [Riesgo] El build `release` (LTO + `codegen-units=1`) puede tardar sensiblemente más que el `debug` actual en el runner de CI → Mitigación: medir el tiempo real durante `apply`; si hace falta, subir el timeout del job explícitamente — no es motivo para bajar el nivel de optimización.
- [Riesgo] El umbral de tamaño se fija a partir de una sola medición inicial; un pico legítimo de tamaño en un cambio futuro (nueva fuente, nuevo asset) bloquearía la release sin ser una regresión real → Mitigación: el job falla con el tamaño medido y el umbral en el mensaje, dejando claro que se puede revisar y subir el umbral deliberadamente en una PR, igual que cualquier otro quality gate del proyecto.
- [Riesgo] Seguir firmando con un keystore de debug efímero por runner (sin cambios respecto a hoy) sigue impidiendo la actualización in-place de una instalación previa → Mitigación: ninguna nueva, es una limitación ya aceptada y documentada (ADR-031); este cambio no la agrava ni la corrige.

## Open Questions

- El valor exacto del umbral de tamaño (MB) no se fija aquí — se deriva de medir el primer APK `release` real generado durante `apply`, con un margen razonable. No cambia el enfoque ni las specs, solo el número concreto.
