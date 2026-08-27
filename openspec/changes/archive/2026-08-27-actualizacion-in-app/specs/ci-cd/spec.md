## ADDED Requirements

### Requirement: El APK release se firma con un keystore de release persistente
El job `build-and-release` de `.github/workflows/ci.yml` SHALL firmar el APK del buildType `release` con un keystore de release persistente, provisto vía GitHub Secrets — SHALL NOT usar el keystore de depuración efímero generado por AGP en cada runner (comportamiento previo, ADR-031/047). El job SHALL fallar explícitamente si el secreto del keystore no está disponible, en vez de recurrir en silencio al keystore de debug.

#### Scenario: Un tag de versión compila y firma con el keystore de release persistente
- **WHEN** se empuja un tag `v*` y el job `build-and-release` compila el buildType `release`
- **THEN** el APK resultante queda firmado con el keystore de release persistente (mismo certificado en todas las releases), no con un keystore de depuración generado en ese runner

#### Scenario: El job falla si falta el secreto del keystore de release
- **WHEN** el job `build-and-release` se ejecuta sin que el GitHub Secret del keystore de release esté configurado
- **THEN** el job termina en rojo antes de publicar ningún Release, en vez de firmar con el keystore de debug como alternativa silenciosa

#### Scenario: Dos releases consecutivas comparten certificado de firma
- **WHEN** se publican dos tags `v*` distintos en ejecuciones separadas del job `build-and-release`
- **THEN** ambos APKs quedan firmados con el mismo certificado, permitiendo que Android acepte instalar el segundo como actualización del primero
- **Nota de verificación**: no automatizable con Vitest/Cypress (depende del keystore real, que no vive en el repo) — se verifica extrayendo y comparando la huella del certificado (`apksigner`/`keytool -printcert`) de dos APKs publicados en tags de prueba consecutivos.
