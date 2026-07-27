/**
 * Panel "Notas" de <route-detail> (AC-010 a AC-017, AC-019): construcción del
 * DOM y persistencia de la nota. Extraído de route-detail.element.ts para
 * mantener ese archivo bajo el límite de tamaño (specs/ui/frontend-conventions.md).
 */
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { Route } from '../shared/models/route.types.js';
import { showToast } from '../shared/feedback/toast.js';
import { toErrorMessage } from '../shared/utils/errors.js';

type SaveNote = (textarea: HTMLTextAreaElement) => Promise<boolean>;

/**
 * Guardar con el área vacía persiste `null` (borra la nota) sin pedir
 * confirmación — a diferencia de borrar una ruta/foto, sobreescribir o
 * vaciar una nota es una acción de edición normal y reversible (AC-016,
 * constraint explícito de la spec). En error, el texto escrito se conserva
 * en el `<textarea>` para poder reintentar (AC-017) — este helper no lo toca.
 * Devuelve si la persistencia tuvo éxito, para que el llamador decida si
 * vuelve al modo vista (AC-019) o mantiene el área editable.
 */
export async function saveRouteNote(
  repository: IRouteRepository,
  route: Route,
  textarea: HTMLTextAreaElement,
): Promise<boolean> {
  const notes = textarea.value.trim() === '' ? null : textarea.value;

  try {
    await repository.updateNotes(route.id, notes);
  } catch (err) {
    showToast(`⚠️ ${toErrorMessage(err, 'Error al guardar la nota')}`, 'error');
    return false;
  }

  route.notes = notes;
  showToast('Nota guardada', 'success');
  return true;
}

/**
 * `route.notes` viene ya cargado en `fetchAndRender()` — no hace falta
 * ninguna petición adicional al cambiar de pestaña (AC-008, AC-013, AC-014).
 * Arranca en modo vista si ya hay una nota (AC-019), o directamente en modo
 * edición si no hay nada que ver (AC-014).
 */
export function buildNotasPanel(route: Route, onSave: SaveNote): HTMLElement {
  const panel = document.createElement('div');
  panel.setAttribute('slot', 'notas');
  renderNotasPanel(panel, route, onSave, !hasNote(route));
  return panel;
}

function hasNote(route: Route): boolean {
  return (route.notes ?? '').trim() !== '';
}

function renderNotasPanel(panel: HTMLElement, route: Route, onSave: SaveNote, editing: boolean): void {
  panel.innerHTML = '';
  panel.appendChild(editing ? buildEditMode(panel, route, onSave) : buildViewMode(panel, route, onSave));
}

function buildViewMode(panel: HTMLElement, route: Route, onSave: SaveNote): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'notes-view';

  const editBtn = document.createElement('button');
  editBtn.className = 'notes-edit-btn';
  editBtn.setAttribute('data-cy', 'route-detail-btn-editar-nota');
  editBtn.setAttribute('aria-label', 'Editar nota');
  editBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  editBtn.addEventListener('click', () => { renderNotasPanel(panel, route, onSave, true); });
  wrapper.appendChild(editBtn);

  const text = document.createElement('p');
  text.className = 'notes-view-text';
  text.setAttribute('data-cy', 'route-detail-texto-nota');
  text.textContent = route.notes ?? '';
  wrapper.appendChild(text);

  return wrapper;
}

function buildEditMode(panel: HTMLElement, route: Route, onSave: SaveNote): HTMLElement {
  const wrapper = document.createElement('div');

  const textarea = document.createElement('textarea');
  textarea.className = 'notes-textarea';
  textarea.setAttribute('data-cy', 'route-detail-textarea-notas');
  textarea.setAttribute('placeholder', 'Escribe aquí tus notas sobre la ruta…');
  textarea.value = route.notes ?? '';
  wrapper.appendChild(textarea);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'notes-save-btn';
  saveBtn.setAttribute('data-cy', 'route-detail-btn-guardar-nota');
  saveBtn.textContent = 'Guardar nota';
  saveBtn.addEventListener('click', () => {
    void onSave(textarea).then((success) => {
      // En error se deja el DOM (y el texto escrito) tal cual, para poder
      // reintentar (AC-017) — solo se reconstruye la vista al tener éxito.
      if (success) renderNotasPanel(panel, route, onSave, !hasNote(route));
    });
  });
  wrapper.appendChild(saveBtn);

  return wrapper;
}
