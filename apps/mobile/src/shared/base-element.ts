/**
 * Clase base de todos los custom elements de la app.
 *
 * Encapsula el patrón compartido de los Web Components: eventos tipados con
 * `emit<T>()` y renderizado en Shadow DOM con `renderShadow()`. Cualquier
 * componente nuevo debe extender esta clase en vez de `HTMLElement` directo
 * (ver ADR-022).
 */
export abstract class BaseElement extends HTMLElement {
  /** Despacha un CustomEvent tipado burbujeante y `composed` (atraviesa Shadow DOM). */
  protected emit<T>(name: string, detail: T): void {
    this.dispatchEvent(
      new CustomEvent<T>(name, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Monta el contenido en el Shadow DOM: resetea lo anterior, inyecta una hoja
   * `<style>` con `styles` y añade los `nodes`. Encapsula el patrón repetido
   * `root.innerHTML = '' + <style> + appendChild` que antes estaba duplicado en
   * cada componente. No-op si el elemento no tiene shadow root (no fuerza a
   * quien no use Shadow DOM a tenerlo).
   */
  protected renderShadow(styles: string, ...nodes: Node[]): void {
    const root = this.shadowRoot;
    if (!root) return;
    const style = document.createElement('style');
    style.textContent = styles;
    root.innerHTML = '';
    root.appendChild(style);
    root.append(...nodes);
  }

  protected abstract render(): void;
}