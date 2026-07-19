import type { Photo, CreatePhoto } from './photo.types.js';

/**
 * Interfaz del repositorio de fotos.
 * Contrato puro — las implementaciones concretas (SQLite, memoria)
 * deben cumplir estos métodos sin exponer su infraestructura interna.
 */
export interface IPhotoRepository {
  add(photo: CreatePhoto): Promise<Photo>;

  getByRouteId(routeId: string): Promise<Photo[]>;

  getById(id: string): Promise<Photo | null>;

  delete(id: string): Promise<void>;

  countByRouteId(routeId: string): Promise<number>;
}