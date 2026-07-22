import { BaseElement } from '../base-element.js';
import styles from './photo-gallery.element.css?inline';

/** Contrato mínimo que necesita la galería para renderizar — cualquier foto con
 * URL ya resuelta (Photo + objectUrl, etc.) lo satisface estructuralmente. */
export interface GalleryPhoto {
  id: string;
  objectUrl: string;
}

export const PHOTO_GALLERY_SELECT_EVENT = 'photo-gallery:select';
export interface PhotoGallerySelectDetail {
  index: number;
}

/**
 * Galería horizontal de miniaturas, compartida entre el detalle de ruta y la
 * pantalla de grabación. No sabe nada de persistencia: recibe las fotos ya
 * resueltas y emite un evento con el índice al pulsar una miniatura — el
 * llamador decide qué hacer (normalmente, abrir `<photo-viewer>`).
 */
class PhotoGalleryElement extends BaseElement {
  private _photos: GalleryPhoto[] = [];

  set photos(value: GalleryPhoto[]) {
    this._photos = value;
    this.render();
  }

  get photos(): GalleryPhoto[] {
    return this._photos;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private buildPlaceholder(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'photo-placeholder';
    el.setAttribute('data-cy', 'photo-placeholder');
    el.textContent = 'Sin fotos';
    return el;
  }

  private buildThumbnail(photo: GalleryPhoto, index: number): HTMLElement {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumbnail';
    thumb.setAttribute('data-cy', 'photo-thumbnail');
    thumb.addEventListener('click', () => {
      this.emit<PhotoGallerySelectDetail>(PHOTO_GALLERY_SELECT_EVENT, { index });
    });

    const img = document.createElement('img');
    img.src = photo.objectUrl;
    img.alt = `Foto ${String(index + 1)}`;
    img.loading = 'lazy';
    thumb.appendChild(img);

    return thumb;
  }

  private buildGallery(): HTMLElement {
    const gallery = document.createElement('div');
    gallery.className = 'photo-gallery';
    gallery.setAttribute('data-cy', 'photo-gallery');
    this._photos.forEach((photo, index) => {
      gallery.appendChild(this.buildThumbnail(photo, index));
    });
    return gallery;
  }

  protected render(): void {
    const content = this._photos.length === 0 ? this.buildPlaceholder() : this.buildGallery();
    this.renderShadow(styles, content);
  }
}

customElements.define('photo-gallery', PhotoGalleryElement);
