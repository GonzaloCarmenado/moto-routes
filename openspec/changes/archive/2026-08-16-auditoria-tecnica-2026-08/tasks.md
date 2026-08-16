## 1. Backend: extraer el trío `writeJSON`/`writeError`/`requireUserID`

- [x] 1.1 Creado `apps/api/internal/apihttp/apihttp.go` con `WriteJSON`, `WriteError`, `RequireUserID`
- [x] 1.2 Test: `RequireUserID` (401 sin auth, userID correcto con `auth.RequireAuth` real) + tests de `WriteJSON`/`WriteError`
- [x] 1.3 `internal/achievements/handler.go` actualizado
- [x] 1.4 `internal/routes/handler.go` actualizado
- [x] 1.5 `internal/routesharing/handler.go` + `accept.go` actualizados (hallazgo real: `accept.go` también tenía sus propias llamadas, no solo `handler.go`)
- [x] 1.6 `internal/photos/handler.go` actualizado
- [x] 1.7 `go test ./...`: 194/194 (15 paquetes), sin cambios de comportamiento en ningún test existente
- [x] 1.8 `gofmt`/`go vet`/`govulncheck` limpios (los ficheros nuevos de `apihttp` están limpios; el resto del repo sigue con el ruido CRLF de Windows ya documentado, preexistente)

## 2. Frontend: extraer `buildBackButton()`

- [x] 2.1 Test: `data-cy` correcto, texto contiene "Volver", callback se llama al click
- [x] 2.2 Creado `apps/mobile/src/shared/back-button.ts` — **hallazgo real durante la extracción**: las 3 implementaciones NO eran idénticas (`route-detail` tenía `<span class="back-btn__arrow">` con su propia regla CSS de tamaño de flecha; `route-sharing`/`achievement-list` usaban `<span>` sin clase) y `route-detail`'s no tenía `data-cy` en absoluto (incumplía la regla del proyecto). El helper siempre incluye la clase `back-btn__arrow` (inocua donde no hay CSS para ella) y se añadió `data-cy="route-detail-btn-volver"` nuevo — sin test de Cypress existente que dependiera de su ausencia, verificado por grep antes de tocarlo
- [x] 2.3 `route-detail.element.ts` actualizado
- [x] 2.4 `route-sharing.element.ts` actualizado
- [x] 2.5 `achievement-list.element.ts` actualizado
- [x] 2.6 188/188 tests de los 3 componentes + helper nuevo en verde

## 3. Frontend: focus-trap + ESC en `achievement-unlock-overlay`

- [x] 3.1 Test: Escape cierra y avanza a la siguiente animación en cola
- [x] 3.2 Test: Tab no saca el foco del overlay (único elemento enfocable — el propio botón "Continuar" — vuelve a sí mismo)
- [x] 3.3 Implementado (`onKeyDown` de instancia, `trapFocus`, `previouslyFocused` guardado en `show()` y restaurado en `dismiss()`, autofoco del botón "Continuar" al mostrarse)
- [x] 3.4 6/6 tests del componente en verde (los 4 ya existentes + los 2 nuevos)

## 4. Verificación end-to-end

- [x] 4.1 `tsc --noEmit` y `eslint src/ --max-warnings 0` limpios
- [x] 4.2 `vitest run --coverage`: 1153/1153, 96.87% líneas/90.67% branches — sin regresión
- [x] 4.3 Cypress completo (backend Docker reconstruido con el código Go nuevo antes de correr): 69/69, sin regresiones
- [x] 4.4 `pnpm audit --audit-level=high` limpio; `cargo audit`/`govulncheck` sin hallazgos nuevos (mismas 2 excepciones ya documentadas)

## 5. Cierre

- [ ] 5.1 Actualizar `memory/context.md` con el resumen de la auditoría
- [ ] 5.2 Confirmar que no se alcanza el umbral de ADR nueva (design.md ya concluye que no)
