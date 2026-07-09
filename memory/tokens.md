# Token de Memoria - Sesiones de Trabajo

## Sesión 2 - 2026-07-09: Grabación de Rutas (Cockpit) + Build Android

### Resumen
Implementación completa de la feature Grabación de Rutas (Cockpit) con dial velocímetro, botón START/STOP con long press, pausa, detección automática de paradas, modo invisible, foreground service Android, tests unitarios y E2E. APK compilado e instalado en Realme RMX3301.

### Archivos creados (carpeta cockpit/)
- `src/cockpit/cockpit.types.ts` — Tipos del dominio
- `src/cockpit/cockpit.transform.ts` — Haversine, formatDuration, detectStop
- `src/cockpit/cockpit.transform.spec.ts` — 23 tests
- `src/cockpit/cockpit.service.ts` — Servicio GPS mockeable con estado
- `src/cockpit/cockpit.service.spec.ts` — 11 tests
- `src/cockpit/cockpit.element.ts` — Web Component <cockpit-view>
- `src/cockpit/cockpit.element.css` — Estilos con design tokens

### Otros archivos
- `src-tauri/gen/android/app/src/main/java/com/motoroutes/app/RecordingService.kt`
- `scripts/build-apk.ps1` — Script automatizado de build
- `ruta-corta.gpx` — Ruta de prueba para GPS
- `cypress/e2e/cockpit/cockpit.cy.ts` — Tests E2E

### Comando para compilar (con modo desarrollador activado)
```powershell
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npx tauri android build --debug
```

### Comando para compilar (SIN modo desarrollador - workaround)
```powershell
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
pnpm build
cd src-tauri
cargo build --target aarch64-linux-android
cd ..
Copy-Item "src-tauri\target\aarch64-linux-android\debug\libapp_lib.so" "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so" -Force
cd src-tauri\gen\android
.\gradlew :app:assembleArm64Debug --no-daemon -x :app:rustBuildArm64Debug -x :app:rustBuildArmDebug -x :app:rustBuildX86Debug -x :app:rustBuildX86_64Debug
```

### Para instalar
```powershell
adb -s 75fe536b install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

### APK generado por Tauri
- **Con modo desarrollador**: `apk/universal/debug/app-universal-debug.apk`
- **Sin modo desarrollador**: `apk/arm64/debug/app-arm64-debug.apk`

---

## Sesión 1 - 2026-07-09: Inicialización

### Fecha
2026-07-09

## Fecha
2026-07-09

## Resumen
Inicialización del proyecto moto-routes con Tauri 2 para Android. Se configuró el stack completo (TypeScript + Vite + Web Components + Rust + Tauri) y se logró compilar un APK debug para arm64.

## Problemas Encontrados y Soluciones

### 1. Rust no en PATH
- **Síntoma**: `cargo: command not found`
- **Causa**: `%USERPROFILE%\.cargo\bin` no estaba en el PATH de la sesión
- **Solución**: `$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"`
- **Solución permanente**: Ya se añadió a PATH de usuario vía `[Environment]::SetEnvironmentVariable`

### 2. Symlinks en Windows (Tauri Android)
- **Síntoma**: `Failed to create a symbolic link... Creation symbolic link is not allowed`
- **Causa**: Tauri intenta crear symlinks para los `.so` pero Windows no permite symlinks sin permisos
- **Solución**: Copiar manualmente el `.so`:
  ```powershell
  Copy-Item "src-tauri\target\aarch64-linux-android\debug\libapp_lib.so" `
    "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so" -Force
  ```
- **Mejor solución**: Usar Gradle directamente excluyendo tareas Rust:
  ```powershell
  .\gradlew assembleDebug --no-daemon -x :app:rustBuildArm64Debug -x :app:rustBuildArmDebug -x :app:rustBuildX86Debug -x :app:rustBuildX86_64Debug
  ```

### 3. Kotlin daemon bug (rutas C: vs D:)
- **Síntoma**: `this and base files have different roots: C:\... and D:\...`
- **Causa**: El Kotlin incremental compiler no soporta archivos fuente en distinto disco que el proyecto
- **Solución**: Usar `--no-daemon` + excluir tareas Rust
- **Recomendación**: Si persiste, mover proyecto a `C:\...`

### 4. `npm.bat` no encontrado
- **Síntoma**: `A problem occurred starting process 'command 'npm.bat''`
- **Causa**: Gradle busca `npm.bat` pero solo existe `npm.cmd`
- **Solución**: Cambiar `BuildTask.kt` a `pnpm` en lugar de `npm`

### 5. Tauri targets bundle
- `bundle.targets: "apk"` no es válido en Tauri 2. Debe ser `"all"` y usar `tauri android build`
- `bundle.android.targetSdkVersion` no es válido. Solo `minSdkVersion`

## Comando para Compilar APK (workaround Windows)
```powershell
# Desde la raíz del proyecto:
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

# 1. Compilar frontend + Rust
pnpm build
cd src-tauri && cargo build --target aarch64-linux-android && cd ..

# 2. Copiar .so a jniLibs
Copy-Item "src-tauri\target\aarch64-linux-android\debug\libapp_lib.so" `
  "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so" -Force

# 3. Build APK con Gradle (sin tasks Rust)
cd src-tauri\gen\android
.\gradlew assembleDebug --no-daemon `
  -x :app:rustBuildArm64Debug `
  -x :app:rustBuildArmDebug `
  -x :app:rustBuildX86Debug `
  -x :app:rustBuildX86_64Debug
```

## APK Generado
- **Ruta**: `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`
- **Tamaño**: ~125MB (modo debug, sin optimizar)
- **Arquitectura**: arm64-v8a