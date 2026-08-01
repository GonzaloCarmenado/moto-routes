import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openProfileEditDialog } from './profile-edit-dialog.element.js';
import { pickFromGallery } from '../shared/services/photo-capture-adapter.service.js';
import type * as PhotoCaptureAdapter from '../shared/services/photo-capture-adapter.service.js';
import { savePhotoFile } from '../shared/services/photo-storage.service.js';

vi.mock('../shared/services/photo-capture-adapter.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof PhotoCaptureAdapter>();
  return { ...actual, captureFromCamera: vi.fn(), pickFromGallery: vi.fn() };
});

vi.mock('../shared/services/photo-storage.service.js', () => ({
  savePhotoFile: vi.fn(),
}));

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

function nameInput(dialog: HTMLElement): HTMLInputElement {
  return dialog.shadowRoot!.querySelector('[data-cy="profile-input-nombre"]') as HTMLInputElement;
}

function previewImg(dialog: HTMLElement): HTMLImageElement | null {
  return dialog.shadowRoot!.querySelector('.preview img');
}

function previewName(dialog: HTMLElement): string | null {
  return dialog.shadowRoot!.querySelector('.preview .profile-name')?.textContent ?? null;
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('openProfileEditDialog (AC-004 a AC-013, AC-037, AC-038)', () => {
  it('mounts the dialog with the name input prefilled and the preview showing the current avatar/name (AC-005)', () => {
    void openProfileEditDialog({ avatarUrl: 'blob:current-avatar', name: 'Marc', onSave: vi.fn() });
    const dialog = getDialog();

    expect(nameInput(dialog).value).toBe('Marc');
    expect(previewImg(dialog)?.getAttribute('src')).toBe('blob:current-avatar');
    expect(previewName(dialog)).toBe('Marc');
  });

  it('sets maxlength="100" on the name input (AC-008)', () => {
    void openProfileEditDialog({ avatarUrl: null, name: null, onSave: vi.fn() });
    const dialog = getDialog();

    expect(nameInput(dialog).getAttribute('maxlength')).toBe('100');
  });

  it('clicking "Cambiar foto" opens a menu with Cámara/Galería options (AC-006)', () => {
    void openProfileEditDialog({ avatarUrl: null, name: null, onSave: vi.fn() });
    const dialog = getDialog();

    const changePhotoBtn = dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]');
    expect(changePhotoBtn).not.toBeNull();
    changePhotoBtn?.click();

    const menu = dialog.shadowRoot!.querySelector('.photo-menu');
    expect(menu?.classList.contains('menu-open')).toBe(true);
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-menu-camara"]')).not.toBeNull();
    expect(dialog.shadowRoot!.querySelector('[data-cy="profile-menu-galeria"]')).not.toBeNull();
  });

  it('choosing "Galería" updates the preview <img> with a new blob: URL immediately, without calling savePhotoFile yet (AC-007)', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');

    void openProfileEditDialog({ avatarUrl: null, name: null, onSave: vi.fn() });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();

    expect(previewImg(dialog)?.getAttribute('src')).toBe('blob:new-photo');
    expect(savePhotoFile).not.toHaveBeenCalled();
  });

  it('clicking "Guardar" after choosing a photo and typing a name calls savePhotoFile once and onSave with the resolved avatarPath and the raw name (AC-009)', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.mocked(savePhotoFile).mockResolvedValue('/app-data/photos/avatar-1.jpg');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');
    const onSave = vi.fn().mockResolvedValue(undefined);

    const openPromise = openProfileEditDialog({ avatarUrl: null, name: null, onSave });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();

    const input = nameInput(dialog);
    input.value = 'Marc Nuevo';
    input.dispatchEvent(new Event('input'));
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-perfil"]')?.click();
    await flush();

    expect(savePhotoFile).toHaveBeenCalledTimes(1);
    expect(savePhotoFile).toHaveBeenCalledWith(file);
    expect(onSave).toHaveBeenCalledWith({ avatarPath: '/app-data/photos/avatar-1.jpg', name: 'Marc Nuevo' });
    await expect(openPromise).resolves.toBe('saved');
  });

  it('clicking "Guardar" without changing the photo resolves onSave with avatarPath: null (AC-009)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    void openProfileEditDialog({ avatarUrl: 'blob:existing', name: 'Marc', onSave });
    const dialog = getDialog();

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-perfil"]')?.click();
    await flush();

    expect(savePhotoFile).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith({ avatarPath: null, name: 'Marc' });
  });

  it('clicking "Guardar" with an empty/whitespace name passes the value as-is to onSave, without any fallback (AC-010)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    void openProfileEditDialog({ avatarUrl: null, name: 'Marc', onSave });
    const dialog = getDialog();

    const input = nameInput(dialog);
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-perfil"]')?.click();
    await flush();

    expect(onSave).toHaveBeenCalledWith({ avatarPath: null, name: '   ' });
  });

  it('clicking "Cancelar" resolves "cancelled" without calling savePhotoFile or onSave (AC-011)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const openPromise = openProfileEditDialog({ avatarUrl: null, name: null, onSave });
    const dialog = getDialog();

    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cancelar-perfil"]')?.click();

    await expect(openPromise).resolves.toBe('cancelled');
    expect(savePhotoFile).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('closing with Escape resolves "cancelled", same as Cancelar (AC-011)', async () => {
    const openPromise = openProfileEditDialog({ avatarUrl: null, name: null, onSave: vi.fn() });
    getDialog();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(openPromise).resolves.toBe('cancelled');
  });

  it('closing with an overlay click resolves "cancelled", same as Cancelar (AC-011)', async () => {
    const openPromise = openProfileEditDialog({ avatarUrl: null, name: null, onSave: vi.fn() });
    const dialog = getDialog();

    (dialog.shadowRoot!.querySelector('.overlay') as HTMLElement).click();

    await expect(openPromise).resolves.toBe('cancelled');
  });

  it('keeps the dialog open, shows an error toast and preserves the entered values when onSave rejects (AC-012)', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    vi.mocked(pickFromGallery).mockResolvedValue([file]);
    vi.mocked(savePhotoFile).mockResolvedValue('/app-data/photos/avatar-2.jpg');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo');
    const onSave = vi.fn().mockRejectedValue(new Error('fallo de BBDD'));

    void openProfileEditDialog({ avatarUrl: null, name: null, onSave });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-menu-galeria"]')?.click();
    await flush();

    const input = nameInput(dialog);
    input.value = 'Marc';
    input.dispatchEvent(new Event('input'));
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-guardar-perfil"]')?.click();
    await flush();

    expect(document.body.querySelector('profile-edit-dialog')).not.toBeNull();
    expect(document.body.querySelector('[data-cy="photo-toast-error"]')).not.toBeNull();
    expect(nameInput(dialog).value).toBe('Marc');
    expect(previewImg(dialog)?.getAttribute('src')).toBe('blob:new-photo');
  });

  it('gives every new interactive control a unique data-cy (AC-037)', () => {
    void openProfileEditDialog({ avatarUrl: null, name: null, onSave: vi.fn() });
    const dialog = getDialog();
    dialog.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="profile-btn-cambiar-foto"]')?.click();

    const cyValues = Array.from(dialog.shadowRoot!.querySelectorAll('[data-cy]')).map((el) =>
      el.getAttribute('data-cy'),
    );
    const expected = [
      'profile-input-nombre',
      'profile-btn-cambiar-foto',
      'profile-menu-camara',
      'profile-menu-galeria',
      'profile-btn-guardar-perfil',
      'profile-btn-cancelar-perfil',
    ];
    for (const value of expected) {
      expect(cyValues.filter((v) => v === value)).toHaveLength(1);
    }
    expect(new Set(cyValues).size).toBe(cyValues.length);
  });

  it('applies the min-width/min-height hitbox token to "Guardar"/"Cancelar" (.action) and "Cambiar foto" (.change-photo-btn) (AC-038)', () => {
    void openProfileEditDialog({ avatarUrl: null, name: null, onSave: vi.fn() });
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
