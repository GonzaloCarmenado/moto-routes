import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock virtual para los plugins Tauri que no están disponibles en npm
vi.mock('@tauri-apps/plugin-camera', () => ({}));
vi.mock('@tauri-apps/plugin-dialog', () => ({}));
vi.mock('@tauri-apps/plugin-fs', () => ({}));

import { isTauri, captureFromCamera, pickFromGallery, validatePhoto } from './photo-capture-adapter.service.js';

describe('isTauri', () => {
  beforeEach(() => {
    // Clean any Tauri internals before each test
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('should return false in browser environment', () => {
    expect(isTauri()).toBe(false);
  });

  it('should return true when __TAURI_INTERNALS__ exists', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });
});

describe('validatePhoto', () => {
  it('should return null for valid JPEG photo', () => {
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    expect(validatePhoto(file)).toBeNull();
  });

  it('should return null for valid PNG photo', () => {
    const file = new File([''], 'photo.png', { type: 'image/png' });
    expect(validatePhoto(file)).toBeNull();
  });

  it('should return error message for unsupported format', () => {
    const file = new File([''], 'photo.gif', { type: 'image/gif' });
    expect(validatePhoto(file)).toBe('Formato no soportado. Solo JPEG y PNG.');
  });

  it('should return error message for oversized photo (>20MB)', () => {
    const largeBlob = new Blob(['x'.repeat(21 * 1024 * 1024)]);
    const file = new File([largeBlob], 'large.jpg', { type: 'image/jpeg' });
    expect(validatePhoto(file)).toBe('La imagen es demasiado grande. Máximo 20 MB.');
  });

  it('should accept photo at exactly 20MB', () => {
    const blob = new Blob(['x'.repeat(20 * 1024 * 1024)]);
    const file = new File([blob], 'exact.jpg', { type: 'image/jpeg' });
    expect(validatePhoto(file)).toBeNull();
  });
});

describe('captureFromCamera (browser)', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('should create an input with type file and capture=environment', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement');

    // Simular que el usuario selecciona un archivo
    const mockFile = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    const promise = captureFromCamera();

    // Simular el cambio de input
    const inputEl = createElementSpy.mock.results[0]?.value as HTMLInputElement;
    // Simular que el input se añadió al DOM y el usuario seleccionó un archivo
    Object.defineProperty(inputEl, 'files', {
      value: [mockFile],
      writable: true,
    });
    inputEl.dispatchEvent(new Event('change'));

    const result = await promise;
    expect(createElementSpy).toHaveBeenCalledWith('input');
    expect(inputEl.type).toBe('file');
    expect(inputEl.accept).toBe('image/*');
    expect(inputEl.getAttribute('capture')).toBe('environment');
    expect(result).toBe(mockFile);
  });
});

describe('pickFromGallery (browser)', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('should create an input with type file, multiple, and without capture', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement');

    const mockFile = new File([''], 'gallery.jpg', { type: 'image/jpeg' });
    const promise = pickFromGallery();

    const inputEl = createElementSpy.mock.results[0]?.value as HTMLInputElement;
    Object.defineProperty(inputEl, 'files', {
      value: [mockFile],
      writable: true,
    });
    inputEl.dispatchEvent(new Event('change'));

    const result = await promise;
    expect(inputEl.getAttribute('capture')).toBeNull();
    expect(inputEl.multiple).toBe(true);
    expect(result).toEqual([mockFile]);
  });

  it('should return every file selected, not just the first one (bug: only the last photo was added)', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement');

    const fileA = new File([''], 'a.jpg', { type: 'image/jpeg' });
    const fileB = new File([''], 'b.jpg', { type: 'image/jpeg' });
    const fileC = new File([''], 'c.jpg', { type: 'image/jpeg' });
    const promise = pickFromGallery();

    const inputEl = createElementSpy.mock.results[0]?.value as HTMLInputElement;
    Object.defineProperty(inputEl, 'files', {
      value: [fileA, fileB, fileC],
      writable: true,
    });
    inputEl.dispatchEvent(new Event('change'));

    const result = await promise;
    expect(result).toEqual([fileA, fileB, fileC]);
  });

  it('should return an empty array when the user cancels', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    const promise = pickFromGallery();

    const inputEl = createElementSpy.mock.results[0]?.value as HTMLInputElement;
    inputEl.dispatchEvent(new Event('cancel'));

    expect(await promise).toEqual([]);
  });
});