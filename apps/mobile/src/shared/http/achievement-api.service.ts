import { fetchJson, ExternalApiError } from './external-api.service.js';
import type { Achievement, AchievementProgress, AchievementRequirementType } from '../models/achievement.types.js';

/** Causa de un fallo al llamar a los endpoints de `/api/achievements`. */
export type AchievementApiErrorKind = 'unauthorized' | 'network' | 'unknown';

/** Error tipado para fallos de los endpoints de logros. */
export class AchievementApiError extends Error {
  constructor(
    public readonly kind: AchievementApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AchievementApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

function toAchievementApiError(err: unknown): AchievementApiError {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'http-error' && err.status !== undefined) {
      const message = (err.body as ApiErrorBody | undefined)?.error ?? err.message;
      return new AchievementApiError(mapStatus(err.status), message);
    }
    if (err.kind === 'network' || err.kind === 'timeout') {
      return new AchievementApiError('network', err.message);
    }
  }
  return new AchievementApiError('unknown', err instanceof Error ? err.message : String(err));
}

function mapStatus(status: number): AchievementApiErrorKind {
  if (status === 401) return 'unauthorized';
  return 'unknown';
}

interface AchievementResponse {
  id: number;
  key: string;
  requirement_type: AchievementRequirementType;
  threshold: number;
  title: string;
  description: string;
  icon: string;
}

interface AchievementProgressResponse {
  achievement: AchievementResponse;
  achieved_at: string | null;
  current: number;
}

function toAchievement(r: AchievementResponse): Achievement {
  return {
    id: r.id,
    key: r.key,
    requirementType: r.requirement_type,
    threshold: r.threshold,
    title: r.title,
    description: r.description,
    icon: r.icon,
  };
}

function toAchievementProgress(r: AchievementProgressResponse): AchievementProgress {
  return {
    achievement: toAchievement(r.achievement),
    achievedAt: r.achieved_at,
    current: r.current,
  };
}

/**
 * `POST /api/achievements/check` — comprueba y otorga los logros que el
 * usuario autenticado cumple, devolviendo solo los recién otorgados en esta
 * llamada (para disparar la animación de desbloqueo, ver design.md Decisión 7
 * de sistema-logros).
 */
export async function checkAchievements(apiBaseUrl: string, token: string): Promise<Achievement[]> {
  try {
    const response = await fetchJson<AchievementResponse[]>(`${apiBaseUrl}/api/achievements/check`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.map(toAchievement);
  } catch (err) {
    throw toAchievementApiError(err);
  }
}

/** `GET /api/achievements` — catálogo completo con el estado del usuario autenticado para cada logro. */
export async function fetchAchievements(apiBaseUrl: string, token: string): Promise<AchievementProgress[]> {
  try {
    const response = await fetchJson<AchievementProgressResponse[]>(`${apiBaseUrl}/api/achievements`, {
      headers: { Authorization: `Bearer ${token}` },
      checkStatus: true,
    });
    return response.map(toAchievementProgress);
  } catch (err) {
    throw toAchievementApiError(err);
  }
}
