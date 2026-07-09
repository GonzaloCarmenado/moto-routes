# Token de Memoria - Sesión de Inicialización

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