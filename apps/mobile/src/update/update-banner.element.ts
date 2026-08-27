import { BaseElement } from '../shared/base-element.js';
import { APP_EVENTS } from '../shared/app-events.js';
import styles from './update-banner.element.css?inline';
import type { UpdateCheckResult } from './update-check.types.js';
import type { DownloadProgress } from './update-download.service.js';

const NO_UPDATE: UpdateCheckResult = { hasUpdate: false, latestVersion: null, downloadUrl: null };

/**
 * Fase de la descarga/instalación, independiente de `result` (que solo dice
 * si hay una versión nueva). `ready` cubre tanto "recién descargado" como
 * "instalación ya lanzada": `Intent.ACTION_VIEW` no informa a la app si el
 * usuario canceló o si la instalación falló (Android no lo notifica para este
 * tipo de intent, a diferencia de la API de sesión de `PackageInstaller`, no
 * usada aquí por simplicidad — ver design.md), así que tras pulsar "Instalar"
 * el banner se queda en `ready` sin más: es ya el estado reintentable que
 * pide la spec, sin inventar una fase "instalando" que nunca se resolvería.
 */
type UpdateBannerPhase =
  | { kind: 'idle' }
  | { kind: 'downloading'; progress: DownloadProgress }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

/**
 * Aviso no bloqueante de actualización disponible. No decide nada sobre la
 * descarga/instalación en sí: despacha `update-download-requested`/
 * `update-install-requested` (mismo desacoplo ya usado para `route-saved`) —
 * el orquestador (`app-update-download.ts`, grupo 7) escucha esos eventos y
 * llama de vuelta a `setDownloading()`/`setReadyToInstall()`/`setDownloadError()`.
 */
export class UpdateBannerElement extends BaseElement {
  private _result: UpdateCheckResult = NO_UPDATE;
  private _phase: UpdateBannerPhase = { kind: 'idle' };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set result(value: UpdateCheckResult) {
    this._result = value;
    this._phase = { kind: 'idle' };
    this.render();
  }

  get result(): UpdateCheckResult {
    return this._result;
  }

  /** Progreso de descarga en curso — ver `update-download.service.ts::DownloadProgress`. */
  setDownloading(progress: DownloadProgress): void {
    this._phase = { kind: 'downloading', progress };
    this.render();
  }

  /** Descarga completada — ver el JSDoc de `UpdateBannerPhase` sobre por qué también cubre "instalación ya lanzada". */
  setReadyToInstall(): void {
    this._phase = { kind: 'ready' };
    this.render();
  }

  setDownloadError(message: string): void {
    this._phase = { kind: 'error', message };
    this.render();
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

  private handleInstallClick(): void {
    this.emit(APP_EVENTS.UPDATE_INSTALL_REQUESTED, undefined);
  }

  private buildActionButton(dataCy: string, label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'update-banner__action';
    btn.setAttribute('data-cy', dataCy);
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private buildProgressText(progress: DownloadProgress): HTMLElement {
    const el = document.createElement('span');
    el.className = 'update-banner__progress';
    el.setAttribute('data-cy', 'update-banner-progress');
    if (progress.total) {
      const percent = Math.round((progress.loaded / progress.total) * 100);
      el.textContent = `Descargando… ${String(percent)}%`;
    } else {
      el.textContent = 'Descargando…';
    }
    return el;
  }

  private buildPhaseContent(): HTMLElement[] {
    switch (this._phase.kind) {
      case 'downloading':
        return [this.buildProgressText(this._phase.progress)];
      case 'ready':
        return [
          this.buildActionButton('update-banner-install', 'Instalar', () => {
            this.handleInstallClick();
          }),
        ];
      case 'error': {
        const message = document.createElement('span');
        message.className = 'update-banner__error';
        message.textContent = this._phase.message;
        return [
          message,
          this.buildActionButton('update-banner-retry', 'Reintentar', () => {
            this.handleDownloadClick();
          }),
        ];
      }
      case 'idle':
      default:
        return [
          this.buildActionButton('update-banner-download', 'Descargar', () => {
            this.handleDownloadClick();
          }),
        ];
    }
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

    banner.append(...this.buildPhaseContent());

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
