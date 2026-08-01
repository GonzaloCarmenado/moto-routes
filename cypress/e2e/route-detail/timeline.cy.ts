/// <reference types="cypress" />

import type { Route, RoutePoint } from '../../../src/shared/models/route.types.js';
import type { Photo } from '../../../src/shared/models/photo.types.js';

function buildSeedRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    duration: 3600,
    totalDistance: 12.5,
    avgSpeed: 42,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    previewPolyline: null,
    name: `Ruta test ${String(Date.now())}`,
    notes: null,
    ...overrides,
  };
}

/** 2 puntos con velocidad siempre por encima de los 3 km/h del umbral de
 * `detectStop()` (`cockpit.transform.ts`) — ningún tramo queda por debajo,
 * así que no se detecta ninguna parada (AC-035). */
function buildSeedPointsWithoutStops(routeId: string): RoutePoint[] {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), routeId, timestamp: now - 60_000, lat: 41.38, lng: 2.17, alt: 10, speed: 40 },
    { id: crypto.randomUUID(), routeId, timestamp: now, lat: 41.39, lng: 2.18, alt: 12, speed: 45 },
  ];
}

function buildSeedPhoto(routeId: string, capturedAt: string): Photo {
  return {
    id: crypto.randomUUID(),
    routeId,
    filePath: 'photos/seed-0.jpg',
    latitude: null,
    longitude: null,
    capturedAt,
    createdAt: capturedAt,
  };
}

function seedAndOpenDetail(route: Route, options: { points?: RoutePoint[]; photos?: Photo[] } = {}): void {
  cy.visitWithSeed({
    routes: [route],
    ...(options.points ? { points: { [route.id]: options.points } } : {}),
    ...(options.photos ? { photos: options.photos } : {}),
  });
  cy.get('[data-cy="nav-rutas"]').click();
  cy.contains('[data-cy="route-card"]', route.name as string).click();
}

function openTimelineTab(): void {
  cy.get('[data-cy="tab-bar-btn-timeline"]').click();
}

describe('Timeline - Eventos de Salida/Llegada, fotos y estado vacío', () => {
  it('shows the Salida event followed by the Llegada event, in order, for a route without stops (AC-035)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-salida-llegada` });
    const points = buildSeedPointsWithoutStops(route.id);

    seedAndOpenDetail(route, { points });
    openTimelineTab();

    cy.get('[data-cy="route-detail-timeline-evento-salida"]').should('be.visible');
    cy.get('[data-cy="route-detail-timeline-evento-llegada"]').should('be.visible');

    cy.get('[data-cy="route-detail-timeline-evento-salida"]').then(($salida) => {
      cy.get('[data-cy="route-detail-timeline-evento-llegada"]').then(($llegada) => {
        const position = $salida[0]!.compareDocumentPosition($llegada[0]!);
        // eslint-disable-next-line no-bitwise -- comparación estándar de compareDocumentPosition
        expect(position & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(0);
      });
    });
  });

  it('shows a photo event at its chronological position when capturedAt falls within the route time range (AC-036)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-foto-timeline` });
    const points = buildSeedPointsWithoutStops(route.id);
    const photoCapturedAt = new Date(Date.now() - 30_000).toISOString();
    const photo = buildSeedPhoto(route.id, photoCapturedAt);

    seedAndOpenDetail(route, { points, photos: [photo] });
    openTimelineTab();

    cy.get('[data-cy="route-detail-timeline-evento-salida"]').should('be.visible');
    cy.get(`[data-cy="route-detail-timeline-evento-foto-${photo.id}"]`).should('be.visible');
    cy.get('[data-cy="route-detail-timeline-evento-llegada"]').should('be.visible');

    cy.get('[data-cy="route-detail-timeline-evento-salida"]').then(($salida) => {
      cy.get(`[data-cy="route-detail-timeline-evento-foto-${photo.id}"]`).then(($foto) => {
        cy.get('[data-cy="route-detail-timeline-evento-llegada"]').then(($llegada) => {
          const salidaBeforeFoto = $salida[0]!.compareDocumentPosition($foto[0]!);
          const fotoBeforeLlegada = $foto[0]!.compareDocumentPosition($llegada[0]!);
          // eslint-disable-next-line no-bitwise -- comparación estándar de compareDocumentPosition
          expect(salidaBeforeFoto & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(0);
          // eslint-disable-next-line no-bitwise -- comparación estándar de compareDocumentPosition
          expect(fotoBeforeLlegada & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(0);
        });
      });
    });
  });

  it('shows the empty state for a route without GPS points and without photos (AC-037)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-timeline-vacio` });

    seedAndOpenDetail(route);
    openTimelineTab();

    cy.get('[data-cy="route-detail-timeline-vacio"]').should('be.visible');
    cy.get('[data-cy="route-detail-timeline-evento-salida"]').should('not.exist');
  });
});
