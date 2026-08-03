import { BaseElement } from '../../shared/base-element.js';
import styles from './cockpit-save-route-dialog.element.css?inline';

/** Opciones del diálogo de guardado: resumen de la ruta a mostrar. */
export interface SaveRouteDialogOptions {
  /** Resumen de la ruta (distancia · duración), ej. "5.2 km · 02:00". */
  message: string;
}

/** Resultado de la decisión: guardar (con nombre) o descartar. */
export interface SaveRouteDialogResult {
  action: 'save' | 'discard';
  name: string;
}

/**
 * Diálogo específico del dominio `cockpit` para el flujo de parada, con un
 * campo de nombre embebido. Réplica deliberada (no una extracción) del
 * patrón de `<confirm-dialog>` (focus trap, `closable: false` fijo) — ver
 * decisión de diseño #1 en `specs/features/mejoras-guardado-rutas.plan.md`:
 * `<confirm-dialog>` es un componente compartido con contrato
 * `Promise<string | null>` usado por 3 consumidores más, y este caso de uso
 * es el único que necesita devolver también un valor de texto.
 */
class CockpitSaveRouteDialogElement extends BaseElement {
  private options: SaveRouteDialogOptions | null = null;
  private onResolve: ((value: SaveRouteDialogResult) => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }
    // closable: false — parar una ruta obliga a decidir, igual que el flujo actual.
    if (event.key === 'Escape') event.preventDefault();
  };

  /** Ciclo de foco: input → Descartar → Guardar → (Tab) vuelve al input, y viceversa con Shift+Tab. */
  private trapFocus(event: KeyboardEvent): void {
    const root = this.shadowRoot;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>('[data-cy="save-route-dialog-input-name"], .action'),
    );
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

  /** Abre el diálogo y devuelve una promesa con la acción elegida y el nombre tal cual escrito (sin sanear — responsabilidad del llamador). */
  open(options: SaveRouteDialogOptions): Promise<SaveRouteDialogResult> {
    this.options = options;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="save-route-dialog-input-name"]');
    input?.focus();
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  private close(action: 'save' | 'discard'): void {
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('[data-cy="save-route-dialog-input-name"]');
    const name = input?.value ?? '';
    this.onResolve?.({ action, name });
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('data-cy', 'save-route-dialog-overlay');
    // closable: false — un click en el fondo no cierra el diálogo.
    return overlay;
  }

  private buildField(): HTMLElement {
    const field = document.createElement('div');
    field.className = 'field';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input';
    input.setAttribute('data-cy', 'save-route-dialog-input-name');
    input.setAttribute('maxlength', '100');
    input.setAttribute('placeholder', 'Nombre de la ruta (opcional)');
    input.setAttribute('aria-label', 'Nombre de la ruta');
    field.appendChild(input);

    return field;
  }

  private buildActionsList(): HTMLElement {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'actions';

    const discardBtn = document.createElement('button');
    discardBtn.className = 'action action--danger';
    discardBtn.setAttribute('data-cy', 'save-route-dialog-action-discard');
    discardBtn.textContent = 'Descartar';
    discardBtn.addEventListener('click', () => { this.close('discard'); });
    actionsEl.appendChild(discardBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'action action--primary';
    saveBtn.setAttribute('data-cy', 'save-route-dialog-action-save');
    saveBtn.textContent = 'Guardar';
    saveBtn.addEventListener('click', () => { this.close('save'); });
    actionsEl.appendChild(saveBtn);

    return actionsEl;
  }

  private buildDialog(options: SaveRouteDialogOptions): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h2');
    titleEl.className = 'title';
    titleEl.textContent = '¿Guardar la ruta?';
    dialog.appendChild(titleEl);

    const messageEl = document.createElement('p');
    messageEl.className = 'message';
    messageEl.textContent = options.message;
    dialog.appendChild(messageEl);

    dialog.appendChild(this.buildField());
    dialog.appendChild(this.buildActionsList());
    return dialog;
  }

  protected render(): void {
    if (!this.options) return;
    this.renderShadow(styles, this.buildOverlay(), this.buildDialog(this.options));
  }
}

customElements.define('cockpit-save-route-dialog', CockpitSaveRouteDialogElement);

/**
 * Abre un `<cockpit-save-route-dialog>` montado en document.body y devuelve
 * una promesa con la acción elegida y el nombre escrito (tal cual, sin
 * trim/saneado — ver `sanitizeRouteName`/`buildDefaultRouteName` en
 * `cockpit.transform.ts` para eso). El elemento se autodestruye al resolver.
 */
export function openSaveRouteDialog(options: SaveRouteDialogOptions): Promise<SaveRouteDialogResult> {
  const el = document.createElement('cockpit-save-route-dialog') as CockpitSaveRouteDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}
