import { it, expect } from 'vitest';
import type { IProfileRepository } from './profile.repository.js';

/**
 * Tests de contrato para IProfileRepository.
 * Se ejecutan contra cualquier implementación que cumpla la interfaz —
 * el propio caller es responsable de envolver esta función en su `describe()`
 * (ver `memory-profile.repository.spec.ts`/`sqlite-profile.repository.spec.ts`),
 * igual que hace `route.repository.spec.ts` para `IRouteRepository`.
 *
 * Este archivo, por diseño (fase RED de TDD), no tiene ninguna implementación
 * concreta que lo satisfaga todavía — los Pasos 2 (`MemoryProfileRepository`)
 * y 3 (`SqliteProfileRepository`) del plan lo dejan en verde.
 */
export function registerProfileRepositoryTests(getRepo: () => IProfileRepository): void {
  it('should return null from get() on a freshly created repository (AC-002/AC-003/AC-015 empty state)', async () => {
    const result = await getRepo().get();
    expect(result).toBeNull();
  });

  it('should default absent fields to null when saving a partial patch on an empty profile (AC-009)', async () => {
    const saved = await getRepo().save({ vehicleType: 'motorcycle' });
    expect(saved.vehicleType).toBe('motorcycle');
    expect(saved.vehicleMake).toBeNull();
    expect(saved.vehicleModel).toBeNull();
  });

  it('should persist and retrieve the vehicle fields together (AC-009, AC-013)', async () => {
    await getRepo().save({ vehicleType: 'motorcycle', vehicleMake: 'Honda', vehicleModel: 'CB500X' });

    const fetched = await getRepo().get();
    expect(fetched).not.toBeNull();
    expect(fetched!.vehicleType).toBe('motorcycle');
    expect(fetched!.vehicleMake).toBe('Honda');
  });

  it('should NOT wipe the vehicle when saving it again with the same values (field-level coalescing, AC-014/AC-021)', async () => {
    await getRepo().save({ vehicleType: 'motorcycle', vehicleMake: 'Honda', vehicleModel: 'CB500X' });

    const saved = await getRepo().save({ vehicleType: 'motorcycle', vehicleMake: 'Honda', vehicleModel: 'CB500X' });
    expect(saved.vehicleType).toBe('motorcycle');
    expect(saved.vehicleMake).toBe('Honda');
    expect(saved.vehicleModel).toBe('CB500X');

    const fetched = await getRepo().get();
    expect(fetched!.vehicleType).toBe('motorcycle');
    expect(fetched!.vehicleMake).toBe('Honda');
  });

  it('should replace all three vehicle fields at once, never mixing the previous vehicle with the new one (AC-021)', async () => {
    await getRepo().save({ vehicleType: 'motorcycle', vehicleMake: 'Honda', vehicleModel: 'CB500X' });

    const saved = await getRepo().save({ vehicleType: 'car', vehicleMake: 'Seat', vehicleModel: 'Ibiza' });
    expect(saved.vehicleType).toBe('car');
    expect(saved.vehicleMake).toBe('Seat');
    expect(saved.vehicleModel).toBe('Ibiza');

    const fetched = await getRepo().get();
    expect(fetched!.vehicleType).toBe('car');
    expect(fetched!.vehicleMake).toBe('Seat');
    expect(fetched!.vehicleModel).toBe('Ibiza');
  });

  it('should never create a second row — save() called twice keeps a single profile (singleton constraint)', async () => {
    await getRepo().save({ vehicleMake: 'Honda' });
    await getRepo().save({ vehicleMake: 'Yamaha' });

    const fetched = await getRepo().get();
    expect(fetched).not.toBeNull();
    expect(fetched!.vehicleMake).toBe('Yamaha');
  });
}
