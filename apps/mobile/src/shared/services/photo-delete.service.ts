/**
 * Borrado de una foto con confirmación previa del usuario.
 * Compartido entre el detalle de ruta y la grabación en curso (cockpit).
 */

import type { IPhotoRepository } from '../models/photo.repository.js';
import type { Photo } from '../models/photo.types.js';
import { deletePhotoFile } from './photo-storage.service.js';
import { confirmDialog } from '../feedback/confirm-dialog.element.js';

/**
 * Pide confirmación y, si se acepta, borra el archivo y la fila de una foto.
 * Devuelve si se borró o si el usuario canceló, para que el llamador decida
 * cómo actualizar su UI (la limpieza de `objectUrl`/refresco de galería es
 * responsabilidad del llamador, que es quien conoce esos detalles de vista).
 */
export async function deletePhotoWithConfirmation(
  photo: Photo,
  photoRepo: IPhotoRepository,
): Promise<'deleted' | 'cancelled'> {
  const choice = await confirmDialog({
    title: 'Eliminar foto',
    message: 'Esta acción no se puede deshacer.',
    actions: [
      { id: 'cancel', label: 'Cancelar', variant: 'neutral' },
      { id: 'confirm', label: 'Eliminar', variant: 'danger' },
    ],
  });
  if (choice !== 'confirm') return 'cancelled';

  await deletePhotoFile(photo.filePath);
  await photoRepo.delete(photo.id);
  return 'deleted';
}
