import { BaseElement } from '../base-element.js';
import type { GalleryPhoto } from '../photo-gallery/photo-gallery.element.js';
import styles from './photo-viewer.element.css?inline';

const SWIPE_THRESHOLD_PX = 40;

export interface OpenPhotoViewerOptions {
  photos: GalleryPhoto[];
  startIndex: number;
  /** Si se da, muestra un botón de borrar. Debe devolver si se borró de verdad
   * (la confirmación y el borrado real son responsabilidad del llamador). */
  onDelete?: (photo: GalleryPhoto) => Promise<boolean>;
}

class PhotoViewerElement extends BaseElement {
  private photos: GalleryPhoto[] = [];
  private index = 0;
  private onDelete: ((photo: GalleryPhoto) => Promise<boolean>) | undefined;
  private touchStartX: number | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
    else if (event.key === 'ArrowRight') this.showNext();
    else if (event.key === 'ArrowLeft') this.showPrev();
  };

  private readonly onTouchStart = (event: TouchEvent): void => {
    this.touchStartX = event.touches[0]?.clientX ?? null;
  };

  private readonly onTouchEnd = (event: TouchEvent): void => {
    if (this.touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? this.touchStartX;
    const delta = endX - this.touchStartX;
    this.touchStartX = null;
    if (delta <= -SWIPE_THRESHOLD_PX) this.showNext();
    else if (delta >= SWIPE_THRESHOLD_PX) this.showPrev();
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  open(options: OpenPhotoViewerOptions): void {
    this.photos = options.photos;
    this.index = options.startIndex;
    this.onDelete = options.onDelete;
    this.render();
  }

  private close(): void {
    this.remove();
  }

  private showNext(): void {
    if (this.photos.length <= 1) return;
    this.index = (this.index + 1) % this.photos.length;
    this.render();
  }

  private showPrev(): void {
    if (this.photos.length <= 1) return;
    this.index = (this.index - 1 + this.photos.length) % this.photos.length;
    this.render();
  }

  private async handleDeleteClick(): Promise<void> {
    const photo = this.photos[this.index];
    if (!photo || !this.onDelete) return;

    const deleted = await this.onDelete(photo);
    if (!deleted) return;

    this.photos = this.photos.filter((p) => p.id !== photo.id);
    if (this.photos.length === 0) {
      this.close();
      return;
    }
    this.index = Math.min(this.index, this.photos.length - 1);
    this.render();
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.addEventListener('click', () => { this.close(); });
    return overlay;
  }

  private buildCloseButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'close';
    btn.setAttribute('data-cy', 'photo-viewer-close');
    btn.setAttribute('aria-label', 'Cerrar');
    btn.textContent = '✕';
    btn.addEventListener('click', () => { this.close(); });
    return btn;
  }

  private buildDeleteButton(): HTMLButtonElement | null {
    if (!this.onDelete) return null;
    const btn = document.createElement('button');
    btn.className = 'delete';
    btn.setAttribute('data-cy', 'photo-viewer-delete');
    btn.setAttribute('aria-label', 'Eliminar foto');
    btn.textContent = '🗑';
    btn.addEventListener('click', () => { void this.handleDeleteClick(); });
    return btn;
  }

  private buildNavButton(direction: 'prev' | 'next'): HTMLButtonElement | null {
    if (this.photos.length <= 1) return null;
    const btn = document.createElement('button');
    btn.className = `nav nav--${direction}`;
    btn.setAttribute('data-cy', `photo-viewer-${direction}`);
    btn.setAttribute('aria-label', direction === 'next' ? 'Foto siguiente' : 'Foto anterior');
    btn.textContent = direction === 'next' ? '›' : '‹';
    btn.addEventListener('click', () => {
      if (direction === 'next') this.showNext();
      else this.showPrev();
    });
    return btn;
  }

  private buildImage(photo: GalleryPhoto): HTMLImageElement {
    const img = document.createElement('img');
    img.className = 'img';
    img.src = photo.objectUrl;
    img.alt = `Foto ${String(this.index + 1)}`;
    img.addEventListener('touchstart', this.onTouchStart);
    img.addEventListener('touchend', this.onTouchEnd);
    return img;
  }

  private buildCounter(): HTMLElement | null {
    if (this.photos.length <= 1) return null;
    const counter = document.createElement('div');
    counter.className = 'counter';
    counter.textContent = `${String(this.index + 1)} de ${String(this.photos.length)}`;
    return counter;
  }

  protected render(): void {
    const photo = this.photos[this.index];
    if (!photo) return;

    const nodes = [
      this.buildOverlay(),
      this.buildCloseButton(),
      this.buildDeleteButton(),
      this.buildNavButton('prev'),
      this.buildImage(photo),
      this.buildNavButton('next'),
      this.buildCounter(),
    ].filter((n): n is HTMLElement => n !== null);

    this.renderShadow(styles, ...nodes);
  }
}

customElements.define('photo-viewer', PhotoViewerElement);

/** Abre un `<photo-viewer>` montado en document.body en la foto indicada. */
export function openPhotoViewer(options: OpenPhotoViewerOptions): void {
  const el = document.createElement('photo-viewer') as PhotoViewerElement;
  document.body.appendChild(el);
  el.open(options);
}
