#!/usr/bin/env bash
#
# Compila e instala el APK de Moto Routes en el dispositivo Android conectado,
# detectando automaticamente su ABI para pasar el --target correcto a Tauri
# (evita builds "universal" accidentales por olvidar el flag).
#
# Uso: bash scripts/install-android.sh [--debug]
#   --debug   compila en modo debug (por defecto: release, mismo build que CI)

set -euo pipefail

echo "========================================"
echo "  Moto Routes - Install Android"
echo "========================================"
echo ""

# 1. Exactamente un dispositivo conectado
DEVICES=$(adb devices | grep -w "device" || true)

if [ -z "$DEVICES" ]; then
  echo "❌ No hay ningún dispositivo Android conectado (o no está autorizado)."
  echo "   Conecta el móvil por USB con la depuración USB activada, o revisa 'adb devices'."
  exit 1
fi

DEVICE_COUNT=$(echo "$DEVICES" | wc -l | tr -d ' ')
if [ "$DEVICE_COUNT" -gt 1 ]; then
  echo "❌ Hay más de un dispositivo/emulador conectado, no se puede elegir automáticamente:"
  echo "$DEVICES"
  echo "   Desconecta los que no necesites, o adapta este script para aceptar -s <serial>."
  exit 1
fi

SERIAL=$(echo "$DEVICES" | awk '{print $1}')
echo "✅ Dispositivo: $SERIAL"

# 2. ABI del dispositivo -> --target de Tauri
ABI=$(adb -s "$SERIAL" shell getprop ro.product.cpu.abi | tr -d '\r')
case "$ABI" in
  arm64-v8a) TARGET="aarch64" ;;
  armeabi-v7a) TARGET="armv7" ;;
  x86) TARGET="i686" ;;
  x86_64) TARGET="x86_64" ;;
  *)
    echo "❌ ABI desconocida: '$ABI'. No se puede mapear a un --target de Tauri."
    exit 1
    ;;
esac
echo "✅ ABI: $ABI → --target $TARGET"
echo ""

# 3. Build type (release por defecto, igual que el build que publica CI)
BUILD_TYPE="release"
for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    BUILD_TYPE="debug"
  fi
done

echo "🔨 Compilando (pnpm tauri android build --target $TARGET $* | build type: $BUILD_TYPE)..."
pnpm tauri android build --target "$TARGET" "$@"

# 4. Force-sync de los assets frescos y reempaquetado SOLO con Gradle. Gotcha
# documentado en memory/context.md: el copiado de assets de `tauri android build`
# no borra ficheros huerfanos de builds anteriores (p.ej. .map viejos), asi que
# sin este paso el APK instalado puede no reflejar el ultimo `dist/` real (mismo
# patron que el paso "Force-sync" del job build-and-release en ci.yml).
BUILD_TYPE_CAP="$(echo "${BUILD_TYPE:0:1}" | tr '[:lower:]' '[:upper:]')${BUILD_TYPE:1}"
ASSETS_DIR="src-tauri/gen/android/app/src/main/assets"
rm -rf "$ASSETS_DIR/assets"
cp -r dist/assets "$ASSETS_DIR/assets"
cp dist/index.html "$ASSETS_DIR/index.html"
(
  cd src-tauri/gen/android
  ./gradlew "assembleUniversal${BUILD_TYPE_CAP}" \
    -x ":app:rustBuildUniversal${BUILD_TYPE_CAP}" \
    -x ":app:rustBuildArm64${BUILD_TYPE_CAP}" \
    -x ":app:rustBuildArm${BUILD_TYPE_CAP}" \
    -x ":app:rustBuildX86${BUILD_TYPE_CAP}" \
    -x ":app:rustBuildX86_64${BUILD_TYPE_CAP}"
)

# 5. Instalar
APK="src-tauri/gen/android/app/build/outputs/apk/universal/$BUILD_TYPE/app-universal-$BUILD_TYPE.apk"

if [ ! -f "$APK" ]; then
  echo "❌ No se encontró el APK esperado en $APK"
  exit 1
fi

echo ""
echo "📲 Instalando en $SERIAL..."
adb -s "$SERIAL" install -r "$APK"

echo ""
echo "========================================"
echo "  ✅ Instalado: $APK"
echo "========================================"
