# Feature: Persistencia de Rutas (Data Layer)

## Descripción
Capa de datos que permite guardar, consultar y eliminar rutas grabadas desde el cockpit. Todos los modelos son entidades de dominio puras (sin dependencias de infraestructura), tipadas estrictamente en TypeScript y alojadas en `src/shared/models/`. La abstracción del repositorio (`IRouteRepository`) permite que el cockpit y cualquier otro consumidor desconozcan si los datos se almacenan en SQLite local, Supabase remoto o un mock de tests — cumpliendo el principio de inversión de dependencias. La primera implementación concreta es `SqliteRouteRepository` para Android (vía Tauri); Supabase queda documentado como work item futuro. El usuario podrá elegir destino de almacenamiento desde un futuro panel de settings (no bloquea el MVP de persistencia).

## Criterios de Aceptación

### Estructura de modelos
- [ ] AC-001: Los modelos deben vivir en `src/shared/models/` como archivos `.types.ts` independientes, sin dependencias de DOM, Tauri, React ni ningún framework. Tipado estricto: todas las propiedades con tipo explícito, sin `any`, sin `as` innecesario. Las entidades usan `readonly` en propiedades inmutables.
- [ ] AC-002: `Route` (ruta grabada): `id: string` (UUID v4), `createdAt: string` (ISO 8601), `duration: number` (segundos), `totalDistance: number` (km, 2 decimales), `avgSpeed: number` (km/h, 1 decimal), `status: 'active' | 'completed' | 'archived'`, `visibility: 'private' | 'public'`, `origin: 'local' | 'remote'`.
- [ ] AC-003: `RoutePoint` (punto GPS individual): `id: string` (UUID v4), `routeId: string` (FK a Route), `timestamp: number` (epoch ms), `lat: number` (6 decimales), `lng: number` (6 decimales), `alt: number` (metros, 1 decimal), `speed: number` (km/h, 1 decimal).
- [ ] AC-004: `RouteStop` (parada detectada): `id: string` (UUID v4), `routeId: string` (FK a Route), `startTime: number` (epoch ms), `endTime: number | null` (epoch ms, null si sigue activa), `lat: number`, `lng: number`, `type: 'manual' | 'auto'`.
- [ ] AC-005: Los modelos deben exportar también tipos parciales para operaciones de escritura: `CreateRoute` (sin `id` ni `createdAt`), `CreateRoutePoint` (sin `id`), y `CreateRouteStop` (sin `id`). Esto fuerza a que los IDs los genere el repositorio, no el consumidor.

### Interfaz de repositorio
- [ ] AC-006: `IRouteRepository` debe vivir en `src/shared/models/route.repository.ts` y exponer exclusivamente métodos asíncronos que devuelven entidades de dominio, nunca DTOs de infraestructura.
- [ ] AC-007: Métodos de `IRouteRepository`:
  ```
  save(route: CreateRoute, points: CreateRoutePoint[], stops: CreateRouteStop[]): Promise<Route>
  getById(id: string): Promise<Route | null>
  getAll(): Promise<Route[]>
  getPointsByRouteId(routeId: string): Promise<RoutePoint[]>
  getStopsByRouteId(routeId: string): Promise<RouteStop[]>
  delete(id: string): Promise<void>
  ```
- [ ] AC-008: El repositorio debe ser inyectable. El componente que lo use recibe `IRouteRepository` en su constructor/factoría, nunca hace `new SqliteRouteRepository()` internamente.

### Implementación SQLite (MVP)
- [ ] AC-009: `SqliteRouteRepository` implementa `IRouteRepository` y vive en `src/shared/repositories/sqlite-route.repository.ts`.
- [ ] AC-010: El repositorio SQLite genera UUIDs v4 al crear entidades (usando `crypto.randomUUID()`).
- [ ] AC-011: Si SQLite no está disponible (entorno navegador sin Tauri), el repositorio lanza un error descriptivo, no un `undefined` o fallo silencioso.
- [ ] AC-012: Las queries deben usar sentencias parametrizadas (prepared statements) para prevenir inyección SQL. Nada de concatenar strings.
- [ ] AC-013: El repositorio no debe tener dependencia circular con los modelos: los modelos se importan desde `src/shared/models/`, nunca al revés.

### Persistencia desde el Cockpit
- [ ] AC-014: `createCockpitService()` debe aceptar `IRouteRepository` como nuevo parámetro (junto a `GpsProvider` y `StorageProvider`). NUNCA instancia el repositorio por sí mismo.
- [ ] AC-015: Al ejecutar `stopRecording()`, el servicio debe llamar a `repository.save()` con la metadata, los puntos acumulados y las paradas detectadas.
- [ ] AC-016: Si `repository.save()` falla, el cockpit debe devolver `RouteMetadata` de todas formas (la ruta no se pierde en memoria) y adicionalmente almacenar los datos en un buffer de respaldo (`localStorage` o similar) para que el usuario pueda reintentar más tarde.
- [ ] AC-017: El `createCockpitService()` debe funcionar sin repositorio (parámetro opcional). Si no se proporciona, `stopRecording()` devuelve la metadata sin persistir — manteniendo compatibilidad con tests y entornos sin BBDD.

### Configuración de almacenamiento (work item futuro, no bloquea MVP)
- [ ] AC-018 (FUTURO): `StorageSettingsService` expone `getStorageTarget(): 'local' | 'remote'` y `setStorageTarget(target): void`.
- [ ] AC-019 (FUTURO): La app arranca con target `'local'` por defecto.
- [ ] AC-020 (FUTURO): Cambiar de local a remoto no elimina ni migra automáticamente datos existentes; se documenta como operación manual del usuario.

### Supabase (work item futuro, no implementado ahora)
- [ ] AC-021 (FUTURO): `SupabaseRouteRepository` implementa `IRouteRepository` usando `@supabase/supabase-js`.
- [ ] AC-022 (FUTURO): El repo de Supabase usa la anon key pública para queries, y el backend de Supabase aplica RLS (Row Level Security) por usuario autenticado.
- [ ] AC-023 (FUTURO): Se implementa una sincronización bidireccional offline-first: los registros creados sin conexión se encolan y se suben cuando hay red.

## Comportamiento Esperado

### Escenario: Guardar ruta tras grabación (Happy Path)
- **Dado** que el usuario ha grabado una ruta de 15 minutos con 900 puntos GPS
- **Cuando** mantiene pulsado STOP durante 1.5s para finalizar
- **Entonces** `cockpit.service` llama a `repository.save(route, points, stops)`, el repositorio genera UUIDs, inserta 1 fila en `routes`, 900 en `route_points` y 0-N en `route_stops` dentro de una transacción atómica, y el cockpit recibe la metadata con el ID asignado

### Escenario: Error de persistencia sin pérdida de datos
- **Dado** que el repositorio SQLite lanza un error al guardar (disco lleno, corrupción)
- **Cuando** el usuario finaliza la grabación
- **Entonces** `stopRecording()` devuelve la metadata igualmente (los datos siguen en memoria), se guarda una copia en `localStorage` como buffer de emergencia, y se muestra un mensaje de error no bloqueante

### Escenario: Arranque sin repositorio
- **Dado** que la app corre en un navegador de escritorio sin Tauri (desarrollo web)
- **Cuando** se crea `cockpitService` sin pasar `IRouteRepository`
- **Entonces** `stopRecording()` devuelve metadata sin intentar persistir, sin lanzar errores

### Escenario: Obtener listado de rutas guardadas
- **Dado** que existen 5 rutas en SQLite
- **Cuando** se llama a `repository.getAll()`
- **Entonces** devuelve un array de 5 `Route`, ordenadas por fecha descendente, cada una solo con metadatos (sin puntos ni paradas)

### Escenario: Obtener detalle de una ruta
- **Dado** que existe una ruta con ID conocido
- **Cuando** se llama a `repository.getById(id)`, `getPointsByRouteId(id)` y `getStopsByRouteId(id)`
- **Entonces** se obtienen los metadatos, la lista completa de puntos y las paradas asociadas

## Diseño de Modelos

### Ubicación en el proyecto
```
src/shared/models/
├── route.types.ts          # Route, CreateRoute, RoutePoint, CreateRoutePoint,
│                           # RouteStop, CreateRouteStop, StopType, RouteStatus,
│                           # RouteVisibility, RouteOrigin
├── route.repository.ts     # IRouteRepository (interfaz pura)
└── index.ts                # barrel export
```

### Diagrama de dependencias
```
cockpit.service.ts
  ↓ (importa solo la interfaz)
IRouteRepository (src/shared/models/route.repository.ts)
  ↑ (implementa)
SqliteRouteRepository (src/shared/repositories/sqlite-route.repository.ts)
  ↓ (usa)
Route, RoutePoint, RouteStop (src/shared/models/route.types.ts)
```

**Regla**: `cockpit.service.ts` NUNCA importa `SqliteRouteRepository` directamente. Solo conoce la interfaz.

## Notas para la implementación
- Usar `crypto.randomUUID()` para generar IDs (disponible en navegadores modernos y Tauri WebView).
- Las transacciones SQLite se manejan con `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` en el repositorio.
- Los tipos de creación (`CreateRoute`, etc.) son `Omit<Route, 'id' | 'createdAt'>` para mantener una sola fuente de verdad.
- Este feature no incluye UI de listado/detalle — solo la capa de datos. La UI se especificará en features separadas.