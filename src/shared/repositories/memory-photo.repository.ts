import type { IPhotoRepository } from '../models/photo.repository.js';
import type { Photo, CreatePhoto } from '../models/photo.types.js';

/**
 * Implementación en memoria de IPhotoRepository para tests y desarrollo web.
 * Los datos no persisten entre sesiones (como está especificado en AC constraints).
 */
export class MemoryPhotoRepository implements IPhotoRepository {
  private photos: Photo[] = [];

  async add(photo: CreatePhoto): Promise<Photo> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const newPhoto: Photo = {
      ...photo,
      id,
      createdAt,
    };
    this.photos.push(newPhoto);
    return newPhoto;
  }

  async getByRouteId(routeId: string): Promise<Photo[]> {
    return this.photos
      .filter((p) => p.routeId === routeId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  async getById(id: string): Promise<Photo | null> {
    return this.photos.find((p) => p.id === id) ?? null;
  }

  async delete(id: string): Promise<void> {
    this.photos = this.photos.filter((p) => p.id !== id);
  }

  async countByRouteId(routeId: string): Promise<number> {
    return this.photos.filter((p) => p.routeId === routeId).length;
  }
}