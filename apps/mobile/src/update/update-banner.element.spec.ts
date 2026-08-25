import { describe, it, expect, vi } from 'vitest';
import './update-banner.element.js';
import type { UpdateBannerElement } from './update-banner.element.js';

describe('update-banner', () => {
  function mount(): UpdateBannerElement {
    const el = document.createElement('update-banner') as UpdateBannerElement;
    document.body.appendChild(el);
    return el;
  }

  it('renders nothing when there is no update available', () => {
    const banner = mount();
    banner.result = { hasUpdate: false, latestVersion: null, downloadUrl: null };

    expect(banner.shadowRoot?.querySelector('[data-cy="update-banner-download"]')).toBeNull();
  });

  it('shows the banner with the new version when an update is available', () => {
    const banner = mount();
    banner.result = { hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' };

    const downloadBtn = banner.shadowRoot?.querySelector('[data-cy="update-banner-download"]');
    expect(downloadBtn).not.toBeNull();
    expect(banner.shadowRoot?.textContent).toContain('0.1.18');
  });

  it('emits update-download-requested with the download URL and version when the download button is clicked', () => {
    const banner = mount();
    banner.result = { hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' };

    const handler = vi.fn();
    window.addEventListener('update-download-requested', handler);
    banner.shadowRoot?.querySelector<HTMLButtonElement>('[data-cy="update-banner-download"]')?.click();
    window.removeEventListener('update-download-requested', handler);

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{ downloadUrl: string; latestVersion: string }>;
    expect(event.detail).toEqual({ downloadUrl: 'https://example.com/apk', latestVersion: '0.1.18' });
  });

  it('going back to no-update hides the banner again', () => {
    const banner = mount();
    banner.result = { hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' };
    banner.result = { hasUpdate: false, latestVersion: null, downloadUrl: null };

    expect(banner.shadowRoot?.querySelector('[data-cy="update-banner-download"]')).toBeNull();
  });
});
