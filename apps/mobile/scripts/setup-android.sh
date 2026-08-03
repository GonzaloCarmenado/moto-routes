#!/usr/bin/env bash
#
# Setup Android environment for Moto Routes
# Requisitos previos:
#   - Android Studio (con Android SDK)
#   - Android SDK 34+
#   - NDK (via Android Studio SDK Manager)
#   - Java 17+
#
# Uso: bash scripts/setup-android.sh

set -euo pipefail

echo "========================================"
echo "  Moto Routes - Android Setup"
echo "========================================"
echo ""

# 1. Verificar dependencias
echo "🔍 Verificando dependencias..."

# Java
if ! command -v java &> /dev/null; then
  echo "❌ Java no encontrado. Instala Java 17+"
  exit 1
fi
echo "✅ Java: $(java -version 2>&1 | head -1)"

# Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js no encontrado"
  exit 1
fi
echo "✅ Node: $(node --version)"

# Rust
if ! command -v rustc &> /dev/null; then
  echo "❌ Rust no encontrado"
  exit 1
fi
echo "✅ Rust: $(rustc --version)"

# ANDROID_HOME
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "⚠️  ANDROID_HOME no está definido"
  echo "   Configúralo en tu perfil (.bashrc / .zshrc):"
  echo '   export ANDROID_HOME=$HOME/Android/Sdk'
  echo '   export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin'
  echo ""
  read -rp "   ¿Quieres continuar de todas formas? (s/N): " CONTINUE
  if [ "${CONTINUE:-n}" != "s" ]; then
    exit 1
  fi
else
  echo "✅ ANDROID_HOME: $ANDROID_HOME"
fi

echo ""

# 2. Instalar dependencias npm
echo "📦 Instalando dependencias npm..."
npm install
echo "✅ npm install completado"

# 3. Inicializar Husky
echo "🐶 Inicializando Husky..."
npm run prepare 2>/dev/null || true
echo "✅ Husky listo"

# 4. Inicializar proyecto Android de Tauri
echo "🤖 Inicializando proyecto Android (Tauri)..."
npx tauri android init
echo "✅ Proyecto Android generado en src-tauri/gen/android/"

# 5. Verificar estructura Android
if [ -d "src-tauri/gen/android" ]; then
  echo "✅ Estructura Android verificada"
  echo ""
  echo "📁 src-tauri/gen/android/"
  ls -la src-tauri/gen/android/
else
  echo "❌ Error: no se generó el proyecto Android"
  exit 1
fi

echo ""
echo "========================================"
echo "  ✅ Setup Android completado"
echo "========================================"
echo ""
echo "Próximos pasos:"
echo "  1. Conecta tu dispositivo Android por USB (o inicia un emulador)"
echo "  2. Ejecuta: npm run tauri:android"
echo ""
echo "Para build de producción:"
echo "  npm run tauri:android:build"
echo ""
echo "NOTA: La primera vez puede tardar varios minutos"
echo "      descargando dependencias de Gradle."