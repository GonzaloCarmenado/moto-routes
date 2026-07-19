import type { IPhotoRepository } from '../models/photo.repository.js';
import type { Photo, CreatePhoto } from '../models/photo.types.js';

const STORAGE_KEY = 'moto-routes-photos';

function loadPhotos(): Photo[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as Photo[]) : [];
  } catch {
    return [];
  }
}

function savePhotos(photos: Photo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  } catch {
    // localStorage lleno — silencioso
  }
}

/**
 * Implementación en memoria (backed por localStorage) de IPhotoRepository.
 * Los datos persisten entre sesiones a través de localStorage (para web).
 * En Tauri se usará SqlitePhotoRepository para persistencia real.
 */
export class MemoryPhotoRepository implements IPhotoRepository {
  private photos: Photo[] = loadPhotos();

  async add(photo: CreatePhoto): Promise<Photo> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const newPhoto: Photo = {
      ...photo,
      id,
      createdAt,
    };
    this.photos.push(newPhoto);
    savePhotos(this.photos);
    return newPhoto;
  }

  async getByRouteId(routeId: string): Promise<Photo[]> {
    this.photos = loadPhotos();
    return this.photos
      .filter((p) => p.routeId === routeId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  async getById(id: string): Promise<Photo | null> {
    this.photos = loadPhotos();
    return this.photos.find((p) => p.id === id) ?? null;
  }

  async delete(id: string): Promise<void> {
    this.photos = this.photos.filter((p) => p.id !== id);
    savePhotos(this.photos);
  }

  async countByRouteId(routeId: string): Promise<number> {
    this.photos = loadPhotos();
    return this.photos.filter((p) => p.routeId === routeId).length;
  }
}