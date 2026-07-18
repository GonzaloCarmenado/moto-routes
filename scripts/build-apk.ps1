# build-apk.ps1
# Script completo para compilar APK de Moto Routes
# Maneja el workaround del symlink en Windows automaticamente
# v2 - Forza limpieza completa y copia de assets frontend

$ErrorActionPreference = "Stop"
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:NDK_HOME = "$env:ANDROID_HOME\ndk\29.0.13846066"
$env:TOOLCHAIN = "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:TOOLCHAIN\bin;$env:Path"

# Variables de cross-compilacion Android
${env:CC_aarch64-linux-android} = "$env:TOOLCHAIN\bin\aarch64-linux-android34-clang.cmd"
${env:AR_aarch64-linux-android} = "$env:TOOLCHAIN\bin\llvm-ar.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Moto Routes - Build APK Completo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 0. Incrementar versionCode para evitar cache de Android
Write-Host "`nIncrementando versionCode..." -ForegroundColor Yellow
$propsPath = "src-tauri/gen/android/app/tauri.properties"
$props = Get-Content $propsPath
$line = $props | Select-String "tauri.android.versionCode=" | Select-Object -First 1
$match = [regex]::Match($line, "\d+")
$currentCode = [int]$match.Value
$newCode = [int]$currentCode + 1
$props = $props -replace "tauri.android.versionCode=\d+", "tauri.android.versionCode=$newCode"
Set-Content $propsPath $props
Write-Host "  versionCode: $currentCode -> $newCode" -ForegroundColor Green

# 1. Limpiar y rebuild frontend
Write-Host "`nLimpiando dist/..." -ForegroundColor Yellow
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  dist/ cleaned" -ForegroundColor Green

Write-Host "Building frontend..." -ForegroundColor Yellow
pnpm build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
Write-Host "  Frontend OK" -ForegroundColor Green

# 2. Build Rust para Android
Write-Host "`nBuilding Rust (aarch64)..." -ForegroundColor Yellow
Push-Location src-tauri
cargo build --target aarch64-linux-android
if ($LASTEXITCODE -ne 0) { throw "Rust build failed" }
Pop-Location
Write-Host "  Rust OK" -ForegroundColor Green

# 3. Copiar .so a jniLibs
Write-Host "`nCopying libapp_lib.so..." -ForegroundColor Yellow
Copy-Item "src-tauri\target\aarch64-linux-android\debug\libapp_lib.so" `
  "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so" -Force
Write-Host "  .so copied" -ForegroundColor Green

# 4. COPIAR FRONTEND ASSETS al directorio de Android
Write-Host "`nCopiando frontend assets a Android assets..." -ForegroundColor Yellow
$androidAssetsDir = "src-tauri\gen\android\app\src\main\assets"
Remove-Item -Path "$androidAssetsDir\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "dist\*" -Destination $androidAssetsDir -Recurse -Force

# Escribir tauri.conf.json correcto (SIN devUrl para que cargue local, no desde servidor)
$tauriConfig = @'
{
  "identifier": "com.motoroutes.app",
  "build": {
    "frontendDist": "."
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Moto Routes",
        "width": 400,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "url": "index.html"
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; font-src 'self'"
    }
  },
  "bundle": {
    "android": {
      "minSdkVersion": 24
    }
  }
}
'@
Set-Content -Path "$androidAssetsDir\tauri.conf.json" -Value $tauriConfig
Write-Host "  Frontend assets copiados + tauri.conf.json (standalone)" -ForegroundColor Green

# 5. Limpiar cache de Kotlin daemon
Write-Host "`nCleaning Kotlin daemon cache..." -ForegroundColor Yellow
Push-Location src-tauri\gen\android
.\gradlew --stop 2>$null
Remove-Item -Path ".gradle" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "app\build" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  Cache cleaned" -ForegroundColor Green

# 6. Build APK con Gradle (sin tareas Rust que ya compilamos manualmente)
Write-Host "`nBuilding APK..." -ForegroundColor Yellow
.\gradlew :app:assembleArm64Debug --no-daemon `
  -x :app:rustBuildArm64Debug `
  -x :app:rustBuildArmDebug `
  -x :app:rustBuildX86Debug `
  -x :app:rustBuildX86_64Debug
if ($LASTEXITCODE -ne 0) { throw "APK build failed" }
Pop-Location

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  APK generado con exito!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nAPK: src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk"

# 7. Instalar si hay dispositivo
$devices = adb devices | Where-Object { $_ -match "device$" }
if ($devices) {
    Write-Host "`nInstalando en dispositivo..." -ForegroundColor Yellow
    adb install -r "src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  App instalada correctamente" -ForegroundColor Green
        Write-Host "  Abre 'Moto Routes' en tu movil y pruebala." -ForegroundColor Cyan
    } else {
        Write-Host "  No se pudo instalar. Conecta el movil por USB con depuracion activada." -ForegroundColor Yellow
        Write-Host "  Luego ejecuta:" -ForegroundColor Yellow
        Write-Host "  adb install src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk" -ForegroundColor White
    }
} else {
    Write-Host "`nNo hay dispositivos Android conectados." -ForegroundColor Yellow
    Write-Host "  Conecta tu movil por USB y ejecuta:" -ForegroundColor Yellow
    Write-Host "  adb install src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk" -ForegroundColor White
}