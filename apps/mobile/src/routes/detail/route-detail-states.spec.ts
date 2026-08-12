import { describe, it, expect } from 'vitest';
import { buildLoadingState, buildEmptyMessage, buildLoadErrorMessage } from './route-detail-states.js';

describe('buildLoadingState', () => {
  it('renders a data-cy loading indicator', () => {
    const el = buildLoadingState();
    expect(el.getAttribute('data-cy')).toBe('route-detail-loading');
    expect(el.textContent).toBe('Cargando ruta…');
  });
});

describe('buildEmptyMessage', () => {
  it('renders "route not found"', () => {
    const el = buildEmptyMessage();
    expect(el.textContent).toBe('Ruta no encontrada');
  });
});

describe('buildLoadErrorMessage', () => {
  it('renders the given message with a data-cy hook, distinct from the generic empty message', () => {
    const el = buildLoadErrorMessage('Sin conexión');
    expect(el.getAttribute('data-cy')).toBe('route-detail-load-error');
    expect(el.textContent).toContain('Sin conexión');
  });
});
