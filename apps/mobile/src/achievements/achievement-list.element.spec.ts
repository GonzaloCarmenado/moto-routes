import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemorySessionRepository } from '../shared/repositories/memory-session.repository.js';
import { fetchAchievements } from '../shared/http/achievement-api.service.js';
import type * as AchievementApiService from '../shared/http/achievement-api.service.js';
import type { AchievementProgress } from '../shared/models/achievement.types.js';
import './achievement-list.element.js';

vi.mock('../shared/http/achievement-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AchievementApiService>();
  return { ...actual, fetchAchievements: vi.fn().mockResolvedValue([]) };
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mountWithSession(): Promise<{ el: HTMLElement; root: ShadowRoot }> {
  const sessionRepository = new MemorySessionRepository();
  await sessionRepository.save({ token: 'jwt-token', email: 'me@example.com' });

  const el = document.createElement('achievement-list') as HTMLElement & { sessionRepository: MemorySessionRepository };
  document.body.appendChild(el);
  el.sessionRepository = sessionRepository;
  await flush();

  return { el, root: el.shadowRoot! };
}

async function mountWithoutSession(): Promise<{ el: HTMLElement; root: ShadowRoot }> {
  const sessionRepository = new MemorySessionRepository();

  const el = document.createElement('achievement-list') as HTMLElement & { sessionRepository: MemorySessionRepository };
  document.body.appendChild(el);
  el.sessionRepository = sessionRepository;
  await flush();

  return { el, root: el.shadowRoot! };
}

function makeProgress(overrides?: Partial<AchievementProgress>): AchievementProgress {
  return {
    achievement: {
      id: 1, key: 'total_km_100', requirementType: 'total_distance_km', threshold: 100,
      title: '100 km recorridos', description: 'Has superado los 100 km acumulados en tus rutas.', icon: 'default',
    },
    achievedAt: null,
    current: 0,
    ...overrides,
  };
}

describe('achievement-list', () => {
  afterEach(() => {
    document.body.querySelectorAll('achievement-list').forEach((el) => { el.remove(); });
    vi.clearAllMocks();
  });

  it('sin sesión activa, no llama al backend y muestra el aviso de inicio de sesión', async () => {
    const { root } = await mountWithoutSession();

    expect(fetchAchievements).not.toHaveBeenCalled();
    expect(root.querySelector('[data-cy="achievement-list-login-required"]')).not.toBeNull();
  });

  it('con sesión y sin ninguna ruta sincronizada, todos los logros aparecen pendientes con progreso en cero', async () => {
    vi.mocked(fetchAchievements).mockResolvedValue([makeProgress({ current: 0 })]);

    const { root } = await mountWithSession();

    expect(root.querySelector('[data-cy="achievement-list-empty-conseguidos"]')).not.toBeNull();
    const card = root.querySelector('[data-cy="achievement-list-card-pendiente"]');
    expect(card?.querySelector('[data-cy="achievement-list-status"]')?.textContent).toBe('0.0/100 km');
  });

  it('los logros conseguidos muestran su fecha; los pendientes muestran progreso actual/umbral', async () => {
    vi.mocked(fetchAchievements).mockResolvedValue([
      makeProgress({
        achievement: {
          id: 1, key: 'total_km_100', requirementType: 'total_distance_km', threshold: 100,
          title: '100 km recorridos', description: 'desc', icon: 'default',
        },
        achievedAt: '2026-08-10T10:00:00.000Z',
        current: 100,
      }),
      makeProgress({
        achievement: {
          id: 2, key: 'total_km_500', requirementType: 'total_distance_km', threshold: 500,
          title: '500 km recorridos', description: 'desc', icon: 'default',
        },
        achievedAt: null,
        current: 320,
      }),
    ]);

    const { root } = await mountWithSession();

    const achievedCard = root.querySelector('[data-cy="achievement-list-card-conseguido"]');
    expect(achievedCard?.querySelector('[data-cy="achievement-list-status"]')?.textContent).toContain('Conseguido el');

    const pendingCard = root.querySelector('[data-cy="achievement-list-card-pendiente"]');
    expect(pendingCard?.querySelector('[data-cy="achievement-list-status"]')?.textContent).toBe('320.0/500 km');
  });

  it('un fallo de red al cargar el catálogo se trata como lista vacía, sin lanzar', async () => {
    vi.mocked(fetchAchievements).mockRejectedValue(new Error('network down'));

    const { root } = await mountWithSession();

    expect(root.querySelector('[data-cy="achievement-list-empty-conseguidos"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="achievement-list-empty-pendientes"]')).not.toBeNull();
  });
});
