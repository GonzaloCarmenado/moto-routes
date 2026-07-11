# Plan: Persistencia de Rutas

## Orden de implementación

La feature se divide en 4 fases secuenciales. Cada fase debe completarse (tests en verde) antes de pasar a la siguiente.

### Fase 1: Modelos de dominio (AC-001 a AC-005)
**Objetivo**: Crear los tipos puros sin dependencias externas.
**Archivos**: Solo `src/shared/models/route.types.ts` + tests de tipo (compilación).

1. Crear `src/shared/models/route.types.ts` con:
   - `Route`, `RoutePoint`, `RouteStop` (entidades con `readonly`)
   - `CreateRoute`, `CreateRoutePoint`, `CreateRouteStop` (tipos de escritura)
   - Enums: `RouteStatus`, `RouteVisibility`, `RouteOrigin`, `StopType`
2. Crear `src/shared/models/index.ts` (barrel export)
3. Verificar que TypeScript compila sin errores con `tsc --noEmit`

**Duración estimada**: 30 min

### Fase 2: Interfaz de repositorio (AC-006 a AC-008)
**Objetivo**: Definir el contrato `IRouteRepository`.
**Archivos**: `src/shared/models/route.repository.ts`

1. Crear `IRouteRepository` con los 6 métodos definidos en AC-007
2. Verificar que la interfaz compila con los modelos de la Fase 1
3. Sin tests unitarios — una interfaz no tiene lógica que testear

**Duración estimada**: 15 min

### Fase 3: Mock de repositorio + Integración con Cockpit (AC-014 a AC-017)
**Objetivo**: Conectar el cockpit con la capa de datos sin depender de SQLite.
**Archivos**: `src/shared/repositories/memory-route.repository.ts`, modificar `cockpit.service.ts`

1. Crear `MemoryRouteRepository` (implementación en memoria para tests y desarrollo web)
   - Usa `Map<string, Route>` para almacenar
   - Implementa todos los métodos de `IRouteRepository`
   - Genera UUIDs con `crypto.randomUUID()`
2. Tests unitarios de `MemoryRouteRepository`:
   - `save()` guarda y devuelve Route con ID generado
   - `getById()` encuentra ruta existente y devuelve null si no existe
   - `getAll()` devuelve array vacío al inicio y poblado tras saves
   - `getPointsByRouteId()` devuelve puntos de una ruta específica (no mezcla rutas)
   - `getStopsByRouteId()` devuelve paradas de una ruta específica
   - `delete()` elimina ruta y sus puntos/paradas asociados
3. Modificar `createCockpitService()` para aceptar `IRouteRepository` como parámetro opcional:
   - Si se proporciona, `stopRecording()` llama a `repository.save()` y mete fallback en localStorage
   - Si no se proporciona, comportamiento actual (sin persistir)
4. Actualizar tests de `cockpit.service.spec.ts`:
   - Test: pasar `MemoryRouteRepository` y verificar que `save()` se llama con los datos correctos
   - Test: error del repositorio no impide devolver metadata (fallback a localStorage)
   - Test: sin repositorio, `stopRecording()` sigue funcionando igual
5. Refactor opcional: eliminar `StorageProvider` del servicio si ya no se usa

**Duración estimada**: 2h

### Fase 4: Implementación SQLite (AC-009 a AC-013)
**Objetivo**: Persistencia real en Android vía Tauri SQL plugin.
**Archivos**: `src/shared/repositories/sqlite-route.repository.ts`

1. Instalar dependencia Tauri SQL: `@tauri-apps/plugin-sql` (si no está ya)
2. Crear `SqliteRouteRepository`:
   - Inicializa la BBDD con tablas `routes`, `route_points`, `route_stops`
   - `save()` usa una transacción SQL
   - Queries parametrizadas
   - Genera UUIDs con `crypto.randomUUID()`
3. Tests unitarios con mock de Tauri SQL (inyectar el objeto Database mockeado):
   - `save()` ejecuta INSERT en las 3 tablas dentro de transacción
   - `save()` hace rollback si algún INSERT falla
   - `getAll()` devuelve rutas ordenadas por fecha descendente
   - `delete()` ejecuta DELETE en las 3 tablas
   - Lanza error descriptivo si SQLite no disponible
4. Verificar que funciona en Tauri Android (test manual o E2E con Cypress)

**Duración estimada**: 3h

### Fase 5: Limpieza y documentación
**Objetivo**: Dejar el código listo para review.

1. Ejecutar `pnpm run lint` → 0 errores
2. Ejecutar `pnpm run test:coverage` → ≥ 70% global, ≥ 80% en archivos nuevos
3. Actualizar `memory/context.md` con el estado del feature
4. Commit y push a rama `feature/persistencia-rutas`

**Duración estimada**: 30 min

---

## Dependencias entre fases

```
Fase 1 (Modelos)
  ↓
Fase 2 (Interfaz)
  ↓
Fase 3 (Mock + Cockpit) ──→ se puede mergear a master aquí (MVP funcional en web)
  ↓
Fase 4 (SQLite) ──→ MVP completo en Android
  ↓
Fase 5 (Limpieza)
```

## Notas
- Las fases 1-3 se pueden desarrollar y probar enteramente en entorno web (sin Android).
- La Fase 4 requiere emulador/dispositivo Android para verificación final.
- Los AC-018 a AC-023 (Supabase y settings) NO se implementan en este plan — son futuros work items.
- No se modifica el componente `cockpit.element.ts` en este feature — solo la capa de datos y el servicio.