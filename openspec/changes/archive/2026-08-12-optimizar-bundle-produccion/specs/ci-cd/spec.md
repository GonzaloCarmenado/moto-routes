## MODIFIED Requirements

### Requirement: El build y release de Android solo se dispara con un tag de versión
El job `build-and-release` de `.github/workflows/ci.yml` SHALL ejecutarse únicamente cuando se empuja un tag que cumple el patrón `v*` (p. ej. `v0.2.0`) — nunca en un push normal a `master` ni en una PR. SHALL depender (`needs:`) de que `quality-ts` y `quality-tauri` hayan pasado antes de compilar.

#### Scenario: Un push normal a master no dispara el job de release
- **WHEN** se hace push directo de commits a `master` sin ningún tag
- **THEN** el job `build-and-release` no se ejecuta (se salta por su condición `if:`)

#### Scenario: Un tag de versión dispara el job de release
- **WHEN** se empuja un tag que cumple `v*` (p. ej. `git push origin v0.2.0`)
- **THEN** el job `build-and-release` se ejecuta

#### Scenario: El release no compila si los gates de calidad no han pasado
- **WHEN** `quality-ts` o `quality-tauri` para ese mismo commit terminan en rojo
- **THEN** el job `build-and-release` no se ejecuta, por su dependencia `needs: [quality-ts, quality-tauri]`

#### Scenario: El APK resultante se publica como asset del GitHub Release, compilado en modo release optimizado
- **WHEN** el build de Android del job `build-and-release` termina con éxito, compilando el buildType `release` de Android (minificado, con recursos reducidos y el profile `release` de Rust) en vez del buildType `debug` usado hasta ahora
- **THEN** el `.apk` generado queda adjunto como asset descargable en el Release de GitHub asociado al tag
- **Nota de verificación**: requiere confirmarse con un tag real de prueba, mismo patrón que la verificación original de este requirement — no automatizable con Vitest/Cypress.
