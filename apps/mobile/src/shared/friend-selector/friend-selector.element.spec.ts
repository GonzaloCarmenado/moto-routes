import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { searchUsers } from '../http/user-search-api.service.js';
import { resolveUserAvatarUrl } from '../http/avatar-api.service.js';
import { FRIEND_SELECTOR_SELECTED_EVENT } from './friend-selector.element.js';
import './friend-selector.element.js';

vi.mock('../http/user-search-api.service.js', () => ({
  searchUsers: vi.fn(),
}));

vi.mock('../http/avatar-api.service.js', () => ({
  resolveUserAvatarUrl: vi.fn(),
}));

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

type FriendSelectorEl = HTMLElement & { apiBaseUrl: string; token: string; excludeUsername: string | null };

function mount(): { el: FriendSelectorEl; root: ShadowRoot } {
  const el = document.createElement('friend-selector') as FriendSelectorEl;
  document.body.appendChild(el);
  el.apiBaseUrl = 'http://localhost:8080';
  el.token = 'jwt-token';
  return { el, root: el.shadowRoot! };
}

function typeQuery(root: ShadowRoot, value: string): void {
  const input = root.querySelector<HTMLInputElement>('[data-cy="friend-selector-input"]')!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('friend-selector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(resolveUserAvatarUrl).mockResolvedValue(null);
  });

  afterEach(() => {
    document.body.querySelectorAll('friend-selector').forEach((el) => { el.remove(); });
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders the search input', () => {
    const { root } = mount();
    expect(root.querySelector('[data-cy="friend-selector-input"]')).not.toBeNull();
  });

  it('never destroys the input across keystrokes, search results or selection (keeps focus, does not close the keyboard)', async () => {
    vi.mocked(searchUsers).mockResolvedValue(['rider1']);
    const { root } = mount();
    const input = root.querySelector<HTMLInputElement>('[data-cy="friend-selector-input"]')!;
    input.focus();

    for (const char of ['r', 'i', 'd', 'e', 'r']) {
      input.value += char;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(root.querySelector('[data-cy="friend-selector-input"]')).toBe(input);
    expect(root.activeElement).toBe(input);

    await vi.advanceTimersByTimeAsync(300);
    await flush();
    expect(root.querySelector('[data-cy="friend-selector-input"]')).toBe(input);
    expect(root.activeElement).toBe(input);

    root.querySelector<HTMLButtonElement>('[data-cy="friend-selector-result"]')!.click();
    expect(root.querySelector('[data-cy="friend-selector-input"]')).toBe(input);
  });

  it('does not search below the client minimum of 2 characters', async () => {
    const { root } = mount();
    typeQuery(root, 'a');
    await vi.advanceTimersByTimeAsync(300);
    await flush();

    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('lowercases the query as the user types, so uppercase input still finds lowercase usernames', async () => {
    vi.mocked(searchUsers).mockResolvedValue(['rider1']);
    const { root } = mount();
    const input = root.querySelector<HTMLInputElement>('[data-cy="friend-selector-input"]')!;

    input.value = 'RIDER';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(input.value).toBe('rider');
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    expect(searchUsers).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token', 'rider');
  });

  it('debounces the search 300ms after the last keystroke', async () => {
    vi.mocked(searchUsers).mockResolvedValue(['rider1']);
    const { root } = mount();

    typeQuery(root, 'ri');
    await vi.advanceTimersByTimeAsync(100);
    typeQuery(root, 'rid');
    await vi.advanceTimersByTimeAsync(100);
    expect(searchUsers).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await flush();

    expect(searchUsers).toHaveBeenCalledTimes(1);
    expect(searchUsers).toHaveBeenCalledWith('http://localhost:8080', 'jwt-token', 'rid');
  });

  it('shows matching results with username and a placeholder avatar as fallback', async () => {
    vi.mocked(searchUsers).mockResolvedValue(['rider1', 'rider2']);
    const { root } = mount();

    typeQuery(root, 'rider');
    await vi.advanceTimersByTimeAsync(300);
    await flush();

    const results = root.querySelectorAll('[data-cy="friend-selector-result"]');
    expect(results).toHaveLength(2);
    expect(results[0]!.textContent).toContain('rider1');
    expect(results[0]!.querySelector('.result-avatar-placeholder')).not.toBeNull();
  });

  it('shows the uploaded avatar image once resolved', async () => {
    vi.mocked(searchUsers).mockResolvedValue(['rider1']);
    vi.mocked(resolveUserAvatarUrl).mockResolvedValue('blob:rider1-avatar');
    const { root } = mount();

    typeQuery(root, 'rider');
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    await flush();

    const img = root.querySelector<HTMLImageElement>('[data-cy="friend-selector-result"] img.result-avatar');
    expect(img?.src).toBe('blob:rider1-avatar');
  });

  it('excludes excludeUsername from the shown results without a separate network call', async () => {
    vi.mocked(searchUsers).mockResolvedValue(['me', 'rider1']);
    const { el, root } = mount();
    el.excludeUsername = 'me';

    typeQuery(root, 'ri');
    await vi.advanceTimersByTimeAsync(300);
    await flush();

    expect(searchUsers).toHaveBeenCalledTimes(1);
    const results = root.querySelectorAll('[data-cy="friend-selector-result"]');
    expect(results).toHaveLength(1);
    expect(results[0]!.textContent).toContain('rider1');
  });

  it('emits FRIEND_SELECTOR_SELECTED_EVENT with the chosen username on selection', async () => {
    vi.mocked(searchUsers).mockResolvedValue(['rider1']);
    const { el, root } = mount();
    const handler = vi.fn();
    el.addEventListener(FRIEND_SELECTOR_SELECTED_EVENT, handler);

    typeQuery(root, 'rider');
    await vi.advanceTimersByTimeAsync(300);
    await flush();

    const result = root.querySelector<HTMLButtonElement>('[data-cy="friend-selector-result"]')!;
    result.click();

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]![0] as CustomEvent<{ username: string }>;
    expect(event.detail).toEqual({ username: 'rider1' });
  });

  it('shows an empty state when the search has no matches', async () => {
    vi.mocked(searchUsers).mockResolvedValue([]);
    const { root } = mount();

    typeQuery(root, 'ghost');
    await vi.advanceTimersByTimeAsync(300);
    await flush();

    expect(root.querySelector('[data-cy="friend-selector-empty"]')).not.toBeNull();
  });

  it('shows an error state on network failure without blocking further typing', async () => {
    vi.mocked(searchUsers).mockRejectedValue(new Error('network down'));
    const { root } = mount();

    typeQuery(root, 'rider');
    await vi.advanceTimersByTimeAsync(300);
    await flush();

    expect(root.querySelector('[data-cy="friend-selector-error"]')).not.toBeNull();

    const input = root.querySelector<HTMLInputElement>('[data-cy="friend-selector-input"]');
    expect(input?.disabled).not.toBe(true);
  });
});
