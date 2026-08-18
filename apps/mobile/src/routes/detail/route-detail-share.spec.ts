import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildShareButton } from './route-detail-share.js';
import { openRouteShareDialog } from './route-share-dialog.element.js';
import type * as RouteShareDialogElement from './route-share-dialog.element.js';

vi.mock('./route-share-dialog.element.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RouteShareDialogElement>();
  return { ...actual, openRouteShareDialog: vi.fn().mockResolvedValue('cancelled') };
});

describe('buildShareButton', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button with data-cy and an accessible label', () => {
    const btn = buildShareButton({ apiBaseUrl: 'http://localhost:8080', session: { token: 'jwt-token', email: 'me@example.com' }, routeId: 'route-1', disabled: false });

    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('data-cy')).toBe('route-detail-btn-compartir');
    expect(btn.getAttribute('aria-label')).toBe('Compartir ruta');
  });

  it('opens the share dialog with the route id, token and own email on click', () => {
    const btn = buildShareButton({ apiBaseUrl: 'http://localhost:8080', session: { token: 'jwt-token', email: 'me@example.com' }, routeId: 'route-1', disabled: false });

    btn.click();

    expect(openRouteShareDialog).toHaveBeenCalledWith({
      apiBaseUrl: 'http://localhost:8080',
      token: 'jwt-token',
      routeId: 'route-1',
      ownEmail: 'me@example.com',
    });
  });

  it('is disabled with a different accessible label while photos are still pending upload', () => {
    const btn = buildShareButton({ apiBaseUrl: 'http://localhost:8080', session: { token: 'jwt-token', email: 'me@example.com' }, routeId: 'route-1', disabled: true });

    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Compartir ruta (subiendo fotos todavía)');
  });

  it('does not open the share dialog when disabled', () => {
    const btn = buildShareButton({ apiBaseUrl: 'http://localhost:8080', session: { token: 'jwt-token', email: 'me@example.com' }, routeId: 'route-1', disabled: true });

    btn.click();

    expect(openRouteShareDialog).not.toHaveBeenCalled();
  });
});
