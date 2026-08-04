import { describe, it, expect, afterEach } from 'vitest';
import { openStopTypeDialog } from './cockpit-stop-type-dialog.element.js';
import type { StopCategory } from '../../shared/stop-types/stop-types.types.js';

const categories: StopCategory[] = [
  { id: 1, key: 'bar-restaurante', label: 'Bar / restaurante', icon: '🍽️' },
  { id: 2, key: 'mirador', label: 'Mirador', icon: '🏔️' },
];

function getDialog(): HTMLElement {
  const el = document.body.querySelector('cockpit-stop-type-dialog');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('openStopTypeDialog', () => {
  it('mounts the dialog in document.body with one option per category', () => {
    void openStopTypeDialog(categories);
    const dialog = getDialog();

    expect(dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-option-bar-restaurante"]')).not.toBeNull();
    expect(dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-option-mirador"]')).not.toBeNull();
  });

  it('resolves with the chosen category when an option is clicked', async () => {
    const promise = openStopTypeDialog(categories);
    const dialog = getDialog();

    (dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-option-mirador"]') as HTMLButtonElement).click();

    await expect(promise).resolves.toEqual(categories[1]);
  });

  it('resolves with null when the cancel button is clicked, without picking any category', async () => {
    const promise = openStopTypeDialog(categories);
    const dialog = getDialog();

    (dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-cancel"]') as HTMLButtonElement).click();

    await expect(promise).resolves.toBeNull();
  });

  it('resolves with null when clicking the overlay outside the dialog', async () => {
    const promise = openStopTypeDialog(categories);
    const dialog = getDialog();

    (dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-overlay"]') as HTMLElement).click();

    await expect(promise).resolves.toBeNull();
  });

  it('resolves with null on Escape', async () => {
    const promise = openStopTypeDialog(categories);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(promise).resolves.toBeNull();
  });

  it('removes itself from document.body after resolving', async () => {
    const promise = openStopTypeDialog(categories);
    const dialog = getDialog();
    (dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-cancel"]') as HTMLButtonElement).click();
    await promise;

    expect(document.body.querySelector('cockpit-stop-type-dialog')).toBeNull();
  });

  it('shows an empty-state message and no options when the catalog is empty', () => {
    void openStopTypeDialog([]);
    const dialog = getDialog();

    expect(dialog.shadowRoot!.querySelector('[data-cy="stop-type-dialog-empty"]')).not.toBeNull();
    expect(dialog.shadowRoot!.querySelectorAll('.option')).toHaveLength(0);
  });
});
