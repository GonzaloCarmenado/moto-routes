import { BaseElement } from '../shared/base-element.js';
import { PHOTO_CAPTURE_EVENT, type CaptureSource, type PhotoCaptureEventDetail } from './photo-capture.types.js';
import styles from './photo-capture.element.css?inline';

/** Icono de cámara SVG */
const CAMERA_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
  <circle cx="12" cy="13" r="4"/>
</svg>`;

/** Icono de cámara para menú */
const CAMERA_MENU_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
  <circle cx="12" cy="13" r="4"/>
</svg>`;

/** Icono de galería para menú */
const GALLERY_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  <circle cx="8.5" cy="8.5" r="1.5"/>
  <polyline points="21 15 16 10 5 21"/>
</svg>`;

export class PhotoCaptureElement extends BaseElement {
  static get observedAttributes(): string[] {
    return ['disabled'];
  }

  private _disabled = false;
  private menuEl: HTMLElement | null = null;
  private button: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  get disabled(): boolean {
    return this._disabled;
  }

  set disabled(val: boolean) {
    this._disabled = val;
    this.toggleAttribute('disabled', val);
    this.updateDisabledState();
  }

  connectedCallback(): void {
    this.render();
    this.menuEl = this.shadowRoot?.querySelector('.photo-menu') as HTMLElement | null;
    this.button = this.shadowRoot?.querySelector('.photo-btn') as HTMLElement | null;

    this.button?.addEventListener('click', this.onButtonClick.bind(this));

    // Close menu on Escape
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'disabled') {
      this._disabled = value !== null;
      this.updateDisabledState();
    }
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    const disabledAttr = this._disabled ? 'disabled' : '';
    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <button
        class="photo-btn"
        data-cy="photo-add-button"
        ${disabledAttr}
        aria-label="Añadir foto"
        title="Añadir foto"
      >
        ${CAMERA_ICON}
      </button>
      <div class="photo-menu" id="photo-menu" data-cy="photo-menu">
        <button
          class="menu-item"
          data-cy="photo-menu-camera"
        >
          ${CAMERA_MENU_ICON}
          Cámara
        </button>
        <button
          class="menu-item"
          data-cy="photo-menu-gallery"
        >
          ${GALLERY_ICON}
          Galería
        </button>
      </div>
    `;
  }

  private onButtonClick(event: Event): void {
    if (this._disabled) return;

    event.stopPropagation();
    const menu = this.menuEl;
    if (!menu) return;

    const isOpen = menu.classList.contains('menu-open');
    if (isOpen) {
      menu.classList.remove('menu-open');
    } else {
      menu.classList.add('menu-open');

      const cameraBtn = menu.querySelector('[data-cy="photo-menu-camera"]');
      const galleryBtn = menu.querySelector('[data-cy="photo-menu-gallery"]');

      const onCamera = () => { this.selectSource('camera'); };
      const onGallery = () => { this.selectSource('gallery'); };
      cameraBtn?.addEventListener('click', onCamera, { once: true });
      galleryBtn?.addEventListener('click', onGallery, { once: true });
    }
  }

  private selectSource(source: CaptureSource): void {
    this.closeMenu();
    this.emit<PhotoCaptureEventDetail>(PHOTO_CAPTURE_EVENT, { source });
  }

  private closeMenu(): void {
    if (this.menuEl) {
      this.menuEl.classList.remove('menu-open');
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.menuEl?.classList.contains('menu-open')) {
      this.closeMenu();
    }
  }

  private updateDisabledState(): void {
    const btn = this.shadowRoot?.querySelector('.photo-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = this._disabled;
    }
    if (this._disabled) {
      this.closeMenu();
    }
  }
}

customElements.define('photo-capture', PhotoCaptureElement);