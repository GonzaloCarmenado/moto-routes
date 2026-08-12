import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveRouteNote, buildNotasPanel } from './route-detail-notes.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';

vi.mock('../../shared/feedback/toast.js', () => ({
  showToast: vi.fn(),
}));

import { showToast } from '../../shared/feedback/toast.js';

function createRepository(): IRouteRepository {
  return { updateNotes: vi.fn().mockResolvedValue(undefined) } as unknown as IRouteRepository;
}

function createTextarea(value: string): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  return textarea;
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

describe('saveRouteNote', () => {
  beforeEach(() => {
    vi.mocked(showToast).mockReset();
  });

  it('persists the trimmed text, updates route.notes and shows a success toast', async () => {
    const repository = createRepository();
    const route = { id: 'route-1', notes: null } as Route;
    const textarea = createTextarea('  Bonita curva en el km 12  ');

    const ok = await saveRouteNote(repository, route, textarea);

    expect(ok).toBe(true);
    expect(repository.updateNotes).toHaveBeenCalledWith('route-1', '  Bonita curva en el km 12  ');
    expect(route.notes).toBe('  Bonita curva en el km 12  ');
    expect(showToast).toHaveBeenCalledWith('Nota guardada', 'success');
  });

  it('persists null (deletes the note) when the textarea is left empty, without asking for confirmation', async () => {
    const repository = createRepository();
    const route = { id: 'route-1', notes: 'algo previo' } as Route;
    const textarea = createTextarea('   ');

    const ok = await saveRouteNote(repository, route, textarea);

    expect(ok).toBe(true);
    expect(repository.updateNotes).toHaveBeenCalledWith('route-1', null);
    expect(route.notes).toBeNull();
  });

  it('shows an error toast and returns false without touching route.notes when persistence fails', async () => {
    const repository = createRepository();
    (repository.updateNotes as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('sin conexión'));
    const route = { id: 'route-1', notes: 'nota original' } as Route;
    const textarea = createTextarea('nota nueva que falla al guardar');

    const ok = await saveRouteNote(repository, route, textarea);

    expect(ok).toBe(false);
    expect(route.notes).toBe('nota original');
    expect(showToast).toHaveBeenCalledWith('sin conexión', 'error');
  });
});

describe('buildNotasPanel', () => {
  it('starts in view mode when the route already has a note', () => {
    const route = { id: 'route-1', notes: 'ya tiene nota' } as Route;
    const panel = buildNotasPanel(route, vi.fn());

    expect(panel.querySelector('.notes-view-text')?.textContent).toBe('ya tiene nota');
    expect(panel.querySelector('.notes-textarea')).toBeNull();
  });

  it('starts in edit mode directly when there is nothing to view yet', () => {
    const route = { id: 'route-1', notes: null } as Route;
    const panel = buildNotasPanel(route, vi.fn());

    expect(panel.querySelector('.notes-textarea')).not.toBeNull();
    expect(panel.querySelector('.notes-view-text')).toBeNull();
  });

  it('switches to edit mode when clicking the edit button', () => {
    const route = { id: 'route-1', notes: 'ya tiene nota' } as Route;
    const panel = buildNotasPanel(route, vi.fn());

    (panel.querySelector('.notes-edit-btn') as HTMLButtonElement).click();

    expect(panel.querySelector('.notes-textarea')).not.toBeNull();
  });

  it('goes back to view mode only after a successful save, keeping edit mode (and the typed text) on failure', async () => {
    const route = { id: 'route-1', notes: null } as Route;
    // Simula el efecto real de saveRouteNote() (actualizar route.notes al persistir con éxito) — aquí se mockea onSave directamente, sin pasar por saveRouteNote.
    const onSave = vi.fn()
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(() => { route.notes = 'intento 2 (ok)'; return Promise.resolve(true); });
    const panel = buildNotasPanel(route, onSave);

    const textarea = panel.querySelector('.notes-textarea') as HTMLTextAreaElement;
    textarea.value = 'intento 1 (falla)';
    (panel.querySelector('.notes-save-btn') as HTMLButtonElement).click();
    await flushPromises();
    expect(panel.querySelector('.notes-textarea')).not.toBeNull();

    (panel.querySelector('.notes-save-btn') as HTMLButtonElement).click();
    await flushPromises();
    expect(panel.querySelector('.notes-textarea')).toBeNull();
  });
});
