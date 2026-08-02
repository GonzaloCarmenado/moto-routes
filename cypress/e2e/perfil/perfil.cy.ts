/// <reference types="cypress" />

import type { Profile } from '../../../src/shared/models/profile.types.js';
import type { Route } from '../../../src/shared/models/route.types.js';

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

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    avatarPath: null,
    name: null,
    vehicleType: null,
    vehicleMake: null,
    vehicleModel: null,
    ...overrides,
  };
}

function openProfile(): void {
  cy.get('[data-cy="nav-perfil"]').click();
  cy.get('profile-view').should('be.visible');
}

/** Selecciona un valor en un `<select>` dentro de Shadow DOM de forma robusta.
 *  Cypress `.select()`/`invoke('val')+trigger('change')` no son fiables cuando el
 *  valor inicial del select es una opción `disabled` placeholder (caso del
 *  selector de tipo recién abierto sin vehículo). `dispatchEvent` nativo replica
 *  exactamente la secuencia que el componente espera (`change` listener). */
function selectValue(dataCy: string, value: string): void {
  cy.get(`[data-cy="${dataCy}"]`).then(($el) => {
    const select = $el[0] as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** Elige una marca en el buscador (sustituye al `<select>` nativo, AC-040): escribe el texto y hace click en la opción exacta. */
function chooseMake(make: string): void {
  cy.get('[data-cy="profile-input-buscar-marca"]').clear().type(make);
  cy.get('[data-cy="profile-marca-options"]').contains('[data-cy="profile-marca-option"]', make).click();
}

describe('Perfil - Navegación, avatar/nombre, vehículo (vPIC) y estadísticas', () => {
  it('navigates to the Profile view from the nav-bar and marks the Perfil button active (AC-035, AC-036)', () => {
    cy.visit('/');
    cy.get('[data-cy="nav-grabar"]').should('have.class', 'nav-item--active');

    openProfile();

    cy.get('[data-cy="nav-perfil"]').should('have.class', 'nav-item--active');
    cy.get('[data-cy="nav-grabar"]').should('not.have.class', 'nav-item--active');
    cy.get('[data-cy="nav-rutas"]').should('not.have.class', 'nav-item--active');
  });

  it('shows the avatar/name placeholders and empty vehicle/stats states for a fresh profile (AC-001..AC-003, AC-015, AC-031)', () => {
    cy.visit('/');
    openProfile();

    cy.get('[data-cy="profile-avatar-placeholder"]').should('exist');
    cy.get('[data-cy="profile-name"]').should('be.visible').and('contain', 'Motorista sin nombre');
    cy.get('[data-cy="profile-vehicle-empty"]').should('be.visible').and('contain', 'Sin vehículo configurado');
    cy.get('[data-cy="profile-stats-empty"]').should('be.visible').and('contain', 'Todavía no hay rutas completadas');
  });

  it('edits the profile (photo + live preview + name) and persists both together (AC-004, AC-005, AC-009)', () => {
    cy.visitWithSeed({ profile: buildProfile({ name: 'Marc' }) });
    openProfile();
    cy.get('[data-cy="profile-name"]').should('contain', 'Marc');

    cy.get('[data-cy="profile-btn-editar-perfil"]').click();

    // Previsualización en vivo: el modal refleja el nombre recién escrito sin guardar (AC-005)
    cy.get('[data-cy="profile-input-nombre"]').clear().type('Marc Nuevo');
    cy.get('[data-cy="profile-name"]').should('contain', 'Marc Nuevo');

    // Cambiar foto desde Galería (mismo patrón Cámara/Galería que <photo-capture>, AC-006)
    cy.get('[data-cy="profile-btn-cambiar-foto"]').click();
    cy.get('[data-cy="profile-menu-galeria"]').click();
    cy.get('[data-cy="photo-capture-input-file"]').selectFile(SAMPLE_PHOTO, { force: true });

    cy.get('[data-cy="profile-btn-guardar-perfil"]').click();

    // El modal se cierra y la vista refleja los datos actualizados, con la foto renderizada (AC-009)
    cy.get('[data-cy="profile-input-nombre"]').should('not.exist');
    cy.get('[data-cy="profile-name"]').should('contain', 'Marc Nuevo');
    cy.get('[data-cy="profile-avatar-editar"] img').should('exist');
  });

  it('cancelling the profile edit persists nothing (AC-011)', () => {
    cy.visitWithSeed({ profile: buildProfile({ name: 'Marc' }) });
    openProfile();

    cy.get('[data-cy="profile-btn-editar-perfil"]').click();
    cy.get('[data-cy="profile-input-nombre"]').clear().type('Otro Nombre');
    cy.get('[data-cy="profile-btn-cancelar-perfil"]').click();

    cy.get('[data-cy="profile-input-nombre"]').should('not.exist');
    cy.get('[data-cy="profile-name"]').should('contain', 'Marc').and('not.contain', 'Otro Nombre');
  });

  it('configures a vehicle from scratch through the vPIC cascade type → make → model, with the make search/curation (AC-016..AC-019, AC-021, AC-040, AC-041)', () => {
    cy.intercept('GET', '**/GetMakesForVehicleType/**', { fixture: 'vpic-makes-motorcycle.json' }).as('getMakes');
    cy.intercept('GET', '**/GetModelsForMake/**', { fixture: 'vpic-models-honda.json' }).as('getModels');

    cy.visitWithSeed({ profile: buildProfile({ name: 'Marc' }) });
    openProfile();

    cy.get('[data-cy="profile-vehicle-empty"]').should('be.visible');
    cy.get('[data-cy="profile-btn-editar-vehiculo"]').click();

    // Selector de tipo siempre visible desde la primera configuración (AC-017)
    cy.get('[data-cy="profile-select-tipo-vehiculo"]').should('be.visible');
    cy.get('[data-cy="profile-input-buscar-marca"]').should('be.disabled');
    cy.get('[data-cy="profile-select-modelo"]').should('be.disabled');

    selectValue('profile-select-tipo-vehiculo', 'motorcycle');
    cy.get('[data-cy="profile-select-tipo-vehiculo"]').should('have.value', 'motorcycle');
    cy.wait('@getMakes');
    cy.get('[data-cy="profile-input-buscar-marca"]').should('not.be.disabled');

    // Sin texto de búsqueda, las marcas conocidas (HONDA, YAMAHA) van antes que las
    // marcas minoritarias del fixture (BAY CITY CHOPPERS, BLUE GHOST CYCLES) (AC-041).
    cy.get('[data-cy="profile-marca-option"]').then(($opts) => {
      const names = $opts.toArray().map((el) => el.textContent);
      expect(names.indexOf('HONDA')).to.be.lessThan(names.indexOf('BAY CITY CHOPPERS'));
      expect(names.indexOf('YAMAHA')).to.be.lessThan(names.indexOf('BLUE GHOST CYCLES'));
    });

    // El buscador filtra la lista sin volver a llamar a vPIC (AC-040)
    cy.get('[data-cy="profile-input-buscar-marca"]').clear().type('blue');
    cy.get('[data-cy="profile-marca-option"]').should('have.length', 1).and('contain', 'BLUE GHOST CYCLES');
    cy.get('@getMakes.all').should('have.length', 1);

    chooseMake('HONDA');
    cy.get('[data-cy="profile-input-buscar-marca"]').should('have.value', 'HONDA');
    cy.wait('@getModels');
    cy.get('[data-cy="profile-select-modelo"]').should('not.be.disabled');
    selectValue('profile-select-modelo', 'CB500X');
    cy.get('[data-cy="profile-select-modelo"]').should('have.value', 'CB500X');

    cy.get('[data-cy="profile-btn-guardar-vehiculo"]').should('not.be.disabled').click();

    // El modal se cierra y "Mi vehículo" muestra el vehículo guardado sin volver a consultar la API (AC-021, AC-024)
    cy.get('[data-cy="profile-select-tipo-vehiculo"]').should('not.exist');
    cy.get('[data-cy="profile-vehicle-summary"]').should('contain', 'Moto · HONDA CB500X');
  });

  it('editing an already-configured vehicle preloads makes/models without the user touching the type select (AC-039)', () => {
    cy.intercept('GET', '**/GetMakesForVehicleType/**', { fixture: 'vpic-makes-motorcycle.json' }).as('getMakes');
    cy.intercept('GET', '**/GetModelsForMake/**', { fixture: 'vpic-models-honda.json' }).as('getModels');

    const profile = buildProfile({
      name: 'Marc',
      vehicleType: 'motorcycle',
      vehicleMake: 'HONDA',
      vehicleModel: 'CB500X',
    });
    cy.visitWithSeed({ profile });
    openProfile();
    cy.get('[data-cy="profile-btn-editar-vehiculo"]').click();

    // Sin tocar el select de tipo: marca y modelo deben llegar ya cargados y seleccionados.
    cy.wait('@getMakes');
    cy.wait('@getModels');
    cy.get('[data-cy="profile-input-buscar-marca"]').should('have.value', 'HONDA');
    cy.get('[data-cy="profile-select-modelo"]').should('not.be.disabled').and('have.value', 'CB500X');
    cy.get('[data-cy="profile-btn-guardar-vehiculo"]').should('not.be.disabled');
  });

  it('changing the vehicle type mid-edit discards make/model and resets the cascade (AC-022)', () => {
    // El fixture de motos se reutiliza también para el endpoint de coches: el contenido
    // es indiferente para esta aserción, que solo comprueba que la marca se recarga y
    // que el modelo vuelve a vacío/deshabilitado al cambiar el tipo.
    cy.intercept('GET', '**/GetMakesForVehicleType/**', { fixture: 'vpic-makes-motorcycle.json' }).as('getMakes');
    cy.intercept('GET', '**/GetModelsForMake/**', { fixture: 'vpic-models-honda.json' }).as('getModels');

    cy.visitWithSeed({ profile: buildProfile({ name: 'Marc' }) });
    openProfile();
    cy.get('[data-cy="profile-btn-editar-vehiculo"]').click();

    selectValue('profile-select-tipo-vehiculo', 'motorcycle');
    cy.wait('@getMakes');
    cy.get('[data-cy="profile-input-buscar-marca"]').should('not.be.disabled');
    chooseMake('HONDA');
    cy.wait('@getModels');
    cy.get('[data-cy="profile-select-modelo"]').should('not.be.disabled');

    // Cambiar a "Coche" a mitad de edición: la marca se recarga y el modelo vuelve a deshabilitado/vacío (AC-022)
    selectValue('profile-select-tipo-vehiculo', 'car');
    cy.get('[data-cy="profile-input-buscar-marca"]').should('not.be.disabled').and('have.value', '');
    cy.get('[data-cy="profile-select-modelo"]').should('be.disabled');
    cy.get('[data-cy="profile-select-modelo"] option:selected').should('have.value', '');
  });

  it('shows an error with retry when vPIC is unreachable and keeps the saved vehicle intact after cancelling (AC-023, AC-025, AC-026)', () => {
    cy.intercept('GET', '**/GetMakesForVehicleType/**', { forceNetworkError: true });

    const profile = buildProfile({
      name: 'Marc',
      vehicleType: 'motorcycle',
      vehicleMake: 'HONDA',
      vehicleModel: 'CB500X',
    });
    cy.visitWithSeed({ profile });
    openProfile();

    cy.get('[data-cy="profile-vehicle-summary"]').should('contain', 'Moto · HONDA CB500X');
    cy.get('[data-cy="profile-btn-editar-vehiculo"]').click();

    // Abrir "Editar vehículo" ya precarga la marca del tipo guardado (AC-017): con
    // vPIC caído, el error aparece de inmediato, sin necesidad de tocar el tipo.
    cy.get('[data-cy="profile-vehicle-status"]').should('be.visible');
    cy.get('[data-cy="profile-btn-reintentar-vehiculo"]').should('be.visible').and('contain', 'Reintentar');

    // Cancelar sin guardar: el vehículo previo queda intacto (AC-023, AC-026)
    cy.get('[data-cy="profile-btn-cancelar-vehiculo"]').click();
    cy.get('[data-cy="profile-select-tipo-vehiculo"]').should('not.exist');
    cy.get('[data-cy="profile-vehicle-summary"]').should('contain', 'Moto · HONDA CB500X');
  });

  it('shows aggregated stats from completed routes only, ignoring active/archived (AC-028, AC-030)', () => {
    const now = Date.now();
    const routes: Route[] = [
      buildSeedRoute({ totalDistance: 20, duration: 3600, avgSpeed: 40, createdAt: new Date(now).toISOString() }),
      buildSeedRoute({ totalDistance: 45, duration: 3600, avgSpeed: 50, createdAt: new Date(now - 60_000).toISOString() }),
      buildSeedRoute({
        totalDistance: 120,
        duration: 3600,
        avgSpeed: 60,
        name: 'Ruta larga',
        createdAt: new Date(now - 120_000).toISOString(),
      }),
      // La ruta active (999 km, fuera de las completadas) no debe influir en ningún cálculo
      buildSeedRoute({ totalDistance: 999, duration: 999, avgSpeed: 99, status: 'active' }),
    ];
    cy.visitWithSeed({ routes });
    openProfile();

    cy.get('[data-cy="profile-stat-km-totales"]').should('contain', '185.0');
    cy.get('[data-cy="profile-stat-num-rutas"]').should('contain', '3');
    cy.get('[data-cy="profile-stat-ruta-mas-larga"]').should('contain', 'Ruta larga').and('contain', '120.0');
    cy.get('[data-cy="profile-stat-vel-media"]').should('contain', '50.0');
    cy.get('[data-cy="profile-stat-tiempo-total"]').should('contain', '3:00:00');
    cy.get('[data-cy="profile-stats-empty"]').should('not.exist');
  });
});