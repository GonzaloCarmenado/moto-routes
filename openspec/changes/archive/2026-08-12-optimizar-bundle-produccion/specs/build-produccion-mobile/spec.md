## Purpose

Define el comportamiento observable del build de producción de la app móvil (web + Android): qué NO debe empaquetarse (sourcemaps), qué optimizaciones deben estar activas en el APK publicado, y cómo se detecta una regresión de tamaño antes de publicar un Release.

## ADDED Requirements

### Requirement: El build web de producción no genera ni empaqueta sourcemaps
El build de producción del frontend (`pnpm build`) SHALL NOT generar ficheros `.map`. El directorio resultante empaquetado por Tauri SHALL NOT contener ningún fichero `.map`.

#### Scenario: El directorio dist de producción no contiene sourcemaps
- **WHEN** se ejecuta el build de producción del frontend
- **THEN** ningún fichero del directorio resultante tiene extensión `.map`

#### Scenario: El APK release no expone sourcemaps
- **WHEN** se inspeccionan los assets empaquetados dentro del APK release publicado
- **THEN** no hay ningún fichero `.map` entre esos assets

### Requirement: El APK publicado en un Release usa el buildType release de Android
El APK que se publica como asset de un GitHub Release SHALL compilarse con el buildType `release` de Android (minificación y ofuscación de código vía R8, eliminación de recursos no usados) en vez del buildType `debug` — SHALL NOT publicarse un build sin minificar como si fuera de producción.

#### Scenario: El código empaquetado está minificado
- **WHEN** se compila el APK que se publica en un Release
- **THEN** el `.apk` resultante tiene el código Kotlin/Java del lado Android minificado/ofuscado por R8 (equivalente a `isMinifyEnabled = true`)

#### Scenario: Los recursos no usados no se empaquetan
- **WHEN** se compila el APK que se publica en un Release
- **THEN** los recursos Android no referenciados no están presentes en el `.apk` resultante (equivalente a `isShrinkResources = true`)

#### Scenario: La biblioteca nativa usa el profile optimizado de Rust
- **WHEN** se compila el APK que se publica en un Release
- **THEN** la biblioteca nativa empaquetada (`libapp_lib.so`) no contiene símbolos de depuración y refleja el profile `release` de Cargo ya definido en el proyecto (LTO activo)

#### Scenario: La app instalada sigue funcionando igual que con el build anterior (verificación manual)
- **WHEN** se instala en un dispositivo Android real, vía `adb install -r`, el APK release resultante de este cambio
- **THEN** la app arranca correctamente y las funcionalidades existentes (grabación GPS, mapa, registro de fotos) siguen operativas
- **Nota**: verificación manual sobre dispositivo real — no automatizable con Vitest/Cypress.

### Requirement: El APK de producción no requiere gestionar un keystore de firma nuevo
El APK release publicado SHALL firmarse reutilizando el mismo mecanismo de firma de depuración ya generado hoy de forma efímera en el runner de CI — SHALL NOT introducir un keystore de release ni ningún secreto de firma nuevo en GitHub Secrets.

#### Scenario: No aparece ningún secreto de firma nuevo
- **WHEN** se audita la configuración de GitHub Secrets del repositorio tras este cambio
- **THEN** no existe ningún secreto nuevo relacionado con la firma del APK (keystore, alias o contraseñas de release)

### Requirement: El tamaño del APK release está sujeto a un presupuesto verificado automáticamente
El proceso de release SHALL comprobar automáticamente, como parte del job `build-and-release`, que el tamaño del APK release generado no supera un umbral máximo documentado — SHALL fallar el job (no solo advertir) si el APK lo supera.

#### Scenario: El umbral se documenta junto al mecanismo que lo aplica
- **WHEN** se revisa la implementación del check de tamaño
- **THEN** el umbral máximo permitido está documentado (en el propio workflow o en la documentación del proyecto), derivado de medir el primer APK release generado tras este cambio

#### Scenario: Un APK que supera el presupuesto bloquea la release
- **WHEN** el APK release compilado en el job `build-and-release` supera el umbral documentado
- **THEN** el job termina en rojo antes de publicar el Release, con un mensaje que indica el tamaño medido y el umbral superado

#### Scenario: Un APK dentro del presupuesto no se bloquea
- **WHEN** el APK release compilado no supera el umbral documentado
- **THEN** el job continúa normalmente y publica el Release
