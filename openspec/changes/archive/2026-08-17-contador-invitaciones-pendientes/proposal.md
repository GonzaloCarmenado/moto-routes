## Why

Hoy el botón "Invitaciones" del listado de rutas (`route-list-sharing.ts`, `data-cy="route-list-btn-invitaciones"`) solo cambia de color cuando hay invitaciones recibidas pendientes — sin ningún número. Un usuario con 3 invitaciones pendientes ve la misma señal visual que uno con 1: "hay algo", sin saber cuánto. Primer paso, pequeño y solo dentro de la app, de la mejora de visibilidad de invitaciones acordada con el usuario en sesión de exploración previa a las notificaciones push (cambio aparte y más grande, con Firebase Cloud Messaging, todavía sin empezar — no se mezcla aquí).

## What Changes

- El botón de invitaciones muestra un badge numérico con el recuento real de invitaciones pendientes recibidas, en vez de solo un color activo/inactivo.
- Con más de 9 pendientes, el badge muestra "9+" en vez del número exacto, para no romper el hitbox del icono.
- Sin invitaciones pendientes, el badge no se muestra (mismo comportamiento actual del color inactivo).

## Capabilities

### Modified Capabilities
- `compartir-rutas`: el requirement "El destinatario ve sus invitaciones recibidas pendientes" se amplía — el recuento debe ser visible también fuera de la propia pantalla de invitaciones, en el botón de acceso del listado de rutas.

## Impact

- `apps/mobile/src/routes/list/route-list-sharing.ts` — `hasPendingReceivedInvitations()` (hoy devuelve `boolean`) pasa a devolver el recuento real (`number`); `buildSharingButton()` recibe ese número y construye el badge.
- `apps/mobile/src/routes/list/route-list.element.ts` — `_hasPendingShares` (hoy `boolean`) pasa a `number`; wiring en `fetchAndRender()`/`buildControlsRow()` (vía `route-list-controls.ts`, `ControlsRowOptions.hasPendingShares`).
- `apps/mobile/src/routes/list/route-list-controls.ts` — tipo de `hasPendingShares` en `ControlsRowOptions`.
- `apps/mobile/src/routes/list/route-list.element.css` — estilo del badge numérico, reutilizando el patrón de posicionamiento ya usado por `.favorite-icon--badge` (esquina superior, círculo con borde) para consistencia visual, no un patrón nuevo.
- Sin cambios en `apps/api` — `fetchReceivedInvitations()` ya devuelve el array completo; el recuento es su longitud, no un endpoint nuevo.
- Sin dependencias nuevas.
