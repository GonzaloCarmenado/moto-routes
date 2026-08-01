import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('devuelve solo los nombres de marca, ordenados alfabéticamente', async () => {
    fetchJsonMock.mockResolvedValue({
      Results: [
        { MakeId: 2, MakeName: 'Yamaha' },
        { MakeId: 1, MakeName: 'Honda' },
      ],
    } satisfies VpicMakeResult);

    const result = await fetchVehicleMakes('motorcycle');

    expect(result).toEqual(['Honda', 'Yamaha']);
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
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('llama a fetchJson con la URL exacta para la marca dada', async () => {
    fetchJsonMock.mockResolvedValue({ Results: [] } satisfies VpicModelResult);

    await fetchVehicleModels('Honda', 'motorcycle');

    expect(fetchJsonMock).toHaveBeenCalledWith(
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/Honda?format=json',
    );
  });

  it('filtra por tipo de vehículo cuando la respuesta sí trae VehicleTypeName', async () => {
    fetchJsonMock.mockResolvedValue({
      Results: [
        {
          Make_ID: 1,
          Make_Name: 'Honda',
          Model_ID: 1,
          Model_Name: 'CB500X',
          VehicleTypeName: 'Motorcycle',
        },
        {
          Make_ID: 1,
          Make_Name: 'Honda',
          Model_ID: 2,
          Model_Name: 'Civic',
          VehicleTypeName: 'Passenger Car',
        },
      ],
    } satisfies VpicModelResult);

    const result = await fetchVehicleModels('Honda', 'motorcycle');

    expect(result).toEqual(['CB500X']);
  });

  it('devuelve todos los modelos sin filtrar cuando ninguno trae campo de tipo (shape real de la API)', async () => {
    fetchJsonMock.mockResolvedValue({
      Results: [
        { Make_ID: 1, Make_Name: 'Honda', Model_ID: 1, Model_Name: 'CB500X' },
        { Make_ID: 1, Make_Name: 'Honda', Model_ID: 2, Model_Name: 'CBR600RR' },
      ],
    } satisfies VpicModelResult);

    const result = await fetchVehicleModels('Honda', 'motorcycle');

    expect(result).toEqual(['CB500X', 'CBR600RR']);
  });

  it('propaga un ExternalApiError sin envolverlo si fetchJson rechaza', async () => {
    const error = new ExternalApiError('timeout', 'boom');
    fetchJsonMock.mockRejectedValue(error);

    const promise = fetchVehicleModels('Honda', 'motorcycle');

    await expect(promise).rejects.toBe(error);
    await expect(promise).rejects.toMatchObject({ kind: 'timeout' });
  });
});
