import { describe, it, expect, afterEach } from 'vitest';
import { BaseElement } from './base-element.js';

// Componente mínimo de prueba que expone renderShadow y un render() concreto.
class TestElement extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): void {
    const div = document.createElement('div');
    div.className = 'content';
    div.textContent = 'hola';
    this.renderShadow('.content { color: red; }', div);
  }

  public callRender(): void {
    this.render();
  }
}

class NoShadowElement extends BaseElement {
  protected render(): void {
    // no llama a attachShadow — renderShadow no debe reventar
    this.renderShadow('.x{}', document.createElement('span'));
  }

  public callRender(): void {
    this.render();
  }
}

customElements.define('test-base-element', TestElement);
customElements.define('test-noshadow-element', NoShadowElement);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('BaseElement.renderShadow', () => {
  it('injects a <style> with the given CSS and mounts the nodes in the shadow root', () => {
    const el = document.createElement('test-base-element') as TestElement;
    document.body.appendChild(el);
    el.callRender();

    const root = el.shadowRoot!;
    const style = root.querySelector('style');
    expect(style?.textContent).toContain('.content { color: red; }');
    expect(root.querySelector('.content')?.textContent).toBe('hola');
  });

  it('resets previous content on each call instead of accumulating', () => {
    const el = document.createElement('test-base-element') as TestElement;
    document.body.appendChild(el);
    el.callRender();
    el.callRender();
    el.callRender();

    const root = el.shadowRoot!;
    // Un único <style> y una única .content pese a tres renders
    expect(root.querySelectorAll('style')).toHaveLength(1);
    expect(root.querySelectorAll('.content')).toHaveLength(1);
  });

  it('does not throw when the element has no shadow root', () => {
    const el = document.createElement('test-noshadow-element') as NoShadowElement;
    document.body.appendChild(el);
    expect(() => { el.callRender(); }).not.toThrow();
  });
});
