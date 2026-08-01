import { BaseElement } from '../base-element.js';
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
    return ['disabled', 'loading', 'limit-reached'];
  }

  private _disabled = false;
  private _loading = false;
  private _limitReached = false;
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
    this.updateButtonState();
  }

  /** Mientras es true, el botón queda deshabilitado y muestra un spinner en vez del
   * icono de cámara — feedback de que la foto se está guardando (evita que parezca
   * que la subida no ha hecho nada). */
  get loading(): boolean {
    return this._loading;
  }

  set loading(val: boolean) {
    this._loading = val;
    this.toggleAttribute('loading', val);
    this.updateButtonState();
  }

  /** Distingue "límite de fotos alcanzado" (motivo permanente hasta que se borre una
   * foto) del `disabled` genérico y del `loading` transitorio — cambia el texto
   * accesible del botón sin sobrecargar la semántica de esas otras dos propiedades. */
  get limitReached(): boolean {
    return this._limitReached;
  }

  set limitReached(val: boolean) {
    this._limitReached = val;
    this.toggleAttribute('limit-reached', val);
    this.updateButtonState();
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
      this.updateButtonState();
    } else if (name === 'loading') {
      this._loading = value !== null;
      this.updateButtonState();
    } else if (name === 'limit-reached') {
      this._limitReached = value !== null;
      this.updateButtonState();
    }
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    const disabledAttr = this._disabled ? 'disabled' : '';
    const label = this.buttonLabel();
    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <button
        class="photo-btn"
        data-cy="photo-add-button"
        ${disabledAttr}
        aria-label="${label}"
        title="${label}"
      >
        ${CAMERA_ICON}
        <span class="spinner" aria-hidden="true"></span>
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
    if (this._disabled || this._loading) return;

    event.stopPropagation();
    const menu = this.menuEl;
    if (!menu) return;

    const isOpen = menu.classList.contains('menu-open');
    if (isOpen) {
      menu.classList.remove('menu-open');
    } else {
      // Position menu relative to button (use fixed positioning to avoid overflow)
      const btnRect = this.button?.getBoundingClientRect();
      if (btnRect) {
        const estimatedMenuH = 100; // approximate height of two menu items
        const estimatedMenuW = 180; // matches CSS min-width
        let top = btnRect.top - estimatedMenuH - 4;
        if (top < 4) {
          top = btnRect.bottom + 4; // show below if not enough space above
        }

        // Align to button's left edge by default; flip to the button's right
        // edge only if that would push the menu off the right side of the screen.
        let left = btnRect.left;
        if (left + estimatedMenuW > window.innerWidth - 4) {
          left = Math.max(4, btnRect.right - estimatedMenuW);
        }
        menu.style.cssText += `top:${String(top)}px;left:${String(left)}px;right:auto;bottom:auto;`;
      }

      menu.classList.add('menu-open');

      const cameraBtn = menu.querySelector('[data-cy="photo-menu-camera"]');
      const galleryBtn = menu.querySelector('[data-cy="photo-menu-gallery"]');

      const onCamera = (): void => { this.selectSource('camera'); };
      const onGallery = (): void => { this.selectSource('gallery'); };
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

  private updateButtonState(): void {
    const btn = this.shadowRoot?.querySelector('.photo-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = this._disabled || this._loading;
      btn.classList.toggle('is-loading', this._loading);
      btn.setAttribute('aria-busy', this._loading ? 'true' : 'false');
      const label = this.buttonLabel();
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
    if (this._disabled || this._loading) {
      this.closeMenu();
    }
  }

  /** Texto accesible del botón — distingue "límite alcanzado" del estado habitual,
   * sin depender de `loading`/`disabled` para inferir el motivo. */
  private buttonLabel(): string {
    return this._limitReached ? 'Límite de fotos alcanzado' : 'Añadir foto';
  }
}

customElements.define('photo-capture', PhotoCaptureElement);
