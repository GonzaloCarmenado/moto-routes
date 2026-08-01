# Revisión: Reorganizar dominios cockpit y routes

## 📋 Ficheros Tocados
| Archivo | Tipo | Descripción del cambio |
|---------|------|----------------------|
| `src/cockpit/cockpit-save-route-dialog.element.ts` | MOVIDO + MODIFICADO | Movido a `src/cockpit/save-route-dialog/`; import `../shared/` → `../../shared/` |
| `src/cockpit/cockpit-save-route-dialog.element.css` | MOVIDO + MODIFICADO | Movido a `src/cockpit/save-route-dialog/`; `@import '../shared/` → `'../../shared/` |
| `src/cockpit/cockpit-save-route-dialog.element.spec.ts` | MOVIDO | Movido a `src/cockpit/save-route-dialog/` (import same-dir sin cambios) |
| `src/cockpit/cockpit-stop.service.ts` | MODIFICADO | Import `./cockpit-save-route-dialog.element.js` → `./save-route-dialog/...` |
| `src/routes/route-list.element.ts/.css/.spec` | MOVIDO + MODIFICADO | Movidos a `src/routes/list/`; imports `../shared/` → `../../shared/` |
| `src/routes/route-list.transform.ts/.spec` | MOVIDO | Movidos a `src/routes/list/` (sin imports que cambiar) |
| `src/routes/route-list-polyline.service.ts/.spec` | MOVIDO + MODIFICADO | Movidos a `src/routes/list/`; imports `../shared/` → `../../shared/` |
| `src/routes/route-detail.element.ts/.css/.spec` | MOVIDO + MODIFICADO | Movidos a `src/routes/detail/`; 21 imports `../shared/` → `../../shared/` |
| `src/routes/route-detail.types.ts` | MOVIDO + MODIFICADO | Movido a `src/routes/detail/`; 2 imports `../shared/` → `../../shared/` |
| `src/routes/route-detail-notes.ts` | MOVIDO + MODIFICADO | Movido a `src/routes/detail/`; 4 imports `../shared/` → `../../shared/` |
| `src/routes/route-detail-photo.service.ts/.spec` | MOVIDO + MODIFICADO | Movidos a `src/routes/detail/`; imports actualizados |
| `src/routes/route-detail-timeline.ts/.spec` | MOVIDO + MODIFICADO | Movidos a `src/routes/detail/`; imports actualizados |
| `src/routes/route-timeline.transform.ts/.spec` | MOVIDO + MODIFICADO | Movidos a `src/routes/detail/`; import cruzado `../../cockpit/` |
| `src/routes/route-timeline.types.ts` | MOVIDO | Movido a `src/routes/detail/` (tipos puros, sin imports) |
| `src/app/app.element.ts` | MODIFICADO | Imports `../routes/route-list` → `../routes/list/` y `../routes/detail/` |
| `specs/features/reorganizar-dominios.md` | CREADO | Spec con 8 ACs (organización por vistas) |
| `specs/features/reorganizar-dominios.plan.md` | CREADO | Plan con 3 pasos + URLs de issues GitHub |

## 📝 Resumen de Cambios
- **Reorganización de `src/cockpit/`**: `cockpit-save-route-dialog.*` (element, css, spec) movido a `src/cockpit/save-route-dialog/`. El resto de ficheros del cockpit permanece plano en la raíz porque es UNA pantalla (ventana de grabación) — sus servicios (native-gps, foreground, persist, stop, photo, long-press) son sub-partes de la misma vista.
- **Reorganización de `src/routes/`**: dividido en 2 subcarpetas por vista de aplicación: `list/` (listado: 7 ficheros) y `detail/` (detalle: 12 ficheros). El timeline (pestaña del detalle) vive dentro de `detail/` junto a `route-timeline.transform.ts` y `route-timeline.types.ts`.
- **Imports actualizados**: todos los `../shared/` → `../../shared/` en ficheros movidos a una subcarpeta; el import cruzado `routes → cockpit` (excepción documentada AC-001: `detectStop`) pasa de `../cockpit/` a `../../cockpit/`.
- **Importador externo**: `src/app/app.element.ts` actualizado a `../routes/list/` y `../routes/detail/`.
- **Sin cambios de lógica, CSS ni dependencias**: ficheros movidos "literalmente" con `git mv` (confirmado por git rename detection), solo cambiaron los imports relativos.

## ✅ Cumplimiento de AC
| AC | Estado | Implementación | Test | Notas |
|----|--------|---------------|------|-------|
| AC-001 | ✅ Cumplido | `src/cockpit/save-route-dialog/` + raíz plana | `cockpit-save-route-dialog.element.spec.ts` movido sin cambios | Diálogo agrupado, resto plano (una pantalla) |
| AC-002 | ✅ Cumplido | `src/routes/list/` (7) + `src/routes/detail/` (12) | Specs movidos sin cambios | Ningún fichero suelto en raíz |
| AC-003 | ✅ Cumplido | Imports de cockpit actualizados | `grep` 0 referencias a ruta antigua | Solo `./save-route-dialog/` |
| AC-004 | ✅ Cumplido | Imports de routes actualizados | `grep` 0 referencias a ruta antigua | Todo apunta a `list/`/`detail/` |
| AC-005 | ✅ Cumplido | `../../shared/` en ficheros movidos | `tsc` sin errores, `pnpm build` OK | Import cruzado cockpit a `../../cockpit/` |
| AC-006 | ✅ Cumplido | Refactor sin cambio de comportamiento | **527/527 tests pasan** / `pnpm lint` 0 warnings / `tsc` limpio | Invariante respetado |
| AC-007 | ✅ Cumplido | `data-cy` intactos | Ningún `.element.ts` tocado en selectores | Ningún selector ni atributo modificado |
| AC-008 | ✅ Cumplido | Movimientos "literalmente" | `git status` muestra `R`/`RM` (renamed) | Sin dependencias nuevas, sin lógica tocada |

## 🔴 CRÍTICO

### Seguridad
- ✅ Sin incidencias — refactor estructural puro, sin tocar autenticación, datos ni CSP.

### Componentes Comunes Afectados
- ⚠️ **Ningún fichero de `src/shared/` fue modificado**. Sin embargo, esta feature mueve ficheros que son **consumidos por toda la app** (`cockpit.element.ts`, `route-list.element.ts`, `route-detail.element.ts`, `app.element.ts`), por lo que el impacto es global. Verificado: build Vite OK y APK Android instalado y **probado por el usuario en dispositivo real** (confirmado que funciona).

### Actualizaciones Core
- ✅ Ninguna — no se tocaron TypeScript, Vite, ESLint, Prettier ni dependencias.

### Normas Saltadas
- ✅ Ninguna — se siguió `specs/ui/frontend-conventions.md` (organización por dominio funcional con subniveles por vista) y el patrón de `src/shared/` (cada componente en su carpeta).

## ⚠️ Issues Encontrados
### ISSUE-001: `src/routes/detail/route-timeline.transform.ts` mantiene import cruzado al cockpit (excepción conocida)
- **Severidad**: BAJA
- **AC afectado**: AC-005
- **Descripción**: `route-timeline.transform.ts` (ahora en `detail/`) sigue importando `detectStop` desde `../../cockpit/cockpit.transform.js`. Es la excepción documentada por AC-001 de `specs/features/deuda-tecnica-auditoria.md` (`detectStop` depende de `StopDetectionState`, tipo específico de `cockpit`). No es una desviación — está explícitamente admitida y documentada en el propio archivo.
- **Recomendación**: Mantener como está. Es una excepción ya validada en la feature `deuda-tecnica-auditoria` y el comentario en el código lo documenta explícitamente. Si en el futuro `detectStop` se desacopla de `StopDetectionState`, se movería a `shared/` y se eliminaría la excepción.

## 📊 Veredicto
- [x] **APPROVED** - Los 8 AC cumplidos, sin issues críticos, sin incidencias de seguridad, verificado en dispositivo real por el usuario.