## Context

Ver `proposal.md` - Why. El job `build-and-release` de `.github/workflows/ci.yml` ya parchea con `sed` dos ficheros en el checkout efímero del runner (`apps/mobile/index.html`, `apps/mobile/src-tauri/tauri.conf.json`) para inyectar `PROD_API_BASE_URL` antes de compilar, y nunca escribe esos cambios de vuelta al repo. `tauri.conf.json` tiene un único campo `"version": "0.1.0"` (línea 4) — Tauri deriva de ahí tanto `versionName` como `versionCode` de Android al generar `apps/mobile/src-tauri/gen/android/app/tauri.properties` (fichero autogenerado, gitignorado, regenerado en cada build). Confirmado inspeccionando ese fichero tras un build real: `versionCode=1000` para `version: "0.1.0"` — coincide exactamente con la fórmula que usa el propio Tauri CLI para derivar el `versionCode` de Android a partir de un semver (`major*1_000_000 + minor*1_000 + patch`), documentada en la propia herramienta. No hace falta reimplementar esa fórmula: basta con que `version` en `tauri.conf.json` sea el semver correcto antes de que el CLI genere `tauri.properties`.

## Goals / Non-Goals

**Goals:**
- Que el `versionName`/`versionCode` empaquetados en el APK de cada Release reflejen el tag `v*` que la disparó.
- Detectar en CI, no solo a mano, si el `versionName` empaquetado no coincide con el tag (mismo criterio que ya se aplicó para el CSP/host real en ADR-035 punto 8).

**Non-Goals:**
- No se toca el valor por defecto de `tauri.conf.json` en el repo (sigue siendo un placeholder de desarrollo local) — este cambio no decide qué convención de versionado semántico sigue el proyecto a largo plazo, solo que la release publicada sea internamente consistente con su propio tag.
- No se republica ni se corrige retroactivamente ninguna release ya publicada (`v0.1.0`-`v0.1.5`) — quedan con `versionName=0.1.0` tal y como se publicaron, mismo criterio que ADR-036 ("un secret mal formado no se corrige retroactivamente en una release ya publicada").
- No se crea ningún tag ni Release nuevo como parte de este cambio.

## Decisions

**1. Derivar `version` del tag con `sed` sobre `tauri.conf.json`, reutilizando el patrón ya existente, en vez de un mecanismo nuevo.** El job ya extrae `GITHUB_REF`/el tag en el step de firma del nombre del APK ("Rename APK with the release tag"); se añade un step previo a la compilación que toma ese mismo tag, le quita el prefijo `v` (`v0.2.0` → `0.2.0`) y sustituye el valor de `"version"` en `apps/mobile/src-tauri/tauri.conf.json` con `sed`, igual que ya se hace con `connect-src`. Alternativa descartada: pasar `--version` como flag de `tauri android build` — el CLI de Tauri no expone ese override por CLI, solo lee `tauri.conf.json` (y variantes `--config`, ya descartado en ADR-035 punto 7 por no reescribir el CSP empaquetado de Android de todas formas).

**2. No calcular `versionCode` a mano.** Se deja que el propio Tauri CLI lo derive de `version` con su fórmula habitual (confirmado en `tauri.properties` generado: `1000` para `0.1.0`). Alternativa descartada: fijar `versionCode` como el número de build de GitHub Actions (`GITHUB_RUN_NUMBER`) — más simple de generar, pero rompe la relación humana entre el tag y el `versionCode`, y no aporta nada que la fórmula de Tauri no dé ya de forma determinista a partir del tag.

**3. Verificación con `aapt dump badging`, no `grep` sobre el APK.** El `versionName` vive en el `AndroidManifest.xml` binario empaquetado dentro del APK — no es texto plano como el HTML/JS ya verificados con `grep -qF`. El runner ya tiene el Android SDK instalado (necesario para compilar); `aapt` (`build-tools`) expone `versionName='...'` en texto plano vía `aapt dump badging <apk>`. Se añade al step de verificación existente, comparando ese valor contra el tag (sin el prefijo `v`) y fallando el job explícitamente si difieren — mismo criterio de "mejor un release que no se publica que uno publicado roto" ya aplicado en ADR-035 punto 8 para el secret de host.

**4. Sin ADR nueva.** Es una corrección de un mecanismo de CI ya existente (ADR-031/ADR-035 punto 8), no una decisión de arquitectura nueva — se documenta en el propio ADR-045 (ya escrito) como parte de sus consecuencias, sin abrir una ADR dedicada.

## Risks / Trade-offs

- **[Riesgo] Si se publica un tag que no sigue semver estricto (p. ej. `v0.2` sin patch), la sustitución con `sed` podría dejar un `version` inválido para Tauri.** → Mitigación: el propio job ya asume implícitamente el patrón `v*` con semver completo para el nombre del asset (`moto-routes-v0.1.5-arm64-debug.apk`); no se añade validación nueva del formato del tag en este cambio, coherente con que tampoco existía antes para el nombre del asset.
- **[Riesgo] `aapt` podría no estar en el `PATH` del runner por defecto**, mismo tipo de gotcha ya documentado en ADR-031 para `sdkmanager`. → Mitigación: localizar el binario igual que ya se hace para `sdkmanager` (`find` dentro de `$ANDROID_HOME`), no asumir que está en `PATH`.
