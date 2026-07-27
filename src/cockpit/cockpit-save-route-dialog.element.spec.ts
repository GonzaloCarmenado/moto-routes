import { describe, it, expect, afterEach } from 'vitest';
import { openSaveRouteDialog } from './cockpit-save-route-dialog.element.js';

function getDialog(): HTMLElement {
  const el = document.body.querySelector('cockpit-save-route-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('openSaveRouteDialog (AC-001, AC-003, AC-008, AC-009)', () => {
  it('mounts the dialog in document.body with an empty name input focused (AC-001)', () => {
    void openSaveRouteDialog({ message: '5.2 km · 02:00' });
    const dialog = getDialog();
    const input = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-input-name"]') as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.value).toBe('');
    expect(dialog.shadowRoot!.activeElement).toBe(input);
  });

  it('resolves { action: "save", name } with the text typed, without trimming (AC-001, AC-003)', async () => {
    const promise = openSaveRouteDialog({ message: '5.2 km · 02:00' });
    const dialog = getDialog();
    const input = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-input-name"]') as HTMLInputElement;
    input.value = '  Puerto de la Bonaigua  ';
    input.dispatchEvent(new Event('input'));

    (dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-action-save"]') as HTMLButtonElement).click();

    await expect(promise).resolves.toEqual({ action: 'save', name: '  Puerto de la Bonaigua  ' });
  });

  it('resolves { action: "save", name: "" } when the input is left empty', async () => {
    const promise = openSaveRouteDialog({ message: '5.2 km · 02:00' });
    const dialog = getDialog();
    (dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-action-save"]') as HTMLButtonElement).click();

    await expect(promise).resolves.toEqual({ action: 'save', name: '' });
  });

  it('resolves { action: "discard", name } with whatever was typed — the caller decides to ignore it (AC-008)', async () => {
    const promise = openSaveRouteDialog({ message: '5.2 km · 02:00' });
    const dialog = getDialog();
    const input = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-input-name"]') as HTMLInputElement;
    input.value = 'Ruta de prueba';
    input.dispatchEvent(new Event('input'));

    (dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-action-discard"]') as HTMLButtonElement).click();

    await expect(promise).resolves.toEqual({ action: 'discard', name: 'Ruta de prueba' });
  });

  it('sets maxlength="100" on the name input (AC-009)', () => {
    void openSaveRouteDialog({ message: '5.2 km · 02:00' });
    const dialog = getDialog();
    const input = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-input-name"]') as HTMLInputElement;
    expect(input.getAttribute('maxlength')).toBe('100');
  });

  it('does not close on Escape or overlay click — closable: false, same as the current stop flow', () => {
    void openSaveRouteDialog({ message: '5.2 km · 02:00' });
    const dialog = getDialog();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.querySelector('cockpit-save-route-dialog')).not.toBeNull();

    const overlay = dialog.shadowRoot!.querySelector('[data-cy="save-route-dialog-overlay"]') as HTMLElement;
    overlay.click();
    expect(document.body.querySelector('cockpit-save-route-dialog')).not.toBeNull();
  });

  it('cycles focus between input and the two buttons without escaping the dialog (Tab/Shift+Tab)', () => {
    void openSaveRouteDialog({ message: '5.2 km · 02:00' });
    const dialog = getDialog();
    const root = dialog.shadowRoot!;
    const input = root.querySelector('[data-cy="save-route-dialog-input-name"]') as HTMLInputElement;
    const discardBtn = root.querySelector('[data-cy="save-route-dialog-action-discard"]') as HTMLButtonElement;
    const saveBtn = root.querySelector('[data-cy="save-route-dialog-action-save"]') as HTMLButtonElement;

    expect(root.activeElement).toBe(input);

    saveBtn.focus();
    const forwardEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(forwardEvent);
    expect(forwardEvent.defaultPrevented).toBe(true);
    expect(root.activeElement).toBe(input);

    input.focus();
    const backwardEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(backwardEvent);
    expect(backwardEvent.defaultPrevented).toBe(true);
    expect(root.activeElement).toBe(saveBtn);
    expect(discardBtn).not.toBeNull();
  });
});
