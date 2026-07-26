import { BaseElement } from '../base-element.js';
import styles from './confirm-dialog.element.css?inline';

export type ConfirmDialogVariant = 'primary' | 'danger' | 'neutral';

export interface ConfirmDialogAction {
  id: string;
  label: string;
  variant: ConfirmDialogVariant;
}

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  actions: ConfirmDialogAction[];
  /** Si es false, ESC y el click en el fondo no hacen nada — hay que elegir una acción. Por defecto true. */
  closable?: boolean;
}

class ConfirmDialogElement extends BaseElement {
  private options: ConfirmDialogOptions | null = null;
  private onResolve: ((value: string | null) => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }
    if (event.key !== 'Escape') return;
    if (this.options?.closable === false) return;
    this.close(null);
  };

  /** Ciclo de foco dentro del diálogo: Tab desde el último botón vuelve al
   * primero, y viceversa con Shift+Tab — evita que el teclado escape al
   * contenido de detrás mientras el diálogo está abierto. */
  private trapFocus(event: KeyboardEvent): void {
    const buttons = Array.from(this.shadowRoot?.querySelectorAll<HTMLButtonElement>('.action') ?? []);
    if (buttons.length === 0) return;
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;
    const active = this.shadowRoot?.activeElement;

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

  /** Abre el diálogo con las opciones dadas y devuelve una promesa con el id de la acción elegida (o null si se cerró sin elegir). */
  open(options: ConfirmDialogOptions): Promise<string | null> {
    this.options = options;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    const firstButton = this.shadowRoot?.querySelector<HTMLButtonElement>('.action');
    firstButton?.focus();
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  private close(result: string | null): void {
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private handleOverlayClick(): void {
    if (this.options?.closable === false) return;
    this.close(null);
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('data-cy', 'confirm-dialog-overlay');
    overlay.addEventListener('click', () => { this.handleOverlayClick(); });
    return overlay;
  }

  private buildActionsList(actions: ConfirmDialogAction[]): HTMLElement {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'actions';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = `action action--${action.variant}`;
      btn.setAttribute('data-cy', `confirm-dialog-action-${action.id}`);
      btn.textContent = action.label;
      btn.addEventListener('click', () => { this.close(action.id); });
      actionsEl.appendChild(btn);
    }
    return actionsEl;
  }

  private buildDialog(options: ConfirmDialogOptions): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h2');
    titleEl.className = 'title';
    titleEl.textContent = options.title;
    dialog.appendChild(titleEl);

    if (options.message) {
      const messageEl = document.createElement('p');
      messageEl.className = 'message';
      messageEl.textContent = options.message;
      dialog.appendChild(messageEl);
    }

    dialog.appendChild(this.buildActionsList(options.actions));
    return dialog;
  }

  protected render(): void {
    if (!this.options) return;
    this.renderShadow(styles, this.buildOverlay(), this.buildDialog(this.options));
  }
}

customElements.define('confirm-dialog', ConfirmDialogElement);

/**
 * Abre un `<confirm-dialog>` montado en document.body y devuelve una promesa
 * con el `id` de la acción elegida, o `null` si el diálogo era cerrable y se
 * cerró sin elegir (ESC / click en el fondo). El elemento se autodestruye al
 * resolver.
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<string | null> {
  const el = document.createElement('confirm-dialog') as ConfirmDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}
