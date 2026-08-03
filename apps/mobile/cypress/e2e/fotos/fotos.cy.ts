/// <reference types="cypress" />

import type { Route, RoutePoint } from '../../../src/shared/models/route.types.js';
import type { Photo } from '../../../src/shared/models/photo.types.js';

const SAMPLE_PHOTO = 'cypress/fixtures/photo-sample.jpg';

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

/** 2 puntos con lat/lng distintos: suficiente para que `route-map-container`
 * cargue un mapa real (necesario para que se pinten marcadores de foto, AC-034). */
function buildSeedPoints(routeId: string): RoutePoint[] {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), routeId, timestamp: now - 60_000, lat: 41.38, lng: 2.17, alt: 10, speed: 40 },
    { id: crypto.randomUUID(), routeId, timestamp: now, lat: 41.39, lng: 2.18, alt: 12, speed: 45 },
  ];
}

/** `filePath` con el patrón `photos/seed-N.jpg` — `getPhotoUrl()` lo trata como
 * placeholder y lo devuelve tal cual, sin intentar leer del sistema de archivos
 * (ver `photo-storage.service.ts`). Solo importa el conteo para estos escenarios. */
function buildSeedPhoto(routeId: string, index: number, overrides: Partial<Photo> = {}): Photo {
  return {
    id: crypto.randomUUID(),
    routeId,
    filePath: `photos/seed-${String(index)}.jpg`,
    latitude: null,
    longitude: null,
    capturedAt: new Date(Date.now() - index * 1000).toISOString(),
    createdAt: new Date(Date.now() - index * 1000).toISOString(),
    ...overrides,
  };
}

function buildSeedPhotos(routeId: string, count: number): Photo[] {
  return Array.from({ length: count }, (_, i) => buildSeedPhoto(routeId, i));
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

function openFotosTab(): void {
  cy.get('[data-cy="tab-bar-btn-fotos"]').click();
}

describe('Fotos - Placeholder, alta desde cámara/galería, visor y límite de 100', () => {
  it('shows the placeholder with "Sin fotos" and no thumbnails for a route without photos (AC-029)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-sin-fotos` });

    seedAndOpenDetail(route);
    openFotosTab();

    cy.get('[data-cy="photo-placeholder"]').should('be.visible').and('contain', 'Sin fotos');
    cy.get('[data-cy="photo-thumbnail"]').should('not.exist');
  });

  it('adds a photo from the camera and shows a new thumbnail (AC-030)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-camara` });

    seedAndOpenDetail(route);
    openFotosTab();

    cy.get('[data-cy="photo-add-button"]').click();
    cy.get('[data-cy="photo-menu-camera"]').click();
    cy.get('[data-cy="photo-capture-input-file"]').selectFile(SAMPLE_PHOTO, { force: true });

    cy.get('[data-cy="photo-thumbnail"]').should('have.length', 1);
  });

  it('adds several photos at once from the gallery, one thumbnail per file (AC-031)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-galeria` });

    seedAndOpenDetail(route);
    openFotosTab();

    cy.get('[data-cy="photo-add-button"]').click();
    cy.get('[data-cy="photo-menu-gallery"]').click();
    cy.get('[data-cy="photo-capture-input-file"]').selectFile(
      [SAMPLE_PHOTO, SAMPLE_PHOTO, SAMPLE_PHOTO],
      { force: true },
    );

    cy.get('[data-cy="photo-thumbnail"]').should('have.length', 3);
  });

  it('opens the fullscreen viewer on a thumbnail and closes it back to the grid (AC-032, AC-033)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-visor` });
    const photos = buildSeedPhotos(route.id, 1);

    seedAndOpenDetail(route, { photos });
    openFotosTab();

    cy.get('[data-cy="photo-thumbnail"]').should('have.length', 1).first().click();
    cy.get('[data-cy="photo-viewer-close"]').should('be.visible');

    cy.get('[data-cy="photo-viewer-close"]').click();
    cy.get('[data-cy="photo-viewer-close"]').should('not.exist');
    cy.get('[data-cy="photo-gallery"]').should('be.visible');
    cy.get('[data-cy="photo-thumbnail"]').should('have.length', 1);
  });

  it('shows a marker or cluster on the map for a photo with its own coordinates (AC-034)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-mapa-foto` });
    const points = buildSeedPoints(route.id);
    const photos = [buildSeedPhoto(route.id, 0, { latitude: 41.385, longitude: 2.175 })];

    seedAndOpenDetail(route, { points, photos });

    cy.get('[data-cy="route-map-container"]').should('be.visible');
    cy.get('[data-cy="photo-marker"], [data-cy="photo-cluster"]', { timeout: 20000 }).should('have.length.at.least', 1);
  });

  it('disables the add-photo button with a different accessible text at exactly 100 photos (AC-041, AC-042)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-limite-100` });
    const photos = buildSeedPhotos(route.id, 100);

    seedAndOpenDetail(route, { photos });
    openFotosTab();

    cy.get('[data-cy="photo-add-button"]')
      .should('be.disabled')
      .and('have.attr', 'aria-label', 'Límite de fotos alcanzado')
      .and('have.attr', 'title', 'Límite de fotos alcanzado');
  });

  it('keeps the add-photo button enabled below the limit, e.g. 99 photos (AC-043)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-99-fotos` });
    const photos = buildSeedPhotos(route.id, 99);

    seedAndOpenDetail(route, { photos });
    openFotosTab();

    cy.get('[data-cy="photo-add-button"]')
      .should('not.be.disabled')
      .and('have.attr', 'aria-label', 'Añadir foto');
  });

  it('disables the add-photo button immediately after adding the 100th photo, without reloading (AC-044)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-al-limite` });
    const photos = buildSeedPhotos(route.id, 99);

    seedAndOpenDetail(route, { photos });
    openFotosTab();

    cy.get('[data-cy="photo-add-button"]').should('not.be.disabled');

    cy.get('[data-cy="photo-add-button"]').click();
    cy.get('[data-cy="photo-menu-gallery"]').click();
    cy.get('[data-cy="photo-capture-input-file"]').selectFile(SAMPLE_PHOTO, { force: true });

    cy.get('[data-cy="photo-thumbnail"]').should('have.length', 100);
    cy.get('[data-cy="photo-add-button"]')
      .should('be.disabled')
      .and('have.attr', 'aria-label', 'Límite de fotos alcanzado');
  });

  it('re-enables the add-photo button after deleting a photo from a route at the limit (AC-045)', () => {
    const route = buildSeedRoute({ name: `Ruta test ${String(Date.now())}-rehabilita` });
    const photos = buildSeedPhotos(route.id, 100);

    seedAndOpenDetail(route, { photos });
    openFotosTab();

    cy.get('[data-cy="photo-add-button"]').should('be.disabled');

    cy.get('[data-cy="photo-thumbnail"]').should('have.length', 100).first().click();
    cy.get('[data-cy="photo-viewer-delete"]').click();
    cy.get('[data-cy="confirm-dialog-action-confirm"]').click();

    cy.get('[data-cy="photo-thumbnail"]').should('have.length', 99);
    cy.get('[data-cy="photo-add-button"]')
      .should('not.be.disabled')
      .and('have.attr', 'aria-label', 'Añadir foto');
  });
});
