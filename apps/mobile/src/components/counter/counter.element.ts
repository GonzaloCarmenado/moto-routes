import { BaseElement } from '../../shared/base-element.js';
import styles from './counter.element.css?inline';

class AppCounter extends BaseElement {
  static observedAttributes = ['count'];

  private _count = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  get count(): number {
    return this._count;
  }

  set count(value: number) {
    this._count = value;
    this.setAttribute('count', String(value));
    this.render();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string): void {
    if (name === 'count') {
      this._count = Number(newValue) || 0;
      this.render();
    }
  }

  connectedCallback(): void {
    this.render();
  }

  protected render(): void {
    if (!this.shadowRoot) return;

    const style = document.createElement('style');
    style.textContent = styles;

    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(style);

    const decrementBtn = document.createElement('button');
    decrementBtn.id = 'decrement';
    decrementBtn.setAttribute('aria-label', 'Decrement');
    decrementBtn.textContent = '-';
    decrementBtn.addEventListener('click', () => {
      this.count--;
      this.emit('counter-changed', this.count);
    });

    const value = document.createElement('span');
    value.setAttribute('aria-live', 'polite');
    value.textContent = String(this._count);

    const incrementBtn = document.createElement('button');
    incrementBtn.id = 'increment';
    incrementBtn.setAttribute('aria-label', 'Increment');
    incrementBtn.textContent = '+';
    incrementBtn.addEventListener('click', () => {
      this.count++;
      this.emit('counter-changed', this.count);
    });

    this.shadowRoot.appendChild(decrementBtn);
    this.shadowRoot.appendChild(value);
    this.shadowRoot.appendChild(incrementBtn);
  }
}

customElements.define('app-counter', AppCounter);