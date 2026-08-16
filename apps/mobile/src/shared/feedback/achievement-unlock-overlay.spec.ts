import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { enqueueAchievementUnlock, resetAchievementUnlockQueueForTests } from './achievement-unlock-overlay.element.js';
import type { Achievement } from '../models/achievement.types.js';

function makeAchievement(overrides?: Partial<Achievement>): Achievement {
  return {
    id: 1,
    key: 'total_km_100',
    requirementType: 'total_distance_km',
    threshold: 100,
    title: '100 km recorridos',
    description: 'Has superado los 100 km acumulados en tus rutas.',
    icon: 'default',
    ...overrides,
  };
}

function queryOverlay(): HTMLElement | null {
  const host = document.querySelector('achievement-unlock-overlay');
  return host?.shadowRoot?.querySelector('[data-cy="achievement-unlock-overlay"]') ?? null;
}

describe('enqueueAchievementUnlock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetAchievementUnlockQueueForTests();
    vi.useRealTimers();
  });

  it('muestra la animación inmediatamente si la cola está vacía', () => {
    enqueueAchievementUnlock(makeAchievement());

    const overlay = queryOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelector('[data-cy="achievement-unlock-title"]')?.textContent).toBe('100 km recorridos');
    expect(overlay?.querySelector('[data-cy="achievement-unlock-description"]')?.textContent).toBe(
      'Has superado los 100 km acumulados en tus rutas.',
    );
  });

  it('una segunda llamada mientras la primera sigue visible se encola y se muestra al cerrarse la anterior', () => {
    enqueueAchievementUnlock(makeAchievement({ id: 1, title: 'Primero' }));
    enqueueAchievementUnlock(makeAchievement({ id: 2, title: 'Segundo' }));

    expect(document.querySelectorAll('achievement-unlock-overlay')).toHaveLength(1);
    expect(queryOverlay()?.querySelector('[data-cy="achievement-unlock-title"]')?.textContent).toBe('Primero');

    vi.advanceTimersByTime(4000);

    expect(document.querySelectorAll('achievement-unlock-overlay')).toHaveLength(1);
    expect(queryOverlay()?.querySelector('[data-cy="achievement-unlock-title"]')?.textContent).toBe('Segundo');
  });

  it('un tap en el botón "Continuar" cierra la animación y pasa a la siguiente de la cola sin esperar el auto-cierre', () => {
    enqueueAchievementUnlock(makeAchievement({ id: 1, title: 'Primero' }));
    enqueueAchievementUnlock(makeAchievement({ id: 2, title: 'Segundo' }));

    const dismissBtn = queryOverlay()?.querySelector<HTMLButtonElement>('[data-cy="achievement-unlock-dismiss"]');
    dismissBtn?.click();

    expect(queryOverlay()?.querySelector('[data-cy="achievement-unlock-title"]')?.textContent).toBe('Segundo');
  });

  it('sin más logros en la cola, la animación se cierra sola y no queda ningún overlay en el DOM', () => {
    enqueueAchievementUnlock(makeAchievement());

    vi.advanceTimersByTime(4000);

    expect(document.querySelectorAll('achievement-unlock-overlay')).toHaveLength(0);
  });
});
