import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openProfileEditDialog, type ProfileEditDialogOptions } from './profile-edit-dialog.element.js';
import { pickFromGallery } from '../shared/services/photo-capture-adapter.service.js';
import type * as PhotoCaptureAdapter from '../shared/services/photo-capture-adapter.service.js';

/** Abre el diálogo con `onEditUsername` por defecto (no-op, `null`) salvo que el test lo sobrescriba explícitamente. */
function open(options: Omit<ProfileEditDialogOptions, 'onEditUsername'> & Partial<Pick<ProfileEditDialogOptions, 'onEditUsername'>>): Promise<'saved' | 'cancelled'> {
  return openProfileEditDialog({ onEditUsername: vi.fn().mockResolvedValue(null), ...options });
}

vi.mock('../shared/services/photo-capture-adapter.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof PhotoCaptureAdapter>();
  return { ...actual, captureFromCamera: vi.fn(), pickFromGallery: vi.fn() };
});

// `?inline` (usado por el propio componente en producción) no sirve para
// inspeccionar el CSS fuente bajo Vitest — se lee el fichero directamente,
// mismo patrón que `nav-bar.element.spec.ts`.
const cssPath = resolve(process.cwd(), 'src/profile/profile-edit-dialog.element.css');
const dialogStyles = readFileSync(cssPath, 'utf8');

function getDialog(): HTMLElement {
  const el = document.body.querySelector('profile-edit-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function previewImg(dialog: HTMLElement): HTMLImageElement | null {
  return dialog.shadowRoot!.querySelector('.preview img');
}

function previewName(dialog: HTMLElement): string | null {
  return dialog.shadowRoot!.querySelector('.preview .profile-name')?.textContent ?? null;
}

function saveBtn(dialog: HTMLElement): HTMLButtonElement {
  return dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-perfil"]')!;
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('openProfileEditDialog (AC-004 a AC-013, AC-037, AC-038)', () => {
  it('mounts the dialog with the preview showing the current account avatar/username, no name input (AC-005)', () => {
    void open({ avatarUrl: 'blob:current-avatar', username: 'rider42', onSave: vi.fn() });
    const dialog = getDialog();

    expect(previewImg(dialog)?.getAttribute('src')).toBe('blob:current-avatar');
    expect(previewName(dialog)).toBe('rider42');
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-input-nombre"]')).toBeNull();
  });

  it('"Guardar" starts disabled until a new photo is chosen — there is nothing else to save', () => {
    void open({ avatarUrl: 'blob:current-avatar', username: 'rider42', onSave: vi.fn() });
    const dialog = getDialog();

    expect(saveBtn(dialog).disabled).toBe(true);
  });

  it('clicking "Cambiar foto" opens a menu with Cámara/Galería options (AC-006)', () => {
    void open({ avatarUrl: null, username: null, onSave: vi.fn() });
    const dialog = getDialog();

    const changePhotoBtn = dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]');
    expect(changePhotoBtn).not.toBeNull();
    changePhotoBtn?.click();

    const menu = dialog.shadowRoot!.querySelector('.photo-menu');
    expect(menu?.classList.contains('menu-open')).toBe(true);
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-menu-camara"]')).not.toBeNull();
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-menu-galeria"]')).not.toBeNull();
  });

  it('choosing "Galería" updates the preview <img> with a new blob: URL immediately and enables "Guardar" (AC-007)', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');

    void open({ avatarUrl: null, username: null, onSave: vi.fn() });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();

    expect(previewImg(dialog)?.getAttribute('src')).toBe('blob:new-photo');
    expect(saveBtn(dialog).disabled).toBe(false);
  });

  it('clicking "Guardar" after choosing a photo calls onSave with the chosen file (AC-009)', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');
    const onSave = vi.fn().mockResolvedValue(undefined);

    const openPromise = open({ avatarUrl: null, username: null, onSave });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();

    saveBtn(dialog).click();
    await flush();

    expect(onSave).toHaveBeenCalledWith({ avatarFile: file });
    await expect(openPromise).resolves.toBe('saved');
  });

  it('shows a spinner on "Guardar" and disables Cancelar/Cambiar foto while saving is in flight (AC-042)', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');
    let resolveOnSave!: () => void;
    const onSave = vi.fn(() => new Promise<void>((resolve) => { resolveOnSave = resolve; }));

    void open({ avatarUrl: null, username: null, onSave });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();
    saveBtn(dialog).click();
    await flush();

    const btn = saveBtn(dialog);
    expect(btn.disabled).toBe(true);
    expect(btn.classList.contains('is-saving')).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.querySelector('.spinner')).not.toBeNull();
    expect(dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cancelar-perfil"]')?.disabled).toBe(true);
    expect(dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.disabled).toBe(true);

    resolveOnSave();
    await flush();
    expect(document.body.querySelector('profile-edit-dialog')).toBeNull();
  });

  it('ignores Escape and overlay clicks while saving is in flight', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');
    const onSave = vi.fn(() => new Promise<void>(() => { /* never resolves */ }));

    const openPromise = open({ avatarUrl: null, username: null, onSave });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();
    saveBtn(dialog).click();
    await flush();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (dialog.shadowRoot!.querySelector('.overlay') as HTMLElement).click();
    await flush();

    let settled = false;
    void openPromise.then(() => { settled = true; });
    await flush();
    expect(settled).toBe(false);
  });

  it('re-enables the controls and hides the spinner if saving fails (AC-012, AC-042)', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');
    const onSave = vi.fn().mockRejectedValue(new Error('fallo de subida'));

    void open({ avatarUrl: null, username: null, onSave });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();
    saveBtn(dialog).click();
    await flush();

    const btn = saveBtn(dialog);
    expect(btn.disabled).toBe(false);
    expect(btn.classList.contains('is-saving')).toBe(false);
    expect(btn.textContent).toBe('Guardar');
  });

  it('clicking "Cancelar" resolves "cancelled" without calling onSave (AC-011)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const openPromise = open({ avatarUrl: null, username: null, onSave });
    const dialog = getDialog();

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cancelar-perfil"]')?.click();

    await expect(openPromise).resolves.toBe('cancelled');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('closing with Escape resolves "cancelled", same as Cancelar (AC-011)', async () => {
    const openPromise = open({ avatarUrl: null, username: null, onSave: vi.fn() });
    getDialog();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(openPromise).resolves.toBe('cancelled');
  });

  it('closing with an overlay click resolves "cancelled", same as Cancelar (AC-011)', async () => {
    const openPromise = open({ avatarUrl: null, username: null, onSave: vi.fn() });
    const dialog = getDialog();

    (dialog.shadowRoot!.querySelector('.overlay') as HTMLElement).click();

    await expect(openPromise).resolves.toBe('cancelled');
  });

  it('keeps the dialog open, shows an error toast and preserves the chosen preview when onSave rejects — the previous avatar stays untouched (AC-012, 5.2)', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');
    const onSave = vi.fn().mockRejectedValue(new Error('fallo de red'));

    void open({ avatarUrl: 'blob:previous-avatar', username: null, onSave });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();
    saveBtn(dialog).click();
    await flush();

    expect(document.body.querySelector('profile-edit-dialog')).not.toBeNull();
    expect(document.body.querySelector('[data-cy="photo-toast-error"]')).not.toBeNull();
    expect(previewImg(dialog)?.getAttribute('src')).toBe('blob:new-photo');
  });

  it('gives every new interactive control a unique data-cy (AC-037)', () => {
    void open({ avatarUrl: null, username: null, onSave: vi.fn() });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();

    const cyValues = Array.from(dialog.shadowRoot!.querySelectorAll('[data-cy]')).map((el) =>
      el.getAttribute('data-cy'),
    );
    const expected = [
      'profile-btn-cambiar-foto',
      'profile-menu-camara',
      'profile-menu-galeria',
      'profile-btn-editar-username',
      'profile-btn-guardar-perfil',
      'profile-btn-cancelar-perfil',
    ];
    for (const value of expected) {
      expect(cyValues.filter((v) => v === value)).toHaveLength(1);
    }
    expect(new Set(cyValues).size).toBe(cyValues.length);
  });

  it('applies the min-width/min-height hitbox token to "Guardar"/"Cancelar" (.action) and "Cambiar foto" (.change-photo-btn) (AC-038)', () => {
    void open({ avatarUrl: null, username: null, onSave: vi.fn() });
    const dialog = getDialog();

    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-btn-guardar-perfil"]')?.classList.contains('action')).toBe(true);
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-btn-cancelar-perfil"]')?.classList.contains('action')).toBe(true);
    expect(
      dialog.shadowRoot!.querySelector('[data-cy="profile-btn-cambiar-foto"]')?.classList.contains('change-photo-btn'),
    ).toBe(true);

    expect(dialogStyles).toMatch(/\.action\s*\{[^}]*min-width:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(dialogStyles).toMatch(/\.action\s*\{[^}]*min-height:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(dialogStyles).toMatch(/\.change-photo-btn\s*\{[^}]*min-width:\s*var\(--hitbox-min\)[^}]*\}/);
    expect(dialogStyles).toMatch(/\.change-photo-btn\s*\{[^}]*min-height:\s*var\(--hitbox-min\)[^}]*\}/);
  });
});

describe('openProfileEditDialog — editar username desde el mismo diálogo (unificar-perfil-cuenta, un único botón "Editar")', () => {
  function usernameBtn(dialog: HTMLElement): HTMLButtonElement {
    return dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-editar-username"]')!;
  }

  it('con username ya fijado, el botón dice "Editar nombre de usuario" y lo pasa a onEditUsername', () => {
    const onEditUsername = vi.fn().mockResolvedValue(null);
    void open({ avatarUrl: null, username: 'rider42', onSave: vi.fn(), onEditUsername });
    const dialog = getDialog();

    expect(usernameBtn(dialog).textContent).toBe('Editar nombre de usuario');
    usernameBtn(dialog).click();

    expect(onEditUsername).toHaveBeenCalledTimes(1);
  });

  it('sin username fijado, el botón dice "Fijar nombre de usuario"', () => {
    void open({ avatarUrl: null, username: null, onSave: vi.fn() });
    const dialog = getDialog();

    expect(usernameBtn(dialog).textContent).toBe('Fijar nombre de usuario');
  });

  it('tras editar el username con éxito, la previsualización se actualiza sin cerrar el diálogo (AC-004, un único punto de edición)', async () => {
    const onEditUsername = vi.fn().mockResolvedValue('newname');
    const openPromise = open({ avatarUrl: null, username: 'oldname', onSave: vi.fn(), onEditUsername });
    const dialog = getDialog();

    usernameBtn(dialog).click();
    await flush();

    expect(previewName(dialog)).toBe('newname');
    expect(document.body.querySelector('profile-edit-dialog')).not.toBeNull();

    let settled = false;
    void openPromise.then(() => { settled = true; });
    await flush();
    expect(settled).toBe(false);
  });

  it('cancelar la edición de username (onEditUsername resuelve null) deja la previsualización sin cambios', async () => {
    const onEditUsername = vi.fn().mockResolvedValue(null);
    void open({ avatarUrl: null, username: 'oldname', onSave: vi.fn(), onEditUsername });
    const dialog = getDialog();

    usernameBtn(dialog).click();
    await flush();

    expect(previewName(dialog)).toBe('oldname');
  });

  it('deshabilita el botón de username mientras se está subiendo un avatar nuevo', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');
    const onSave = vi.fn(() => new Promise<void>(() => { /* never resolves */ }));

    void open({ avatarUrl: null, username: 'rider42', onSave });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();
    saveBtn(dialog).click();
    await flush();

    expect(usernameBtn(dialog).disabled).toBe(true);
  });
});
