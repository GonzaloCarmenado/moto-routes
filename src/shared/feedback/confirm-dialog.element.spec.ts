import { describe, it, expect, afterEach } from 'vitest';
import { confirmDialog } from './confirm-dialog.element.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function getDialog(): HTMLElement {
  const el = document.body.querySelector('confirm-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('confirmDialog', () => {
  it('mounts a dialog with the given title, message and actions', () => {
    void confirmDialog({
      title: '¿Guardar la ruta?',
      message: 'Esto no se puede deshacer.',
      actions: [
        { id: 'discard', label: 'Descartar', variant: 'danger' },
        { id: 'save', label: 'Guardar', variant: 'primary' },
      ],
    });

    const dialog = getDialog();
    const root = dialog.shadowRoot!;
    expect(root.textContent).toContain('¿Guardar la ruta?');
    expect(root.textContent).toContain('Esto no se puede deshacer.');
    expect(root.querySelector('[data-cy="confirm-dialog-action-discard"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="confirm-dialog-action-save"]')).not.toBeNull();
  });

  it('resolves with the id of the action the user clicked, and unmounts', async () => {
    const promise = confirmDialog({
      title: 'Eliminar ruta',
      actions: [
        { id: 'cancel', label: 'Cancelar', variant: 'neutral' },
        { id: 'confirm', label: 'Eliminar', variant: 'danger' },
      ],
    });

    const dialog = getDialog();
    const btn = dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-confirm"]') as HTMLButtonElement;
    btn.click();

    await expect(promise).resolves.toBe('confirm');
    expect(document.body.querySelector('confirm-dialog')).toBeNull();
  });

  it('is closable by default: ESC resolves null and unmounts', async () => {
    const promise = confirmDialog({
      title: 'Info',
      actions: [{ id: 'ok', label: 'OK', variant: 'primary' }],
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(promise).resolves.toBeNull();
    expect(document.body.querySelector('confirm-dialog')).toBeNull();
  });

  it('is closable by default: clicking the overlay resolves null', async () => {
    const promise = confirmDialog({
      title: 'Info',
      actions: [{ id: 'ok', label: 'OK', variant: 'primary' }],
    });

    const dialog = getDialog();
    const overlay = dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-overlay"]') as HTMLElement;
    overlay.click();

    await expect(promise).resolves.toBeNull();
  });

  it('when closable is false, ESC and overlay click do nothing — the dialog stays open', async () => {
    const promise = confirmDialog({
      title: '¿Guardar la ruta?',
      actions: [
        { id: 'discard', label: 'Descartar', variant: 'danger' },
        { id: 'save', label: 'Guardar', variant: 'primary' },
      ],
      closable: false,
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const dialog = getDialog();
    const overlay = dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-overlay"]') as HTMLElement;
    overlay.click();

    // Sigue montado, la promesa no se ha resuelto
    expect(document.body.querySelector('confirm-dialog')).not.toBeNull();

    // Se resuelve solo al elegir una acción real
    const btn = dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-save"]') as HTMLButtonElement;
    btn.click();
    await expect(promise).resolves.toBe('save');
  });

  it('moves focus to the first action button on open', () => {
    void confirmDialog({
      title: 'Info',
      actions: [
        { id: 'a', label: 'A', variant: 'neutral' },
        { id: 'b', label: 'B', variant: 'primary' },
      ],
    });

    const dialog = getDialog();
    const firstBtn = dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-a"]');
    expect(dialog.shadowRoot!.activeElement).toBe(firstBtn);
  });

  it('restores focus to the previously focused element on close', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const promise = confirmDialog({
      title: 'Info',
      actions: [{ id: 'ok', label: 'OK', variant: 'primary' }],
    });

    const dialog = getDialog();
    (dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-ok"]') as HTMLButtonElement).click();
    await promise;

    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab focus: from the last button, Tab wraps to the first (AC-002)', () => {
    void confirmDialog({
      title: 'Info',
      actions: [
        { id: 'a', label: 'A', variant: 'neutral' },
        { id: 'b', label: 'B', variant: 'primary' },
      ],
    });
    const dialog = getDialog();
    const root = dialog.shadowRoot!;
    const first = root.querySelector<HTMLButtonElement>('[data-cy="confirm-dialog-action-a"]')!;
    const last = root.querySelector<HTMLButtonElement>('[data-cy="confirm-dialog-action-b"]')!;

    last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(root.activeElement).toBe(first);
  });

  it('traps Shift+Tab focus: from the first button, it wraps to the last (AC-002)', () => {
    void confirmDialog({
      title: 'Info',
      actions: [
        { id: 'a', label: 'A', variant: 'neutral' },
        { id: 'b', label: 'B', variant: 'primary' },
      ],
    });
    const dialog = getDialog();
    const root = dialog.shadowRoot!;
    const first = root.querySelector<HTMLButtonElement>('[data-cy="confirm-dialog-action-a"]')!;
    const last = root.querySelector<HTMLButtonElement>('[data-cy="confirm-dialog-action-b"]')!;

    first.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
    expect(root.activeElement).toBe(last);
  });

  it('applies the requested visual variant class to each action button', () => {
    void confirmDialog({
      title: 'Info',
      actions: [
        { id: 'a', label: 'A', variant: 'danger' },
        { id: 'b', label: 'B', variant: 'primary' },
        { id: 'c', label: 'C', variant: 'neutral' },
      ],
    });

    const dialog = getDialog();
    const root = dialog.shadowRoot!;
    expect(root.querySelector('[data-cy="confirm-dialog-action-a"]')?.className).toContain('danger');
    expect(root.querySelector('[data-cy="confirm-dialog-action-b"]')?.className).toContain('primary');
    expect(root.querySelector('[data-cy="confirm-dialog-action-c"]')?.className).toContain('neutral');
  });
});
