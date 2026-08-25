import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS } from '../shared/app-events.js';
import styles from './update-banner.element.css?inline';
import type { UpdateCheckResult } from './update-check.types.js';

const NO_UPDATE: UpdateCheckResult = { hasUpdate: false, latestVersion: null, downloadUrl: null };

/**
 * Aviso no bloqueante de actualización disponible. No decide nada sobre la
 * descarga en sí: al pulsar "Descargar" solo despacha `update-download-requested`
 * con la URL/versión (mismo desacoplo ya usado para `route-saved`) — el
 * componente que orqueste la descarga real (grupo 6) escucha ese evento.
 */
export class UpdateBannerElement extends BaseElement {
  private _result: UpdateCheckResult = NO_UPDATE;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set result(value: UpdateCheckResult) {
    this._result = value;
    this.render();
  }

  get result(): UpdateCheckResult {
    return this._result;
  }

  connectedCallback(): void {
    this.render();
  }

  private handleDownloadClick(): void {
    if (!this._result.downloadUrl || !this._result.latestVersion) return;
    this.emit(APP_EVENTS.UPDATE_DOWNLOAD_REQUESTED, {
      downloadUrl: this._result.downloadUrl,
      latestVersion: this._result.latestVersion,
    });
  }

  private buildBanner(): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.setAttribute('data-cy', 'update-banner');
    banner.setAttribute('role', 'status');

    const message = document.createElement('span');
    message.className = 'update-banner__message';
    message.textContent = `Nueva versión disponible: ${this._result.latestVersion ?? ''}`;
    banner.appendChild(message);

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'update-banner__download';
    downloadBtn.setAttribute('data-cy', 'update-banner-download');
    downloadBtn.textContent = 'Descargar';
    downloadBtn.addEventListener('click', () => {
      this.handleDownloadClick();
    });
    banner.appendChild(downloadBtn);

    return banner;
  }

  protected render(): void {
    if (!this._result.hasUpdate) {
      this.renderShadow(styles);
      return;
    }
    this.renderShadow(styles, this.buildBanner());
  }
}

customElements.define('update-banner', UpdateBannerElement);
