import { BaseElement } from '../../shared/base-element.js';
import type { StopCategory } from '../../shared/stop-types/stop-types.types.js';
import styles from './cockpit-stop-type-dialog.element.css?inline';

/**
 * Modal para elegir el tipo de una parada manual, del catálogo cacheado
 * localmente. A diferencia de `<cockpit-save-route-dialog>`, sí es cerrable
 * (ESC / click fuera / botón cancelar): elegir un tipo es opcional, no
 * persiste ninguna parada si el usuario lo cierra sin elegir.
 */
class CockpitStopTypeDialogElement extends BaseElement {
  private categories: StopCategory[] = [];
  private onResolve: ((value: StopCategory | null) => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(null);
      return;
    }
    if (event.key === 'Tab') this.trapFocus(event);
  };

  private trapFocus(event: KeyboardEvent): void {
    const root = this.shadowRoot;
    if (!root) return;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>('.option, .cancel'));
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = root.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  /** Abre el diálogo con el catálogo dado. Resuelve con la categoría elegida, o `null` si se cierra sin elegir. */
  open(categories: StopCategory[]): Promise<StopCategory | null> {
    this.categories = categories;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    const first = this.shadowRoot?.querySelector<HTMLElement>('.option, .empty-message');
    first?.focus();
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  private close(result: StopCategory | null): void {
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('data-cy', 'stop-type-dialog-overlay');
    overlay.addEventListener('click', () => { this.close(null); });
    return overlay;
  }

  private buildOptionsList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'options';

    if (this.categories.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-message';
      empty.setAttribute('tabindex', '-1');
      empty.setAttribute('data-cy', 'stop-type-dialog-empty');
      empty.textContent = 'No hay tipos de parada disponibles todavía.';
      list.appendChild(empty);
      return list;
    }

    for (const category of this.categories) {
      const option = document.createElement('button');
      option.className = 'option';
      option.setAttribute('data-cy', `stop-type-dialog-option-${category.key}`);
      option.innerHTML = `<span class="option__icon">${category.icon}</span><span class="option__label">${category.label}</span>`;
      option.addEventListener('click', () => { this.close(category); });
      list.appendChild(option);
    }
    return list;
  }

  private buildDialog(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h2');
    titleEl.className = 'title';
    titleEl.textContent = '¿Qué tipo de parada es?';
    dialog.appendChild(titleEl);

    dialog.appendChild(this.buildOptionsList());

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel';
    cancelBtn.setAttribute('data-cy', 'stop-type-dialog-cancel');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => { this.close(null); });
    dialog.appendChild(cancelBtn);

    return dialog;
  }

  protected render(): void {
    this.renderShadow(styles, this.buildOverlay(), this.buildDialog());
  }
}

customElements.define('cockpit-stop-type-dialog', CockpitStopTypeDialogElement);

/**
 * Abre un `<cockpit-stop-type-dialog>` montado en document.body y devuelve
 * una promesa con la categoría elegida, o `null` si se cierra sin elegir
 * (ESC, click fuera o botón cancelar). El elemento se autodestruye al resolver.
 */
export function openStopTypeDialog(categories: StopCategory[]): Promise<StopCategory | null> {
  const el = document.createElement('cockpit-stop-type-dialog') as CockpitStopTypeDialogElement;
  document.body.appendChild(el);
  return el.open(categories);
}
