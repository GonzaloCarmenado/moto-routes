import { describe, it, expect, vi } from 'vitest';
import { buildBackButton } from './back-button.js';

describe('buildBackButton', () => {
  it('sets the given data-cy and text', () => {
    const btn = buildBackButton('my-btn-volver', () => undefined);

    expect(btn.getAttribute('data-cy')).toBe('my-btn-volver');
    expect(btn.textContent).toContain('Volver');
    expect(btn.type).toBe('button');
  });

  it('calls the given callback on click', () => {
    const onClick = vi.fn();
    const btn = buildBackButton('my-btn-volver', onClick);

    btn.click();

    expect(onClick).toHaveBeenCalledOnce();
  });
});
