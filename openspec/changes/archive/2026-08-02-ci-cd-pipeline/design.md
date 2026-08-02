## Context

Ver `proposal.md` → Why para la motivación. En resumen: el único CI actual (`docs.yml`) está roto y no ejecuta ningún gate; todo el enforcement real vive solo en `.husky/pre-commit`, saltable y nunca corrido server-side. Constraints reales encontrados investigando el repo:

- `src-tauri/.cargo/config.toml` fija el linker de `aarch64-linux-android` a una ruta absoluta de Windows de esta máquina (`D:\Android\Sdk\ndk\29.0.13846066\...\windows-x86_64\...`) — inservible en cualquier runner.
- `src-tauri/gen/android/app/build.gradle.kts`: `compileSdk`/`targetSdk` = 36, `minSdk` = 24. Gradle wrapper 8.14.3 (`gradle-wrapper.properties`).
- No existe ningún keystore de firma en el repo (`build.gradle.kts` no tiene `signingConfig`) — todos los builds hasta ahora son debug, firmados con el keystore de debug por defecto de Android.
- `memory/context.md` § Build Android documenta gotchas reales de la máquina local (versionCode reseteado a 1000 en cada build, riesgo de empaquetar frontend desactualizado, JBR autoactualizado rompiendo Gradle) — algunos aplican a CI, otros son específicos de una máquina persistente y no de un runner efímero.

## Goals / Non-Goals

**Goals:**
- Gates de calidad idénticos en umbral y comando a los que ya exige `.husky/pre-commit`, corriendo en un runner limpio.
- Build de Android reproducible en CI sin ninguna ruta ni estado específico de la máquina de desarrollo actual.
- Cache agresiva de pnpm y Cargo para que ejecuciones sucesivas sean rápidas.

**Non-Goals:**
- Firma de release con keystore real (confirmado con el usuario, ver proposal.md — fuera de alcance).
- Arreglar `docs.yml` (problema preexistente sin relación, ver proposal.md).
- Resolver el reseteo de `versionCode` a 1000 en cada build — ya es una limitación conocida y sin resolver incluso en local; combinada con la firma de debug efímera (que ya impide actualizar in-place entre releases), arreglar solo `versionCode` no aportaría una actualización in-place funcional de todas formas. Se documenta como limitación aceptada, no se ataca aquí.
- Publicar en Google Play o cualquier store — solo GitHub Releases.

## Decisions

### 1. Un solo workflow (`ci.yml`) con 3 jobs, no 3 ficheros
`needs:` (la dependencia real entre quality gates y release) solo funciona entre jobs del mismo fichero. Tres ficheros habrían necesitado `workflow_run`, que además de más complejo introduce latencia de sondeo entre workflows — contradice el objetivo explícito de "eficiente". Cada job sigue reportando de forma independiente en la UI de GitHub (checks separados en la PR), así que no se pierde la trazabilidad de "3 informes distintos" que pedía el usuario.
Trigger del workflow: `on: [push, pull_request, push tags: v*]`. Los jobs `quality-ts`/`quality-tauri` corren siempre; `build-and-release` lleva `if: startsWith(github.ref, 'refs/tags/v')` además de `needs: [quality-ts, quality-tauri]`.

### 2. Cache: `actions/setup-node` (pnpm) + `Swatinem/rust-cache` (Cargo)
pnpm: mismo patrón que ya usa `docs.yml` (`pnpm/action-setup@v4` + `actions/setup-node@v4` con `cache: pnpm`), sin reinventar nada.
Cargo: `Swatinem/rust-cache@v2` — acción de la comunidad estándar para esto, cachea `~/.cargo/registry`, `~/.cargo/git` y `target/` con clave derivada de `Cargo.lock` automáticamente, sin configuración manual de rutas. Alternativa descartada: `actions/cache` a mano con rutas explícitas — más control pero reinventa lo que `rust-cache` ya resuelve bien, y este proyecto no tiene ninguna necesidad especial que lo justifique.
El job `build-and-release` cachea además el Android SDK/NDK instalado (`actions/cache` sobre el directorio de `sdkmanager`), porque descargar SDK+NDK+build-tools en cada release es varios minutos perdidos y cambia poco entre ejecuciones.

### 3. `build-and-release`: Java 17 (Temurin), Android SDK vía `sdkmanager`, NDK 29 explícito, target Rust `aarch64-linux-android`
- **Java**: `actions/setup-java@v4` con `distribution: temurin`, `java-version: 17`. Se descarta la última LTS (21) o versiones más nuevas porque el propio `memory/context.md` documenta un fallo real de esta sesión con Java 25 (el parser de versión del plugin Kotlin DSL de este Gradle/AGP no lo reconoce) — 17 es la versión más probada en este proyecto (JDK 24.0.1 también funcionó localmente, pero 17 es el estándar de facto para Android Gradle Plugin y minimiza sorpresas).
- **Android SDK**: los runners `ubuntu-latest` de GitHub ya traen `cmdline-tools` y varias plataformas preinstaladas, pero no necesariamente el NDK 29 exacto ni `platforms;android-36`. Se instalan explícitamente con `sdkmanager "platforms;android-36" "ndk;29.0.13846066" "build-tools;36.0.0"` para no depender de qué versión traiga la imagen del runner esta semana (las imágenes de GitHub-hosted runners cambian sin aviso).
- **Rust target**: `rustup target add aarch64-linux-android` (vía `dtolnay/rust-toolchain` o `rustup target add` directo).
- **Linker**: `CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER` se fija como variable de entorno del job, apuntando a `$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang` (API level = `minSdk` = 24, arquitectura del runner = `linux-x86_64`, a diferencia de `windows-x86_64` en `.cargo/config.toml` local). Las variables de entorno de Cargo tienen prioridad sobre `.cargo/config.toml`, así que el fichero local no se toca y sigue funcionando igual en Windows.

### 4. Verificación del APK antes de publicarlo (mismo comando ya documentado en memoria)
Tras `pnpm tauri android build`, un paso adicional hace `unzip -p <apk> assets/index.html` y compara el hash del `<script src>` contra `dist/index.html` recién generado — el mismo comando que `memory/context.md` ya documenta para detectar un APK con frontend desactualizado. En CI el riesgo es menor (checkout limpio, sin estado de builds anteriores) pero es una comprobación barata que evita repetir exactamente el mismo error ya documentado, y sirve de red de seguridad si algún día se paraleliza o cachea el paso de build de forma que reintroduzca el problema.

### 5. Nombre del asset del Release incluye el tag, `versionCode`/firma no se tocan
El `.apk` generado se renombra a `moto-routes-<tag>-arm64-debug.apk` (p. ej. `moto-routes-v0.2.0-arm64-debug.apk`) al subirlo como asset — así queda claro qué versión es sin abrir el APK. Internamente `versionCode`/`versionName` del manifest no se parchean (ver Non-Goals) y la firma sigue siendo el keystore de debug generado por Gradle en ese runner efímero — distinto en cada release.
Se usa `softprops/action-gh-release@v2` (acción de la comunidad estándar para crear el Release y adjuntar assets desde un workflow, ampliamente usada) en vez de scriptear `gh release create` a mano — menos código propio que mantener para algo ya resuelto.

## Risks / Trade-offs

- **[Riesgo] Un release nuevo puede no instalarse encima de uno anterior** (`INSTALL_FAILED_UPDATE_INCOMPATIBLE` por firma de debug distinta en cada runner) → Mitigación: ya aceptado explícitamente por el usuario (ver proposal.md, Fuera de alcance). Documentar en la propia descripción del Release de GitHub: "puede requerir desinstalar la versión anterior".
- **[Riesgo] La imagen de `ubuntu-latest` cambia sus versiones preinstaladas sin aviso de GitHub** → Mitigación: se instalan explícitamente las versiones exactas necesarias (NDK 29.0.13846066, platform 36) en vez de asumir lo que ya trae la imagen — determinista independientemente de qué cambie GitHub.
- **[Riesgo] `Swatinem/rust-cache` puede servir una caché de un `target/` de una plataforma distinta si se reutiliza entre `quality-tauri` (compila para host) y `build-and-release` (cross-compila a Android)** → Mitigación: son jobs distintos, cada uno con su propio scope de caché por defecto (la acción ya incluye el nombre del job en la clave de caché); no hace falta configuración manual adicional.
- **[Riesgo] Cache de Android SDK/NDK corrupta o parcial tras una interrupción** → Mitigación: `actions/cache` es atómico (solo se guarda al final si el job completa el paso de guardado), no debería quedar un estado a medias; si ocurre, se soluciona invalidando la clave de caché (cambiar la versión de NDK en la clave).
- **[Riesgo] Tests de Cypress en `ubuntu-latest` pueden comportarse distinto que en Windows local (timeouts, rendering)** → Mitigación: decisión ya tomada con el usuario de no ajustar umbrales de antemano — si falla algo específico de Linux, se investiga como señal real, no se relaja el gate preventivamente (ver proposal.md / conversación previa).

## Migration Plan

1. Crear `.github/workflows/ci.yml` con los 3 jobs.
2. Verificar `quality-ts`/`quality-tauri` en una PR real (esta misma, `feature/ci-cd-pipeline` → `master`) antes de intentar el job de release — son los de menor riesgo y most valor inmediato.
3. Verificar `build-and-release` empujando un tag de prueba (p. ej. `v0.0.1-test`) desde una rama aparte, revisar el Release generado, y borrar el tag/release de prueba antes de mergear si algo no queda como se espera.
4. Sin rollback especial: si el workflow falla, es un fichero YAML nuevo sin efecto sobre el código de la app — revertir el commit basta.

## Open Questions

- Ninguna que cambie el alcance o las tasks — las decisiones de firma, OS del runner, trigger del release y umbrales ya se cerraron con el usuario antes de escribir esta propuesta.
