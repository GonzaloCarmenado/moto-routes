import type { Photo, CreatePhoto } from './photo.types.js';

/**
 * Interfaz del repositorio de fotos.
 * Contrato puro — las implementaciones concretas (SQLite, memoria)
 * deben cumplir estos métodos sin exponer su infraestructura interna.
 */
export interface IPhotoRepository {
  /** Persiste una nueva foto y devuelve la entidad creada con su `id`. */
  add(photo: CreatePhoto): Promise<Photo>;

  /** Lista las fotos de una ruta. */
  getByRouteId(routeId: string): Promise<Photo[]>;

  /** Recupera una foto por id — `null` si no existe. */
  getById(id: string): Promise<Photo | null>;

  /** Elimina una foto por id. */
  delete(id: string): Promise<void>;

  /** Cuenta las fotos de una ruta (límite de 100 — ver `MAX_PHOTOS_PER_ROUTE`). */
  countByRouteId(routeId: string): Promise<number>;

  /** Marca una foto como subida al backend, guardando su id remoto. */
  markPhotoSynced(photoId: string, remotePhotoId: string): Promise<void>;
}
