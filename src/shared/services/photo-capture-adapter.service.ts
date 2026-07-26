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
  const files = await captureFromInput({ useCamera: true, multiple: false });
  return files[0] ?? null;
}

/**
 * Abre la galería del dispositivo y devuelve las fotos seleccionadas (puede
 * ser más de una — el input admite selección múltiple). Array vacío si el
 * usuario cancela.
 * Siempre usa <input type="file" accept="image/*" multiple>.
 */
export async function pickFromGallery(): Promise<File[]> {
  return captureFromInput({ useCamera: false, multiple: true });
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
 * @param options.useCamera - Si es true, añade capture="environment" para abrir la cámara.
 * @param options.multiple - Si es true, permite seleccionar más de un archivo (galería).
 */
function captureFromInput(options: { useCamera: boolean; multiple: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (options.useCamera) {
      input.setAttribute('capture', 'environment');
    }
    if (options.multiple) {
      input.multiple = true;
    }

    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []));
    });

    input.addEventListener('cancel', () => {
      resolve([]);
    });

    input.click();
  });
}