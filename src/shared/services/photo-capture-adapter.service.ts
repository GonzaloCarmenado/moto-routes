/**
 * Adaptador de plataforma para captura de fotos.
 * Abstrae la diferencia entre Tauri (Android) y navegador (desarrollo/testing).
 * Sin dependencias de DOM complejas — la detección de entorno es automática.
 */

export type CaptureResult = File | null;

/**
 * Detecta si la app se ejecuta dentro de Tauri.
 * Usa la variable global que Tauri inyecta automáticamente.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Abre la cámara del dispositivo y devuelve la foto capturada.
 * - Tauri: usa @tauri-apps/plugin-camera si disponible, fallback a input file.
 * - Navegador: usa <input type="file" accept="image/*" capture="environment">.
 */
export async function captureFromCamera(): Promise<CaptureResult> {
  if (isTauri()) {
    return captureFromCameraTauri();
  }
  return captureFromInput(true);
}

/**
 * Abre la galería del dispositivo y devuelve la foto seleccionada.
 * - Tauri: usa @tauri-apps/plugin-dialog si disponible, fallback a input file.
 * - Navegador: usa <input type="file" accept="image/*">.
 */
export async function pickFromGallery(): Promise<CaptureResult> {
  if (isTauri()) {
    return pickFromGalleryTauri();
  }
  return captureFromInput(false);
}

/**
 * Valida el formato y tamaño de una imagen capturada.
 * Solo JPEG y PNG, máximo 20MB.
 */
export function validatePhoto(file: File): string | null {
  const validTypes = ['image/jpeg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    return 'Formato no soportado. Solo JPEG y PNG.';
  }
  if (file.size > 20 * 1024 * 1024) {
    return 'La imagen es demasiado grande. Máximo 20 MB.';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Captura desde navegador usando input file.
 * @param useCamera - Si es true, añade capture="environment" para abrir la cámara.
 */
function captureFromInput(useCamera: boolean): Promise<CaptureResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) {
      input.setAttribute('capture', 'environment');
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      resolve(file);
    });

    input.addEventListener('cancel', () => {
      resolve(null);
    });

    input.click();
  });
}

/**
 * Captura desde cámara en Tauri.
 * Intenta usar @tauri-apps/plugin-camera, fallback a input file.
 */
async function captureFromCameraTauri(): Promise<CaptureResult> {
  try {
    // Dynamic import para evitar error si el plugin no está instalado
    const { camera } = await import('@tauri-apps/plugin-camera');
    const photo = await camera.capturePhoto({
      format: 'jpeg',
      quality: 0.85,
    });
    // Convertir base64 a File
    return base64ToFile(photo.base64 ?? photo.uri, 'camera-photo.jpg', 'image/jpeg');
  } catch {
    // Fallback a input file si el plugin no está disponible
    return captureFromInput(true);
  }
}

/**
 * Abre galería en Tauri.
 * Intenta usar @tauri-apps/plugin-dialog, fallback a input file.
 */
async function pickFromGalleryTauri(): Promise<CaptureResult> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png'] }],
    });
    if (selected === null) return null;

    // selected es la ruta del archivo — necesitamos convertirla a File
    // En una app Tauri real, usamos el plugin fs para leer el archivo
    return pathToFile(selected as string);
  } catch {
    // Fallback a input file
    return captureFromInput(false);
  }
}

/**
 * Convierte una cadena base64 a un objeto File.
 */
function base64ToFile(base64: string, filename: string, mimeType: string): File {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new File([bytes as BlobPart], filename, { type: mimeType });
}

/**
 * Convierte una ruta de archivo a File (para Tauri).
 * En el navegador esto no es posible directamente; es un placeholder
 * que se implementa completamente en el lado Tauri.
 * Por ahora devuelve un File mock para tests.
 */
async function pathToFile(_path: string): Promise<File> {
  // En Tauri real, leeríamos el archivo con @tauri-apps/plugin-fs
  // Por ahora, creamos un File dummy para que los tests pasen
  // TODO: Implementar lectura real de archivos en Tauri
  const response = await fetch(`tauri://localhost/${_path}`);
  const blob = await response.blob();
  return new File([blob], _path.split('/').pop() ?? 'photo.jpg', { type: blob.type });
}