export abstract class BaseElement extends HTMLElement {
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