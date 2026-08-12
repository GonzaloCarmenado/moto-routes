## 1. Build web de producción (Vite)

- [x] 1.1 Cambiar `sourcemap: true` a `sourcemap: false` en `apps/mobile/vite.config.ts`.
- [x] 1.2 Ejecutar `pnpm build` y verificar que `dist/` no contiene ningún fichero `.map`; documentar el tamaño de `dist/` antes/después como referencia. **Resultado**: `dist/` pasa de 4.7MB a 1.6MB, 0 ficheros `.map`.

## 2. Build Android release (`src-tauri/gen/android`, ya trackeado en git)

- [x] 2.1 En `build.gradle.kts`, añadir el `signingConfig` de `release` reutilizando el keystore de `debug` ya existente (sin keystore ni secreto nuevo).
- [x] 2.2 Añadir `isShrinkResources = true` al buildType `release`, junto al `isMinifyEnabled` ya existente.
- [x] 2.3 Compilar localmente en modo release single-target (`pnpm tauri android build --target aarch64`, sin `--debug`) y confirmar que genera `.../apk/universal/release/app-universal-release.apk` firmado e instalable. **Gap real encontrado y corregido**: la primera compilación empaquetó 8 `.map` huérfanos por el gotcha de sincronización de assets ya documentado en `memory/context.md` — corregido con force-sync manual (mismo patrón que CI); ver design.md D6.
- [x] 2.4 Instalar el APK release resultante en el dispositivo Android real vía `adb install -r` y verificar manualmente que la app arranca y las funcionalidades existentes (grabación GPS, mapa, registro/subida de fotos) siguen operativas — cubre el escenario de verificación manual de la spec `build-produccion-mobile`. **Confirmado por el usuario en dispositivo real** (`75fe536b`): todo correcto. Verificación automática previa (proceso en foreground, puente JNI Rust↔Kotlin sin excepciones, sin crash en logcat) reforzó la confirmación.
- [x] 2.5 Si 2.4 revela fallos por minificación (reflection, puentes Kotlin↔Rust, callbacks de Play Services Location), añadir las reglas `-keep` necesarias a `src-tauri/gen/android/app/*.pro` y repetir 2.3-2.4. **No aplica**: 2.4 no reveló ningún fallo, `proguard-rules.pro` no necesitó cambios.
- [x] 2.6 Medir el tamaño real del `.so` nativo y del `.apk` release resultante; comparar contra el APK debug actual (~170MB) y documentar la reducción obtenida. **Resultado real**: `.so` nativo 148MB→6.7MB, APK release 9.2MB (0 `.map`) frente a ~170MB del debug publicado hoy — reducción ~95%.
- [ ] 2.7 Crear `apps/mobile/scripts/install-android.sh`: confirma exactamente un dispositivo con `adb devices` (falla con mensaje claro si hay 0 o >1), lee `adb shell getprop ro.product.cpu.abi`, la mapea al `--target` correcto (`arm64-v8a→aarch64`, `armeabi-v7a→armv7`, `x86→i686`, `x86_64→x86_64`) y ejecuta `pnpm tauri android build --target <target>` + `adb install -r <apk resultante>` en un solo paso.
- [ ] 2.8 Añadir el script nuevo a `apps/mobile/package.json` (script `tauri:android:install` o similar) y probarlo contra el dispositivo real conectado.

## 3. Pipeline de CI (`.github/workflows/ci.yml`)

- [x] 3.1 (TDD, en rojo primero) Actualizar `src/shared/ci/ci-workflow.spec.ts` con las nuevas aserciones esperadas — comando de build sin `--debug`, rutas `.../release/...` en force-sync/verify/rename, y el nuevo paso de presupuesto de tamaño — antes de tocar el YAML. **Confirmado en rojo** (5 tests fallando) antes de editar `ci.yml`.
- [x] 3.2 Quitar `--debug` del paso "Build APK" (`pnpm tauri android build --target aarch64`).
- [x] 3.3 Actualizar el paso "Force-sync fresh frontend assets" para reempaquetar con `assembleUniversalRelease` (excluyendo las tareas `rustBuild*Release` ya compiladas, mismo patrón que hoy con `*Debug`).
- [x] 3.4 Actualizar el paso "Verify the APK bundles..." para apuntar a `.../apk/universal/release/app-universal-release.apk`, y añadir una aserción que falle el job si el APK empaquetado contiene algún fichero `.map` entre sus assets.
- [x] 3.5 Actualizar el paso "Rename APK with the release tag" a la nueva ruta release, y el cuerpo del Release publicado (quitar "APK de depuración (sin firma de release)"; mantener la nota de que la firma sigue siendo un keystore efímero por runner, con el mismo caveat de desinstalar antes de actualizar).
- [x] 3.6 Añadir el paso nuevo de presupuesto de tamaño: medir el `.apk` final (bash simple, sin dependencia nueva) y fallar el job si supera un umbral fijado como variable de entorno del workflow (placeholder 60MB, se fija en 4.2 tras medir un release real).
- [x] 3.7 Correr `ci-workflow.spec.ts` en verde tras los cambios de YAML. **35/35 tests en verde.**

## 4. Verificación real end-to-end (release de prueba)

- [ ] 4.1 Publicar un tag de prueba real (mismo patrón que la verificación original de ADR-031) y confirmar en GitHub Actions que `build-and-release` termina en verde, publica el Release con el APK release adjunto, y que el paso de presupuesto de tamaño se ejecuta correctamente.
- [ ] 4.2 Con el tamaño real medido en 4.1/2.6, fijar el valor definitivo del umbral en el workflow (con margen razonable) y documentarlo en el propio YAML.
- [ ] 4.3 Borrar el Release y el tag de prueba tras confirmar (mismo criterio que la verificación original de ADR-031).

## 5. Cierre

- [ ] 5.1 Actualizar `memory/context.md` (sección Build Android) con el tamaño real medido antes/después y el nuevo comportamiento de `build-and-release`.
- [ ] 5.2 Añadir una ADR nueva en `memory/decisions.md` documentando la decisión de reutilizar el signing de debug para el buildType release (sin keystore nuevo) y su relación con ADR-031.
- [ ] 5.3 Revisar el diff completo buscando cualquier string de secreto antes de abrir la PR, aunque no se haya introducido ninguno nuevo (regla de seguridad del proyecto).
