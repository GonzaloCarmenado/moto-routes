/**
 * Adaptador de plataforma para captura de fotos.
 *
 * Tanto cámara como galería usan <input type="file">: en el WebView de Android
 * (Tauri) esto abre igualmente los selectores nativos de cámara/galería, igual
 * que en un navegador normal — no hace falta ningún plugin de Tauri adicional
 * (ver ADR-027 / spec fotos-ruta.md AC-022).
 */

export type CaptureResult = File | null;

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Abre la cámara y devuelve la foto capturada.
 * Funciona igual en web y en Tauri Android.
 */
export async function captureFromCamera(): Promise<CaptureResult> {
  const files = await captureFromInput({ useCamera: true, multiple: false });
  return files[0] ?? null;
}

/**
 * Abre la galería y devuelve las fotos seleccionadas.
 * Array vacío si el usuario cancela.
 * Funciona igual en web y en Tauri Android (ver comentario de cabecera).
 */
export async function pickFromGallery(): Promise<File[]> {
  return captureFromInput({ useCamera: false, multiple: true });
}

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