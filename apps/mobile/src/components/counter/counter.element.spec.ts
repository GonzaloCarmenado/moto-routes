import { describe, it, expect } from 'vitest';
import './counter.element.js';

describe('AppCounter', () => {
  it('should render with initial value 0', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const shadowRoot = counter.shadowRoot!;
    const span = shadowRoot.querySelector('span');
    expect(span?.textContent).toBe('0');

    document.body.removeChild(counter);
  });

  it('should increment on + click', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const shadowRoot = counter.shadowRoot!;
    const incrementBtn = shadowRoot.getElementById('increment') as HTMLButtonElement;
    incrementBtn.click();

    const span = shadowRoot.querySelector('span');
    expect(span?.textContent).toBe('1');

    document.body.removeChild(counter);
  });

  it('should decrement on - click', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    const shadowRoot = counter.shadowRoot!;
    const decrementBtn = shadowRoot.getElementById('decrement') as HTMLButtonElement;
    decrementBtn.click();

    const span = shadowRoot.querySelector('span');
    expect(span?.textContent).toBe('-1');

    document.body.removeChild(counter);
  });

  it('should emit counter-changed event on change', () => {
    const counter = document.createElement('app-counter');
    document.body.appendChild(counter);

    let emitted = false;
    counter.addEventListener('counter-changed', () => {
      emitted = true;
    });

    const shadowRoot = counter.shadowRoot!;
    const incrementBtn = shadowRoot.getElementById('increment') as HTMLButtonElement;
    incrementBtn.click();

    expect(emitted).toBe(true);

    document.body.removeChild(counter);
  });
});