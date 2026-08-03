import { describe, it, expect, vi, afterEach, beforeEach, afterAll } from 'vitest';
import type * as ExternalApiServiceModule from '../shared/http/external-api.service.js';

const { fetchJsonMock } = vi.hoisted(() => ({ fetchJsonMock: vi.fn() }));

vi.mock('../shared/http/external-api.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ExternalApiServiceModule>();
  return { ...actual, fetchJson: fetchJsonMock };
});

import { fetchVehicleMakes, fetchVehicleModels } from './vpic.service.js';
import { ExternalApiError } from '../shared/http/external-api.service.js';
import type { VpicMakeResult, VpicModelResult } from './vpic.types.js';

describe('fetchVehicleMakes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('llama a fetchJson con la URL exacta para el tipo "motorcycle"', async () => {
    fetchJsonMock.mockResolvedValue({ Results: [] } satisfies VpicMakeResult);

    await fetchVehicleMakes('motorcycle');

    expect(fetchJsonMock).toHaveBeenCalledWith(
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/motorcycle?format=json',
    );
  });

  it('llama a fetchJson con la URL exacta para el tipo "car"', async () => {
    fetchJsonMock.mockResolvedValue({ Results: [] } satisfies VpicMakeResult);

    await fetchVehicleMakes('car');

    expect(fetchJsonMock).toHaveBeenCalledWith(
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json',
    );
  });

  it('devuelve id + nombre de cada marca, ordenadas alfabéticamente por nombre', async () => {
    fetchJsonMock.mockResolvedValue({
      Results: [
        { MakeId: 2, MakeName: 'Yamaha' },
        { MakeId: 1, MakeName: 'Honda' },
      ],
    } satisfies VpicMakeResult);

    const result = await fetchVehicleMakes('motorcycle');

    expect(result).toEqual([
      { id: 1, name: 'Honda' },
      { id: 2, name: 'Yamaha' },
    ]);
  });

  it('propaga un ExternalApiError sin envolverlo si fetchJson rechaza', async () => {
    const error = new ExternalApiError('network', 'boom');
    fetchJsonMock.mockRejectedValue(error);

    const promise = fetchVehicleMakes('motorcycle');

    await expect(promise).rejects.toBe(error);
    await expect(promise).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('fetchVehicleModels', () => {
  const REAL_YEAR = 2026;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${String(REAL_YEAR)}-01-15T00:00:00Z`));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('llama primero a GetModelsForMakeIdYear con el makeId, el año actual y el tipo de vehículo', async () => {
    fetchJsonMock.mockResolvedValue({ Results: [] } satisfies VpicModelResult);

    await fetchVehicleModels(474, 'Honda', 'motorcycle');

    expect(fetchJsonMock).toHaveBeenCalledWith(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeIdYear/makeId/474/modelyear/${String(REAL_YEAR)}/vehicletype/motorcycle?format=json`,
    );
  });

  it('devuelve los modelos ya filtrados por vPIC cuando GetModelsForMakeIdYear trae resultados, sin llamar al fallback', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      Results: [
        { Make_ID: 474, Make_Name: 'Honda', Model_ID: 1, Model_Name: 'CB500X', VehicleTypeName: 'Motorcycle' },
        { Make_ID: 474, Make_Name: 'Honda', Model_ID: 2, Model_Name: 'Gold Wing', VehicleTypeName: 'Motorcycle' },
      ],
    } satisfies VpicModelResult);

    const result = await fetchVehicleModels(474, 'Honda', 'motorcycle');

    expect(result).toEqual(['CB500X', 'Gold Wing']);
    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
  });

  it('cae al endpoint sin filtrar (GetModelsForMake) cuando GetModelsForMakeIdYear no devuelve nada', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ Results: [] } satisfies VpicModelResult)
      .mockResolvedValueOnce({
        Results: [
          { Make_ID: 474, Make_Name: 'Honda', Model_ID: 1, Model_Name: 'CB500X' },
          { Make_ID: 474, Make_Name: 'Honda', Model_ID: 2, Model_Name: 'Civic' },
        ],
      } satisfies VpicModelResult);

    const result = await fetchVehicleModels(474, 'Honda', 'motorcycle');

    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      2,
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/Honda?format=json',
    );
    expect(result).toEqual(['CB500X', 'Civic']);
  });

  it('propaga un ExternalApiError sin envolverlo ni intentar el fallback si GetModelsForMakeIdYear rechaza', async () => {
    const error = new ExternalApiError('timeout', 'boom');
    fetchJsonMock.mockRejectedValue(error);

    const promise = fetchVehicleModels(474, 'Honda', 'motorcycle');

    await expect(promise).rejects.toBe(error);
    await expect(promise).rejects.toMatchObject({ kind: 'timeout' });
    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
  });
});
