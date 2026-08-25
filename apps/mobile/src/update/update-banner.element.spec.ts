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

  it('setDownloading shows progress and hides the download button', () => {
    const banner = mount();
    banner.result = { hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' };

    banner.setDownloading({ loaded: 5_000_000, total: 10_000_000 });

    expect(banner.shadowRoot?.querySelector('[data-cy="update-banner-download"]')).toBeNull();
    const progressEl = banner.shadowRoot?.querySelector('[data-cy="update-banner-progress"]');
    expect(progressEl).not.toBeNull();
    expect(progressEl?.textContent).toContain('50%');
  });

  it('setDownloading with an unknown total shows an indeterminate message, not a percentage', () => {
    const banner = mount();
    banner.result = { hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' };

    banner.setDownloading({ loaded: 1000, total: null });

    const progressEl = banner.shadowRoot?.querySelector('[data-cy="update-banner-progress"]');
    expect(progressEl).not.toBeNull();
    expect(progressEl?.textContent).not.toContain('%');
  });

  it('setReadyToInstall shows an install button that emits update-install-requested', () => {
    const banner = mount();
    banner.result = { hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' };
    banner.setReadyToInstall();

    const handler = vi.fn();
    window.addEventListener('update-install-requested', handler);
    banner.shadowRoot?.querySelector<HTMLButtonElement>('[data-cy="update-banner-install"]')?.click();
    window.removeEventListener('update-install-requested', handler);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('setDownloadError shows the message and a retry button that emits update-download-requested again', () => {
    const banner = mount();
    banner.result = { hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' };
    banner.setDownloadError('Sin conexión');

    expect(banner.shadowRoot?.querySelector('.update-banner__error')?.textContent).toContain('Sin conexión');

    const handler = vi.fn();
    window.addEventListener('update-download-requested', handler);
    banner.shadowRoot?.querySelector<HTMLButtonElement>('[data-cy="update-banner-retry"]')?.click();
    window.removeEventListener('update-download-requested', handler);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('a new result resets any downloading/ready/error phase back to idle', () => {
    const banner = mount();
    banner.result = { hasUpdate: true, latestVersion: '0.1.18', downloadUrl: 'https://example.com/apk' };
    banner.setDownloadError('Sin conexión');

    banner.result = { hasUpdate: true, latestVersion: '0.1.19', downloadUrl: 'https://example.com/apk2' };

    expect(banner.shadowRoot?.querySelector('[data-cy="update-banner-download"]')).not.toBeNull();
    expect(banner.shadowRoot?.querySelector('[data-cy="update-banner-retry"]')).toBeNull();
  });
});
