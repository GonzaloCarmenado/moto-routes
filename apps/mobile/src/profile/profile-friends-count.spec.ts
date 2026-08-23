import { describe, it, expect, vi, afterEach } from 'vitest';
import { countPendingFriendRequests } from './profile-friends-count.js';
import { listReceivedRequests } from '../shared/http/friends-api.service.js';
import type * as FriendsApiService from '../shared/http/friends-api.service.js';

vi.mock('../shared/http/friends-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof FriendsApiService>();
  return { ...actual, listReceivedRequests: vi.fn() };
});

describe('countPendingFriendRequests', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 without a session, without calling the API', async () => {
    const result = await countPendingFriendRequests('http://localhost:8080', null);
    expect(result).toBe(0);
    expect(listReceivedRequests).not.toHaveBeenCalled();
  });

  it('returns the real count of received requests', async () => {
    vi.mocked(listReceivedRequests).mockResolvedValue([
      { id: 'fr-1', fromUsername: 'sender1', createdAt: '2026-08-23T10:00:00.000Z' },
      { id: 'fr-2', fromUsername: 'sender2', createdAt: '2026-08-23T10:00:00.000Z' },
    ]);

    const result = await countPendingFriendRequests('http://localhost:8080', { token: 'jwt-token', email: 'me@example.com' });
    expect(result).toBe(2);
  });

  it('returns 0 when the API call fails (best-effort, never breaks the screen)', async () => {
    vi.mocked(listReceivedRequests).mockRejectedValue(new Error('Network error'));

    const result = await countPendingFriendRequests('http://localhost:8080', { token: 'jwt-token', email: 'me@example.com' });
    expect(result).toBe(0);
  });
});
