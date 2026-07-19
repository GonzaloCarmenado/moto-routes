/**
 * Adaptador de plataforma para captura de fotos.
 * Abstrae la diferencia entre Tauri (Android) y navegador (desarrollo/testing).
 * Sin dependencias de DOM complejas — la detección de entorno es automática.
 * 
 * IMPORTANTE: Tanto en web como en Tauri, se usa <input type="file"> ya que
 * los plugins @tauri-apps/plugin-camera y @tauri-apps/plugin-dialog no existen
 * en npm registry. El input file funciona correctamente en Tauri WebView.
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
 * Siempre usa <input type="file" accept="image/*" capture="environment">.
 */
export async function captureFromCamera(): Promise<CaptureResult> {
  return captureFromInput(true);
}

/**
 * Abre la galería del dispositivo y devuelve la foto seleccionada.
 * Siempre usa <input type="file" accept="image/*">.
 */
export async function pickFromGallery(): Promise<CaptureResult> {
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
 * Captura desde navegador/Tauri usando input file.
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