// jsdom no implementa el Blob URL API (createObjectURL/revokeObjectURL son no-ops
// reales en un navegador cuando el string no es una blob URL, pero en jsdom ni
// siquiera existen como funciones).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = (): string => 'blob:mock-url';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = (): void => { /* no-op en tests */ };
}