/**
 * Lógica pura del modal "Editar vehículo" (`profile-vehicle-dialog.element.ts`):
 * filtrado/priorización de marcas para el buscador (vPIC no soporta ningún
 * filtro de texto en `GetMakesForVehicleType`, siempre devuelve la lista
 * completa) y traducción de errores de red a mensajes de usuario.
 */
import { ExternalApiError } from '../shared/http/external-api.service.js';
import type { VehicleMake } from './vpic.service.js';

/**
 * Marcas de moto/coche ampliamente conocidas o internacionales, mostradas
 * primero en el buscador cuando no hay texto de filtro. Nunca oculta el
 * resto de marcas devueltas por vPIC — solo decide el orden.
 */
export const KNOWN_VEHICLE_MAKES: readonly string[] = [
  'Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'Harley-Davidson', 'KTM',
  'Triumph', 'Aprilia', 'Moto Guzzi', 'Royal Enfield', 'Vespa', 'Piaggio', 'Husqvarna',
  'Indian', 'MV Agusta', 'Gas Gas', 'Beta',
  'Toyota', 'Volkswagen', 'Ford', 'Chevrolet', 'Mercedes-Benz', 'Audi', 'Nissan',
  'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Volvo', 'Porsche', 'Renault', 'Peugeot',
  'Citroen', 'Fiat', 'Seat', 'Skoda', 'Opel', 'Jeep', 'Land Rover', 'Tesla', 'Mini',
  'Lexus', 'Jaguar', 'Mitsubishi',
];

/** Normaliza un nombre de marca para comparar ignorando mayúsculas/espacios/guiones (p. ej. vPIC devuelve "HARLEY-DAVIDSON" en mayúsculas). */
function normalizeMakeKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const KNOWN_MAKE_KEYS = new Set(KNOWN_VEHICLE_MAKES.map(normalizeMakeKey));

/**
 * Indica si una marca (tal como la devuelve vPIC) está en la lista curada de
 * marcas conocidas, comparando de forma insensible a mayúsculas/puntuación.
 * @param makeName - Nombre de marca devuelto por vPIC.
 */
export function isKnownMake(makeName: string): boolean {
  return KNOWN_MAKE_KEYS.has(normalizeMakeKey(makeName));
}

/**
 * Construye la lista de marcas a mostrar en el buscador: sin texto de
 * filtro, las marcas conocidas van primero (alfabético) y el resto después
 * (alfabético); con texto de filtro, se buscan coincidencias de subcadena
 * (insensible a mayúsculas) entre TODAS las marcas, conocidas o no,
 * ordenadas alfabéticamente.
 * @param makes - Marcas devueltas por `fetchVehicleMakes` para el tipo elegido.
 * @param query - Texto de búsqueda tal como lo escribió el usuario.
 * @returns Las marcas a mostrar, en el orden final.
 */
export function buildMakeOptionsList(makes: VehicleMake[], query: string): VehicleMake[] {
  const byName = (a: VehicleMake, b: VehicleMake): number => a.name.localeCompare(b.name);
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') {
    const known = makes.filter((m) => isKnownMake(m.name)).sort(byName);
    const rest = makes.filter((m) => !isKnownMake(m.name)).sort(byName);
    return [...known, ...rest];
  }
  return makes
    .filter((m) => m.name.toLowerCase().includes(trimmed))
    .sort(byName);
}

/**
 * Traduce un fallo de `fetchVehicleMakes`/`fetchVehicleModels` a un mensaje
 * acorde al sistema de diseño (AC-025) — nunca un error técnico crudo en
 * pantalla.
 * @param err - Error capturado (idealmente un `ExternalApiError`).
 * @returns Mensaje legible para el usuario.
 */
export function describeVehicleFetchError(err: unknown): string {
  if (err instanceof ExternalApiError) {
    if (err.kind === 'timeout') {
      return 'La consulta al catálogo de vehículos ha tardado demasiado. Comprueba tu conexión e inténtalo de nuevo.';
    }
    if (err.kind === 'invalid-json') {
      return 'El catálogo de vehículos ha devuelto una respuesta inesperada. Inténtalo de nuevo.';
    }
    return 'No se pudo conectar con el catálogo de vehículos. Comprueba tu conexión e inténtalo de nuevo.';
  }
  return 'No se pudo cargar la información del vehículo. Inténtalo de nuevo.';
}
