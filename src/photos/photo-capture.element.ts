import { BaseElement } from '../shared/base-element.js';
import { PHOTO_CAPTURE_EVENT, type CaptureSource, type PhotoCaptureEventDetail } from './photo-capture.types.js';

const STYLES = `
  @import './photo-capture.element.css';
`;

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
    this.menuEl = this.shadowRoot?.querySelector('[popover]') as HTMLElement | null;
    this.button = this.shadowRoot?.querySelector('.photo-btn') as HTMLElement | null;

    this.button?.addEventListener('click', this.onButtonClick.bind(this));

    // Close menu on outside click
    document.addEventListener('click', this.onOutsideClick.bind(this));

    // Close menu on Escape
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  disconnectedCallback(): void {
    document.removeEventListener('click', this.onOutsideClick.bind(this));
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

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button
        class="photo-btn"
        data-cy="photo-add-button"
        ?disabled="${this._disabled}"
        aria-label="Añadir foto"
        title="Añadir foto"
      >
        ${CAMERA_ICON}
      </button>
      <div popover id="photo-menu" data-cy="photo-menu">
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
    const popover = this.shadowRoot?.querySelector('[popover]') as HTMLElement | null;
    if (!popover) return;

    // Toggle popover open state
    const isOpen = popover.hasAttribute('open');
    if (isOpen) {
      popover.removeAttribute('open');
    } else {
      popover.setAttribute('open', '');

      // Add click listeners to menu items
      const cameraBtn = popover.querySelector('[data-cy="photo-menu-camera"]');
      const galleryBtn = popover.querySelector('[data-cy="photo-menu-gallery"]');

      cameraBtn?.addEventListener('click', () => this.selectSource('camera'), { once: true });
      galleryBtn?.addEventListener('click', () => this.selectSource('gallery'), { once: true });
    }
  }

  private selectSource(source: CaptureSource): void {
    this.closeMenu();

    this.emit<PhotoCaptureEventDetail>(PHOTO_CAPTURE_EVENT, { source });
  }

  private closeMenu(): void {
    const popover = this.shadowRoot?.querySelector('[popover]') as HTMLElement | null;
    popover?.removeAttribute('open');
  }

  private onOutsideClick(event: Event): void {
    if (!this.menuEl?.hasAttribute('open')) return;

    const path = event.composedPath();
    if (!path.includes(this)) {
      this.closeMenu();
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.menuEl?.hasAttribute('open')) {
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