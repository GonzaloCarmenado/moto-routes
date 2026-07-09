# build-apk.ps1
# Script completo para compilar APK de Moto Routes
# Maneja el workaround del symlink en Windows automáticamente

$ErrorActionPreference = "Stop"
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Moto Routes - Build APK Completo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Build frontend
Write-Host "`n📦 Building frontend..." -ForegroundColor Yellow
pnpm build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
Write-Host "✅ Frontend OK" -ForegroundColor Green

# 2. Build Rust para Android
Write-Host "`n🦀 Building Rust (aarch64)..." -ForegroundColor Yellow
Push-Location src-tauri
cargo build --target aarch64-linux-android
if ($LASTEXITCODE -ne 0) { throw "Rust build failed" }
Pop-Location
Write-Host "✅ Rust OK" -ForegroundColor Green

# 3. Copiar .so a jniLibs
Write-Host "`n📋 Copying libapp_lib.so..." -ForegroundColor Yellow
Copy-Item "src-tauri\target\aarch64-linux-android\debug\libapp_lib.so" `
  "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libapp_lib.so" -Force
Write-Host "✅ .so copied" -ForegroundColor Green

# 4. Limpiar cache de Kotlin daemon (evita error de rutas C: vs D:)
Write-Host "`n🧹 Cleaning Kotlin daemon cache..." -ForegroundColor Yellow
Push-Location src-tauri\gen\android
.\gradlew --stop 2>$null
Remove-Item -Path ".gradle" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "app\build" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✅ Cache cleaned" -ForegroundColor Green

# 5. Build APK con Gradle (sin tareas Rust que dan error)
Write-Host "`n🏗️  Building APK..." -ForegroundColor Yellow
.\gradlew :app:assembleArm64Debug --no-daemon `
  -x :app:rustBuildArm64Debug `
  -x :app:rustBuildArmDebug `
  -x :app:rustBuildX86Debug `
  -x :app:rustBuildX86_64Debug
if ($LASTEXITCODE -ne 0) { throw "APK build failed" }
Pop-Location

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✅ APK generado con éxito!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`n📍 APK: src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk"

# 6. Instalar si hay dispositivo
$devices = adb devices | Where-Object { $_ -match "device$" }
if ($devices) {
    Write-Host "`n📱 Instalando en dispositivo..." -ForegroundColor Yellow
    adb install -r "src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ App instalada correctamente" -ForegroundColor Green
        Write-Host "`nAbre 'Moto Routes' en tu móvil y pruébala." -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  No se pudo instalar. Conecta el móvil por USB con depuración activada." -ForegroundColor Yellow
        Write-Host "   Luego ejecuta:" -ForegroundColor Yellow
        Write-Host "   adb install src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk" -ForegroundColor White
    }
} else {
    Write-Host "`n⚠️  No hay dispositivos Android conectados." -ForegroundColor Yellow
    Write-Host "   Conecta tu móvil por USB y ejecuta:" -ForegroundColor Yellow
    Write-Host "   adb install src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk" -ForegroundColor White
}