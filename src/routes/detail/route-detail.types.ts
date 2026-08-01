import type { Photo } from '../../shared/models/photo.types.js';
import type { TabBarTab } from '../../shared/tab-bar/tab-bar.element.js';

/** Foto con su URL de objeto ya resuelta, para mostrarla en la UI del detalle. */
export interface PhotoWithUrl extends Photo {
  objectUrl: string;
}

export type TabBarElement = HTMLElement & { tabs: TabBarTab[] };
