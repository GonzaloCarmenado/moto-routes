/**
 * Clase base de todos los custom elements de la app.
 *
 * Duplicada desde `apps/mobile/src/shared/base-element.ts` (ver tarea 1.3 de
 * `dashboard-reporting`): los paquetes pnpm de este monorepo son independientes
 * entre sí (`pnpm-workspace.yaml`), sin ningún paquete interno compartido entre
 * `apps/mobile` y `apps/web` — importar a través del límite de paquete acoplaría
 * el despliegue de ambas apps sin necesidad real. Si un tercer consumidor
 * aparece, extraer a un paquete `packages/shared-web` propio es la vía natural,
 * no seguir duplicando.
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
   * `<style>` con `styles` y añade los `nodes`.
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
