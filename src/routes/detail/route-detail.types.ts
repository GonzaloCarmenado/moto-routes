/**
 * @packageDocumentation
 * Tipos del detalle de ruta (foto con URL resuelta y referencia al tab-bar).
 */

import type { Photo } from '../../shared/models/photo.types.js';
import type { TabBarTab } from '../../shared/tab-bar/tab-bar.element.js';

/** Foto con su URL de objeto ya resuelta, para mostrarla en la UI del detalle. */
export interface PhotoWithUrl extends Photo {
  objectUrl: string;
}

/** Referencia tipada al `<tab-bar>` con su propiedad `tabs`. */
export type TabBarElement = HTMLElement & { tabs: TabBarTab[] };